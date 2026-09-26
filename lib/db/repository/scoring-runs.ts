import { createHash } from "node:crypto";

import { z } from "zod";

import type { Prisma } from "@/generated/prisma/client";
import { evaluateScoringGate, type ScoringGateAssessment } from "@/lib/method/gates";
import { computeIndex } from "@/lib/method/scoring";
import type { DomainScoreInput, MissingKind, ScoringResult } from "@/lib/method/types";

import { db } from "../client";
import { evaluateAhpGateFor, groupKey } from "./ahp-sessions";

export class ScoringError extends Error {
  constructor(
    readonly code: "GATE" | "INVALID" | "CONFLICT" | "NOT_FOUND",
    message: string,
    readonly details?: string[],
  ) {
    super(message);
    this.name = "ScoringError";
  }
}

// docs/07 P4: JSON exports carry `_warning` and `_dataOrigin` at the root.
export const EXPORT_WARNING =
  "KELUARAN SIMULASI — controlled dry-run internal. Bukan data penelitian. Tidak boleh dilaporkan sebagai hasil FGD, Delphi, validitas isi, AHP, atau uji institusional. R1–V1.7 §3.12, §4.3.";

export const FICTIONAL_PREFIX = "[FIKTIF] ";

// ── Fictional institution profiles ───────────────────────────────────

export async function saveInstitutionProfile(actorId: string, input: { id?: string | null; label: string; description: string }) {
  const prisma = await db();
  const label = input.label.startsWith(FICTIONAL_PREFIX) ? input.label : `${FICTIONAL_PREFIX}${input.label}`;
  const holder = await prisma.institutionProfile.findUnique({ where: { label }, select: { id: true } });
  if (holder && holder.id !== input.id) throw new ScoringError("CONFLICT", `Label ${label} sudah dipakai.`);
  return prisma.$transaction(async (tx) => {
    if (input.id) {
      const used = await tx.assessment.count({ where: { profileId: input.id } });
      // An assessed profile is evidence for its scores; edit a copy instead.
      if (used) throw new ScoringError("CONFLICT", "Profil sudah dipakai asesmen; buat profil baru untuk perubahan.");
      await tx.institutionProfile.update({ where: { id: input.id }, data: { label, description: input.description } });
      await tx.auditEvent.create({ data: { actorId, actorKind: "USER", action: "INSTITUTION_PROFILE_UPDATE", targetType: "InstitutionProfile", targetId: input.id, payload: { label } } });
      return input.id;
    }
    const p = await tx.institutionProfile.create({ data: { label, description: input.description, createdById: actorId } });
    await tx.auditEvent.create({ data: { actorId, actorKind: "USER", action: "INSTITUTION_PROFILE_CREATE", targetType: "InstitutionProfile", targetId: p.id, payload: { label } } });
    return p.id;
  });
}

export async function listInstitutionProfiles() {
  const prisma = await db();
  return prisma.institutionProfile.findMany({ orderBy: { createdAt: "asc" }, include: { _count: { select: { assessments: true } } } });
}

// ── Weights from the G5 session ──────────────────────────────────────

/** Aggregated weights of the AHP session G5 was passed on; single aspects weigh 1 (docs/05 §5.1). */
async function g5Weights(versionId: string) {
  const prisma = await db();
  const g5 = await prisma.gateRecord.findUnique({ where: { versionId_gate: { versionId, gate: "G5_AHP" } } });
  const e = await evaluateAhpGateFor(versionId);
  if (g5?.status !== "PASSED" || !e.sessionId) return null;
  const weights = await prisma.ahpWeight.findMany({ where: { sessionId: e.sessionId, seatIndex: null, archived: false } });
  const byGroup = new Map<string, Map<string, number>>();
  for (const w of weights) {
    const k = groupKey(w.level, w.parentCode);
    if (!byGroup.has(k)) byGroup.set(k, new Map());
    byGroup.get(k)!.set(w.targetCode, w.weight);
  }
  return { sessionId: e.sessionId, byGroup };
}

export async function planAssessment(versionId: string) {
  const prisma = await db();
  const version = await prisma.artifactVersion.findUniqueOrThrow({ where: { id: versionId }, select: { status: true } });
  const blocked: string[] = [];
  if (version.status !== "CONTENT_LOCKED") blocked.push("CONTENT_NOT_LOCKED");
  const weights = await g5Weights(versionId);
  if (!weights) blocked.push("G5_NOT_PASSED");
  const g6 = await prisma.gateRecord.findUnique({ where: { versionId_gate: { versionId, gate: "G6_SCORING" } } });
  if (g6?.status === "PASSED") blocked.push("G6_ALREADY_PASSED");
  const indicators = await prisma.indicator.count({ where: { aspect: { domain: { versionId } }, deletedAt: null } });
  return { blocked, weightsSessionId: weights?.sessionId ?? null, indicators };
}

export async function createAssessment(input: { actorId: string; versionId: string; profileId: string; modelProfileId: string; seed: number; promptVersions: Record<string, string>; budgetUsd?: number | null; runId?: string | null }) {
  const plan = await planAssessment(input.versionId);
  if (plan.blocked.length) throw new ScoringError("GATE", "Asesmen belum dapat dibuat.", plan.blocked);
  const prisma = await db();
  const [profile, model] = await Promise.all([
    prisma.institutionProfile.findUnique({ where: { id: input.profileId } }),
    prisma.modelProfile.findUnique({ where: { id: input.modelProfileId }, include: { provider: true } }),
  ]);
  if (!profile) throw new ScoringError("NOT_FOUND", "Profil institusi fiktif tidak ditemukan.");
  if (!model || !model.provider.approved || !model.provider.enabled) throw new ScoringError("INVALID", "Model asesor harus dari provider yang disetujui (docs/07 §5).");
  return prisma.$transaction(async (tx) => {
    const a = await tx.assessment.create({
      data: {
        versionId: input.versionId,
        institutionLabel: profile.label,
        dataOrigin: "SIMULATED",
        assessorRef: `Asesor simulasi · ${model.provider.label} ${model.label}`,
        status: "QUEUED",
        profileId: profile.id,
        modelProfileId: model.id,
        weightsSessionId: plan.weightsSessionId,
        seed: input.seed,
        budgetUsd: input.budgetUsd ?? null,
        runId: input.runId ?? null,
        settings: { promptVersions: input.promptVersions, estimatedCalls: plan.indicators } as Prisma.InputJsonValue,
        createdById: input.actorId,
      },
    });
    await tx.auditEvent.create({ data: { actorId: input.actorId, actorKind: "USER", action: "ASSESSMENT_CREATE", targetType: "Assessment", targetId: a.id, payload: { profile: profile.label, model: model.modelId } } });
    return a.id;
  });
}

// ── Run ──────────────────────────────────────────────────────────────

export async function loadAssessmentContext(assessmentId: string) {
  const prisma = await db();
  const a = await prisma.assessment.findUniqueOrThrow({ where: { id: assessmentId }, include: { profile: true, scores: { select: { indicatorId: true, level: true, missingKind: true } } } });
  const model = a.modelProfileId ? await prisma.modelProfile.findUnique({ where: { id: a.modelProfileId }, include: { provider: true } }) : null;
  return { assessment: a, model };
}

export async function nextIndicatorToScore(assessmentId: string) {
  const prisma = await db();
  const a = await prisma.assessment.findUniqueOrThrow({ where: { id: assessmentId }, include: { scores: { select: { indicatorId: true } } } });
  const done = new Set(a.scores.map((s) => s.indicatorId));
  const next = await prisma.indicator.findFirst({
    where: { aspect: { domain: { versionId: a.versionId } }, deletedAt: null, id: { notIn: [...done] } },
    orderBy: [{ aspect: { domain: { order: "asc" } } }, { aspect: { order: "asc" } }, { order: "asc" }],
    include: { aspect: { include: { domain: true } }, rubricLevels: true, evidence: { orderBy: [{ minimumFor: "asc" }, { id: "asc" }] } },
  });
  return next;
}

export async function setAssessmentStatus(actorId: string | null, assessmentId: string, action: "START" | "PAUSE" | "RETRY" | "CANCEL" | "FAIL", error?: string) {
  const prisma = await db();
  const a = await prisma.assessment.findUniqueOrThrow({ where: { id: assessmentId } });
  if (a.status === "COMPLETED" || a.status === "CANCELLED") return;
  if (action === "START" && a.status === "FAILED") return;
  const status = { START: "RUNNING", PAUSE: "PAUSED", RETRY: "PAUSED", CANCEL: "CANCELLED", FAIL: "FAILED" }[action] as "RUNNING" | "PAUSED" | "CANCELLED" | "FAILED";
  await prisma.assessment.update({
    where: { id: assessmentId },
    data: {
      status,
      ...(action === "START" && !a.startedAt ? { startedAt: new Date() } : {}),
      ...(action === "FAIL" ? { error } : action === "RETRY" ? { error: null } : {}),
      ...(action === "CANCEL" ? { endedAt: new Date() } : {}),
    },
  });
  if (actorId && action !== "START" && action !== "FAIL") {
    await prisma.auditEvent.create({ data: { actorId, actorKind: "USER", action: `ASSESSMENT_${action}`, targetType: "Assessment", targetId: assessmentId, payload: {} } });
  }
}

export interface ScoreRow {
  level: number | null;
  missingKind: MissingKind;
  satisfiedEvidence: string[];
  levelCap: number;
  evidenceLocator: string | null;
  rationale: string;
  log: { promptId: string; promptVersion: string; modelId: string; promptHash: string; tokensIn: number | null; tokensOut: number | null };
}

/** Builds the computeIndex input: live hierarchy, the stored scores, G5 weights. */
async function scoringInput(versionId: string, assessmentId: string): Promise<{ domains: DomainScoreInput[]; weightsSessionId: string }> {
  const prisma = await db();
  const weights = await g5Weights(versionId);
  if (!weights) throw new ScoringError("GATE", "G5 belum lulus; bobot agregat tidak tersedia.", ["G5_NOT_PASSED"]);
  const [domains, scores] = await Promise.all([
    prisma.domain.findMany({
      where: { versionId },
      orderBy: { order: "asc" },
      include: { aspects: { orderBy: { order: "asc" }, include: { indicators: { where: { deletedAt: null }, orderBy: { order: "asc" }, select: { id: true, code: true } } } } },
    }),
    prisma.indicatorScore.findMany({ where: { assessmentId } }),
  ]);
  const byIndicator = new Map(scores.map((s) => [s.indicatorId, s]));
  const domainW = weights.byGroup.get("DOMAIN");
  return {
    weightsSessionId: weights.sessionId,
    domains: domains.map((d) => ({
      domainCode: d.code,
      weight: domainW?.get(d.code) ?? (domains.length === 1 ? 1 : NaN),
      aspects: d.aspects.map((a) => ({
        aspectCode: a.code,
        localWeight: d.aspects.length === 1 ? 1 : (weights.byGroup.get(`ASPECT/${d.code}`)?.get(a.code) ?? NaN),
        indicators: a.indicators.map((i) => {
          const s = byIndicator.get(i.id)!;
          return { indicatorCode: i.code, level: s.level, missingKind: s.missingKind as MissingKind };
        }),
      })),
    })),
  };
}

export async function saveScore(assessmentId: string, indicatorId: string, row: ScoreRow) {
  const prisma = await db();
  const data = {
    level: row.level,
    missingKind: row.missingKind,
    satisfiedEvidence: row.satisfiedEvidence,
    levelCap: row.levelCap,
    evidenceLocator: row.evidenceLocator,
    rationale: row.rationale,
    promptId: row.log.promptId,
    promptVersion: row.log.promptVersion,
    modelId: row.log.modelId,
    promptHash: row.log.promptHash,
    tokensIn: row.log.tokensIn,
    tokensOut: row.log.tokensOut,
    error: null,
  };
  await prisma.indicatorScore.upsert({ where: { assessmentId_indicatorId: { assessmentId, indicatorId } }, create: { assessmentId, indicatorId, ...data }, update: data });
  const a = await prisma.assessment.findUniqueOrThrow({ where: { id: assessmentId }, select: { versionId: true, _count: { select: { scores: true } } } });
  const total = await prisma.indicator.count({ where: { aspect: { domain: { versionId: a.versionId } }, deletedAt: null } });
  if (a._count.scores < total) return { done: false as const };
  return { done: true as const, rollup: await finalizeAssessment(assessmentId) };
}

/** Rollup with lib/method computeIndex once every live indicator is scored. */
export async function finalizeAssessment(assessmentId: string) {
  const prisma = await db();
  const a = await prisma.assessment.findUniqueOrThrow({ where: { id: assessmentId }, select: { versionId: true } });
  const { domains, weightsSessionId } = await scoringInput(a.versionId, assessmentId);
  const rollup: ScoringResult = computeIndex(domains);
  await prisma.$transaction([
    prisma.assessment.update({
      where: { id: assessmentId },
      data: { status: "COMPLETED", endedAt: new Date(), error: null, weightsSessionId, rollup: { ...rollup, input: domains } as unknown as Prisma.InputJsonValue },
    }),
    prisma.auditEvent.create({ data: { actorKind: "SYSTEM", action: "ASSESSMENT_ROLLUP", targetType: "Assessment", targetId: assessmentId, payload: { composite: rollup.composite, missing: rollup.missingReport.length } } }),
  ]);
  return rollup;
}

// ── Recompute export (SPECIFICATION §3.14, docs/05 §7) ───────────────

/**
 * Deterministic export (no timestamps) so the same data always yields the
 * same bytes and SHA-256: the recompute report is accepted only for them.
 */
export async function buildRecomputeExport(versionId: string) {
  const prisma = await db();
  const version = await prisma.artifactVersion.findUniqueOrThrow({ where: { id: versionId }, select: { label: true } });

  // Delphi data lives on the version the lock was taken from (or this one).
  const lineage: { id: string; label: string }[] = [];
  for (let id: string | null = versionId; id; ) {
    const v: { id: string; label: string; parentId: string | null } | null = await prisma.artifactVersion.findUnique({ where: { id }, select: { id: true, label: true, parentId: true } });
    if (!v) break;
    lineage.push({ id: v.id, label: v.label });
    id = v.parentId;
  }
  let delphiVersionId: string | null = null;
  for (const v of lineage) {
    if (await prisma.delphiRound.count({ where: { versionId: v.id, finalizedAt: { not: null } } })) {
      delphiVersionId = v.id;
      break;
    }
  }
  const delphiItems = [];
  if (delphiVersionId) {
    const rounds = await prisma.delphiRound.findMany({
      where: { versionId: delphiVersionId, finalizedAt: { not: null } },
      orderBy: { roundNumber: "asc" },
      include: { results: true, ratings: { select: { indicatorId: true, seatIndex: true, relevance: true } } },
    });
    const codes = new Map((await prisma.indicator.findMany({ where: { aspect: { domain: { versionId: delphiVersionId } } }, select: { id: true, code: true } })).map((i) => [i.id, i.code]));
    for (const r of rounds) {
      for (const res of [...r.results].sort((x, y) => (codes.get(x.indicatorId) ?? "").localeCompare(codes.get(y.indicatorId) ?? ""))) {
        const ratings = Array.from({ length: r.panelSize }, (_, i) => r.ratings.find((x) => x.indicatorId === res.indicatorId && x.seatIndex === i + 1)?.relevance ?? null);
        delphiItems.push({
          indicatorCode: codes.get(res.indicatorId),
          round: r.roundNumber,
          ratings,
          clarityCritical: res.clarityCritical === true,
          constructConflict: res.constructConflict,
          reported: { iCvi: res.iCvi, median: res.median, iqr: res.iqr, validRaters: res.validRaters, decision: res.decision },
        });
      }
    }
  }

  const ahp = await evaluateAhpGateFor(versionId);
  const ahpMatrices = [];
  const ahpAggregates = [];
  if (ahp.sessionId) {
    const session = await prisma.ahpSession.findUniqueOrThrow({ where: { id: ahp.sessionId }, include: { matrices: true, weights: { where: { archived: false } } } });
    const latest = new Map<string, (typeof session.matrices)[number]>();
    for (const m of session.matrices) {
      const k = `${groupKey(m.level, m.parentCode)}|${m.seatIndex}`;
      if (!latest.has(k) || latest.get(k)!.attempt < m.attempt) latest.set(k, m);
    }
    const rows = [...latest.values()].filter((m) => m.cells).sort((a, b) => groupKey(a.level, a.parentCode).localeCompare(groupKey(b.level, b.parentCode)) || a.seatIndex - b.seatIndex);
    for (const m of rows) {
      const w = m.elements.map((code) => session.weights.find((x) => x.seatIndex === m.seatIndex && x.targetCode === code && groupKey(x.level, x.parentCode) === groupKey(m.level, m.parentCode))?.weight ?? null);
      ahpMatrices.push({ group: groupKey(m.level, m.parentCode), seatIndex: m.seatIndex, cells: m.cells, reported: { lambdaMax: m.lambdaMax, ci: m.ci, cr: m.cr, weights: w } });
    }
    for (const key of [...new Set(rows.map((m) => groupKey(m.level, m.parentCode)))]) {
      const inGroup = rows.filter((m) => groupKey(m.level, m.parentCode) === key);
      const accepted = inGroup.filter((m) => m.status === "ACCEPTED");
      const elements = inGroup[0].elements;
      const agg = elements.map((code) => session.weights.find((x) => x.seatIndex === null && x.targetCode === code && groupKey(x.level, x.parentCode) === key)?.weight ?? null);
      if (agg.every((x) => x !== null)) ahpAggregates.push({ group: key, matrices: inGroup.map((m) => m.cells), reported: { weights: agg, included: accepted.length } });
    }
  }

  const assessments = (await prisma.assessment.findMany({ where: { versionId, status: "COMPLETED", dataOrigin: "SIMULATED" }, orderBy: { createdAt: "asc" } })).map((a) => {
    const r = a.rollup as unknown as ScoringResult & { input: DomainScoreInput[] };
    return {
      id: a.id,
      institution: a.institutionLabel,
      weightsSessionId: a.weightsSessionId,
      domains: r.input.map((d) => ({ ...d, aspects: d.aspects.map((x) => ({ ...x, indicators: x.indicators.map((i) => ({ code: i.indicatorCode, level: i.level, missingKind: i.missingKind })) })) })),
      reported: { composite: r.composite, domainProfile: r.domainProfile },
    };
  });

  const doc = {
    _warning: EXPORT_WARNING,
    _dataOrigin: "SIMULATED",
    version: version.label,
    lineage: lineage.map((v) => v.label),
    tolerance: 1e-6,
    delphiItems,
    ahpMatrices,
    ahpAggregates,
    assessments,
  };
  const json = `${JSON.stringify(doc, null, 2)}\n`;
  return { json, sha256: createHash("sha256").update(json, "utf8").digest("hex"), filename: `SIM_recompute_${version.label}.json` };
}

const ReportSchema = z.object({
  tool: z.literal("scripts/recompute.py"),
  exportSha256: z.string().regex(/^[0-9a-f]{64}$/),
  tolerance: z.number(),
  ok: z.boolean(),
  diffCount: z.number().int().min(0),
  diffs: z.array(z.string()),
  counts: z.record(z.string(), z.number()),
  python: z.string(),
  numpy: z.string(),
});

/** Accepts a recompute report only for the export the app can regenerate now. */
export async function saveRecomputeReport(actorId: string, versionId: string, raw: string) {
  let parsed: z.infer<typeof ReportSchema>;
  try {
    parsed = ReportSchema.parse(JSON.parse(raw));
  } catch {
    throw new ScoringError("INVALID", "Berkas bukan laporan scripts/recompute.py --report.");
  }
  if (parsed.tolerance > 1e-6) throw new ScoringError("INVALID", "Toleransi laporan lebih longgar dari 1e-6 (docs/05 §7).");
  const current = await buildRecomputeExport(versionId);
  if (parsed.exportSha256 !== current.sha256) throw new ScoringError("CONFLICT", "Laporan dibuat untuk ekspor lain atau data sudah berubah; unduh ekspor terbaru dan jalankan ulang.", ["RECOMPUTE_STALE"]);
  if (parsed.ok !== (parsed.diffCount === 0) || parsed.diffCount !== parsed.diffs.length) throw new ScoringError("INVALID", "Laporan tidak konsisten.");
  const prisma = await db();
  await prisma.$transaction([
    prisma.recomputeCheck.create({ data: { versionId, exportSha256: parsed.exportSha256, ok: parsed.ok, diffCount: parsed.diffCount, report: parsed as unknown as Prisma.InputJsonValue, uploadedById: actorId } }),
    prisma.auditEvent.create({ data: { actorId, actorKind: "USER", action: "RECOMPUTE_REPORT", targetType: "ArtifactVersion", targetId: versionId, payload: { exportSha256: parsed.exportSha256, ok: parsed.ok, diffCount: parsed.diffCount } } }),
  ]);
  return parsed;
}

/** G6 input (docs/05 §6). */
export async function evaluateScoringGateFor(versionId: string) {
  const prisma = await db();
  const [version, g5, weights, rows, check, current] = await Promise.all([
    prisma.artifactVersion.findUniqueOrThrow({ where: { id: versionId }, select: { status: true } }),
    prisma.gateRecord.findUnique({ where: { versionId_gate: { versionId, gate: "G5_AHP" } } }),
    g5Weights(versionId),
    prisma.assessment.findMany({ where: { versionId, dataOrigin: "SIMULATED" }, include: { scores: { select: { missingKind: true } } } }),
    prisma.recomputeCheck.findFirst({ where: { versionId }, orderBy: { createdAt: "desc" } }),
    buildRecomputeExport(versionId),
  ]);
  const assessments: ScoringGateAssessment[] = rows.map((a) => {
    const r = a.rollup as unknown as ScoringResult | null;
    return {
      id: a.id,
      status: a.status,
      weightsSessionId: a.weightsSessionId,
      missingAdmin: a.scores.some((s) => s.missingKind === "MISSING_ADMINISTRATIF"),
      noCapability: a.scores.some((s) => s.missingKind === "TIDAK_ADA_KAPABILITAS"),
      compositeNull: r ? r.composite === null : true,
      missingReportCount: r?.missingReport.length ?? 0,
    };
  });
  return {
    ...evaluateScoringGate({
      contentLocked: version.status === "CONTENT_LOCKED",
      g5Passed: g5?.status === "PASSED",
      weightsSessionId: weights?.sessionId ?? null,
      assessments,
      recompute: check ? { exportSha256: check.exportSha256, ok: check.ok, diffCount: check.diffCount } : null,
      currentExportSha256: current.sha256,
    }),
    exportSha256: current.sha256,
    lastCheck: check,
  };
}


/** G5 weights as plain records, for the what-if calculator (null before G5). */
export async function getScoringWeights(versionId: string) {
  const w = await g5Weights(versionId);
  if (!w) return null;
  const aspect: Record<string, Record<string, number>> = {};
  for (const [key, map] of w.byGroup) if (key.startsWith("ASPECT/")) aspect[key.slice(7)] = Object.fromEntries(map);
  return { sessionId: w.sessionId, domain: Object.fromEntries(w.byGroup.get("DOMAIN") ?? new Map()), aspect };
}

export async function getAssessmentView(assessmentId: string) {
  const prisma = await db();
  const a = await prisma.assessment.findUnique({
    where: { id: assessmentId },
    include: { profile: true, scores: { include: { indicator: { select: { code: true, name: true, aspect: { select: { order: true, domain: { select: { order: true } } } }, order: true } } } } },
  });
  if (!a) return null;
  const [version, total, domains] = await Promise.all([
    prisma.artifactVersion.findUniqueOrThrow({ where: { id: a.versionId }, select: { label: true } }),
    prisma.indicator.count({ where: { aspect: { domain: { versionId: a.versionId } }, deletedAt: null } }),
    prisma.domain.findMany({ where: { versionId: a.versionId }, orderBy: { order: "asc" }, select: { code: true, name: true } }),
  ]);
  const scores = [...a.scores].sort(
    (x, y) => x.indicator.aspect.domain.order - y.indicator.aspect.domain.order || x.indicator.aspect.order - y.indicator.aspect.order || x.indicator.order - y.indicator.order,
  );
  return { assessment: a, version, total, domains, scores };
}
