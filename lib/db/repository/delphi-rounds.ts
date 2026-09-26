import type { Prisma } from "@/generated/prisma/client";
import type { BriefIndicator } from "@/lib/fgd/component-brief";
import { METHOD } from "@/lib/method/constants";
import { buildRoundFeedback, computeItemCvi, computeScaleCvi } from "@/lib/method/cvi";
import type { DelphiDecision, Relevance } from "@/lib/method/types";

import { db } from "../client";
import { assertSingleOrigin } from "../origin";
import { latestFinalizedResults } from "./delphi-gate";
import { evaluateFgdGateFor } from "./fgd-gate";
import { recordEvaluation } from "./gates";
import { listPanelsForEditor } from "./panel-admin";

export class DelphiError extends Error {
  constructor(
    readonly code: "GATE" | "PANEL" | "STATE" | "INVALID" | "NOT_FOUND",
    message: string,
    readonly details?: string[],
  ) {
    super(message);
    this.name = "DelphiError";
  }
}

export interface DelphiRoundSettings {
  promptVersions: Record<string, string>;
  estimatedCalls: number;
  /** R1 only: FGD outcome per indicator code, shown to FULL seats (snapshot of what seats saw). */
  fgdContext: Record<string, string>;
}

const seatsIn = (n: number) => Array.from({ length: n }, (_, i) => i + 1);

/**
 * What the next round would be (SPECIFICATION §4.6): R1 = every indicator;
 * R2/R3 = items whose latest decision is REVISI_NILAI_ULANG. `blocked` lists
 * why it cannot start; `warnings` never block.
 */
export async function planNextRound(versionId: string, origin: "SIMULATED" | "REAL" = "SIMULATED") {
  const prisma = await db();
  const version = await prisma.artifactVersion.findUniqueOrThrow({
    where: { id: versionId },
    include: { gates: { select: { gate: true, status: true } }, delphiRounds: { orderBy: { roundNumber: "asc" }, select: { roundNumber: true, finalizedAt: true, dataOrigin: true } } },
  });
  const blocked: string[] = [];
  const warnings: string[] = [];
  // Researcher decision 2026-09-26: one version = one Delphi origin; SIMULATED and REAL rounds never share a version.
  if (version.delphiRounds.some((r) => r.dataOrigin !== origin)) blocked.push("DELPHI_ORIGIN_CONFLICT");
  // Researcher decision 2026-09-26: Delphi rates the derived post-FGD version.
  if (!version.parentId || version.status !== "DRAFT") blocked.push("DELPHI_NEEDS_DERIVED_DRAFT");
  const passed = (g: string) => version.gates.find((x) => x.gate === g)?.status === "PASSED";
  if (!passed("G1_BASELINE")) blocked.push("G1_BASELINE");
  if (!passed("G2_FGD")) blocked.push("G2_FGD");
  const open = version.delphiRounds.find((r) => !r.finalizedAt);
  if (open) blocked.push(`DELPHI_ROUND_OPEN: R${open.roundNumber}`);
  const last = version.delphiRounds.at(-1)?.roundNumber ?? 0;
  const roundNumber = last + 1;
  if (roundNumber > METHOD.MAX_ROUNDS) blocked.push("DELPHI_MAX_ROUNDS");

  const indicators = await prisma.indicator.findMany({
    where: { aspect: { domain: { versionId } }, deletedAt: null },
    orderBy: [{ aspect: { domain: { order: "asc" } } }, { aspect: { order: "asc" } }, { order: "asc" }],
    select: { code: true },
  });
  let scopeCodes = indicators.map((i) => i.code);
  if (roundNumber > 1) {
    const latest = new Map<string, { decision: DelphiDecision; roundNumber: number }>();
    for (const r of await latestFinalizedResults(versionId)) {
      const prior = latest.get(r.code);
      if (!prior || r.roundNumber > prior.roundNumber) latest.set(r.code, { decision: r.decision as DelphiDecision, roundNumber: r.roundNumber });
    }
    scopeCodes = scopeCodes.filter((c) => latest.get(c)?.decision === "REVISI_NILAI_ULANG");
    const prev = version.delphiRounds.find((r) => r.roundNumber === last);
    if (prev?.finalizedAt && scopeCodes.length) {
      const edited = new Set(
        (await prisma.changeLogEntry.findMany({ where: { versionId, createdAt: { gt: prev.finalizedAt }, targetCode: { in: scopeCodes } }, select: { targetCode: true } })).map((c) => c.targetCode),
      );
      const untouched = scopeCodes.filter((c) => !edited.has(c));
      if (untouched.length) warnings.push(`NOT_REVISED_SINCE_R${last}: ${untouched.join(", ")}`);
    }
  }
  if (scopeCodes.length === 0 && !blocked.includes("DELPHI_MAX_ROUNDS") && !blocked.includes("DELPHI_ORIGIN_CONFLICT")) blocked.push("DELPHI_NOTHING_TO_RATE");
  return { roundNumber, scopeCodes, blocked, warnings, estimatedCalls: scopeCodes.length * METHOD.DELPHI_PANEL_SIZE };
}

/** FGD outcome per indicator from the parent's counted G2 results, for FULL seats in R1. */
async function fgdContextFor(versionId: string): Promise<Record<string, string>> {
  const prisma = await db();
  const version = await prisma.artifactVersion.findUniqueOrThrow({ where: { id: versionId }, select: { parentId: true } });
  if (!version.parentId) return {};
  const { counted } = await evaluateFgdGateFor(version.parentId);
  const items = await prisma.fgdItem.findMany({
    where: { id: { in: counted }, targetType: { in: ["INDICATOR", "RUBRIC"] } },
    include: { stage: { select: { title: true } }, decision: true },
  });
  const out: Record<string, string[]> = {};
  for (const i of items) {
    if (!i.decision) continue;
    const t = i.decision.tally as Record<string, number>;
    (out[i.targetCode] ??= []).push(
      `Tahap ${i.stage.title}: ${i.decision.decision} (terima ${t.TERIMA ?? 0}, terima dengan revisi ${t.TERIMA_DENGAN_REVISI ?? 0}, tolak ${t.TOLAK ?? 0})`,
    );
  }
  return Object.fromEntries(Object.entries(out).map(([k, v]) => [k, v.join("\n")]));
}

export async function createDelphiRound(input: { actorId: string; versionId: string; configId: string; seed: number; promptVersions: Record<string, string>; budgetUsd?: number | null; runId?: string | null }) {
  const plan = await planNextRound(input.versionId);
  if (plan.blocked.length) throw new DelphiError("GATE", "Ronde belum dapat dibuat.", plan.blocked);
  const panel = (await listPanelsForEditor()).find((p) => p.id === input.configId);
  if (!panel || panel.preset !== "DELPHI_8") throw new DelphiError("PANEL", "Pilih panel berpreset DELPHI_8.");
  if (!panel.validation.ready) throw new DelphiError("PANEL", "Panel belum siap.", panel.validation.issues.map((i) => i.code));

  const settings: DelphiRoundSettings = {
    promptVersions: input.promptVersions,
    estimatedCalls: plan.estimatedCalls,
    fgdContext: plan.roundNumber === 1 ? await fgdContextFor(input.versionId) : {},
  };
  const prisma = await db();
  return prisma.$transaction(async (tx) => {
    const round = await tx.delphiRound.create({
      data: {
        versionId: input.versionId,
        configId: panel.id,
        // Everything an AI panel writes is SIMULATED (docs/07 P1).
        dataOrigin: "SIMULATED",
        roundNumber: plan.roundNumber,
        status: "QUEUED",
        panelSize: METHOD.DELPHI_PANEL_SIZE,
        seed: input.seed,
        budgetUsd: input.budgetUsd ?? null,
        runId: input.runId ?? null,
        settings: settings as unknown as Prisma.InputJsonValue,
        scopeCodes: plan.scopeCodes,
        createdById: input.actorId,
      },
    });
    await tx.auditEvent.create({
      data: { actorId: input.actorId, actorKind: "USER", action: "DELPHI_ROUND_CREATE", targetType: "DelphiRound", targetId: round.id, payload: { round: plan.roundNumber, items: plan.scopeCodes.length, warnings: plan.warnings } },
    });
    return round.id;
  });
}

export async function loadDelphiRunContext(roundId: string) {
  const prisma = await db();
  return prisma.delphiRound.findUniqueOrThrow({
    where: { id: roundId },
    include: {
      version: { select: { id: true } },
      config: { include: { seats: { orderBy: { seatIndex: "asc" }, include: { expert: { include: { persona: true } }, modelProfile: { include: { provider: true } } } } } },
      results: { select: { indicatorId: true } },
    },
  });
}

/** Next indicator in scope without a result, with everything its seats may see. */
export async function nextDelphiItem(roundId: string) {
  const prisma = await db();
  const round = await prisma.delphiRound.findUniqueOrThrow({ where: { id: roundId }, include: { results: { select: { indicatorId: true } } } });
  const indicators = await prisma.indicator.findMany({
    where: { aspect: { domain: { versionId: round.versionId } }, code: { in: round.scopeCodes }, deletedAt: null },
    include: { aspect: { include: { domain: true } }, rubricLevels: true, evidence: true },
  });
  const done = new Set(round.results.map((r) => r.indicatorId));
  const code = round.scopeCodes.find((c) => indicators.some((i) => i.code === c && !done.has(i.id)));
  if (!code) return null;
  const ind = indicators.find((i) => i.code === code)!;
  const brief: BriefIndicator = {
    code: ind.code,
    name: ind.name,
    isControlledException: ind.isControlledException,
    operationalDefinition: ind.operationalDefinition,
    assessmentObject: ind.assessmentObject,
    boundaryNote: ind.boundaryNote,
    rubric: ind.rubricLevels.map((r) => ({ level: r.level, label: r.label, descriptor: r.descriptor })),
    evidence: ind.evidence.map((e) => ({ kind: e.kind, minimumFor: e.minimumFor, mandatory: e.mandatory, description: e.description })),
  };

  let previous: { ratings: Relevance[]; revised: boolean } | null = null;
  if (round.roundNumber > 1) {
    const prev = await prisma.delphiRound.findUniqueOrThrow({ where: { versionId_roundNumber: { versionId: round.versionId, roundNumber: round.roundNumber - 1 } } });
    const rows = await prisma.delphiRating.findMany({ where: { roundId: prev.id, indicatorId: ind.id } });
    const ratings = seatsIn(prev.panelSize).map((s) => (rows.find((r) => r.seatIndex === s)?.relevance ?? null) as Relevance);
    const revised = prev.finalizedAt ? (await prisma.changeLogEntry.count({ where: { versionId: round.versionId, targetCode: code, createdAt: { gt: prev.finalizedAt } } })) > 0 : false;
    previous = { ratings, revised };
  }
  const existing = await prisma.delphiRating.findMany({ where: { roundId, indicatorId: ind.id } });
  return {
    indicatorId: ind.id,
    code,
    domainAspect: `${ind.aspect.domain.code} ${ind.aspect.domain.name} / ${ind.aspect.code} ${ind.aspect.name}`,
    brief,
    previous,
    /** Seats already rated validly (retry only re-calls the rest). */
    rated: new Set(existing.filter((r) => r.relevance !== null).map((r) => r.seatIndex)),
  };
}

export interface SeatRatingRow {
  seatIndex: number;
  relevance: number | null;
  reason: string | null;
  clarityFlag: boolean;
  clarityNote: string | null;
  error: string | null;
  log: { promptId: string; promptVersion: string; modelId: string; promptHash: string; tokensIn: number | null; tokensOut: number | null; latencyMs: number } | null;
}

/**
 * Stores the seat ratings of one item. With all seats valid the item result
 * is computed by lib/method (clarity not yet reviewed → not critical);
 * otherwise the round stops — §3.8.3, the 7/8 rule is never applied.
 */
export async function saveDelphiItem(roundId: string, indicatorId: string, code: string, rows: SeatRatingRow[]) {
  const prisma = await db();
  return prisma.$transaction(async (tx) => {
    const round = await tx.delphiRound.findUniqueOrThrow({ where: { id: roundId } });
    for (const r of rows) {
      const data = {
        relevance: r.relevance,
        reason: r.reason,
        clarityFlag: r.clarityFlag,
        clarityNote: r.clarityNote,
        error: r.error,
        promptId: r.log?.promptId ?? null,
        promptVersion: r.log?.promptVersion ?? null,
        modelId: r.log?.modelId ?? null,
        promptHash: r.log?.promptHash ?? null,
        tokensIn: r.log?.tokensIn ?? null,
        tokensOut: r.log?.tokensOut ?? null,
        latencyMs: r.log?.latencyMs ?? null,
      };
      await tx.delphiRating.upsert({
        where: { roundId_indicatorId_seatIndex: { roundId, indicatorId, seatIndex: r.seatIndex } },
        create: { roundId, indicatorId, seatIndex: r.seatIndex, dataOrigin: round.dataOrigin, ...data },
        update: data,
      });
    }
    const all = await tx.delphiRating.findMany({ where: { roundId, indicatorId } });
    // docs/07 P2: SIMULATED and REAL ratings are never aggregated together.
    assertSingleOrigin(all);
    const ratings = seatsIn(round.panelSize).map((s) => (all.find((r) => r.seatIndex === s)?.relevance ?? null) as Relevance);
    const valid = ratings.filter((r) => r !== null).length;
    if (valid !== round.panelSize) {
      const error = `DEVIASI PANEL: ${code} n=${valid} dari ${round.panelSize} — ronde dihentikan (§3.8.3).`;
      await tx.delphiRound.update({ where: { id: roundId }, data: { status: "FAILED", error } });
      return { deviation: true as const, error };
    }
    const result = computeItemCvi({ indicatorCode: code, ratings, round: round.roundNumber }, round.panelSize);
    await tx.delphiItemResult.upsert({
      where: { roundId_indicatorId: { roundId, indicatorId } },
      create: { roundId, indicatorId, iCvi: result.iCvi, median: result.median, iqr: result.iqr, validRaters: result.validRaters, decision: result.decision, reason: result.reasons.join("; "), clarityFlags: all.filter((r) => r.clarityFlag).length },
      update: { iCvi: result.iCvi, median: result.median, iqr: result.iqr, validRaters: result.validRaters, decision: result.decision, reason: result.reasons.join("; "), clarityFlags: all.filter((r) => r.clarityFlag).length },
    });
    const remaining = round.scopeCodes.length - (await tx.delphiItemResult.count({ where: { roundId } }));
    if (remaining === 0) {
      const results = await tx.delphiItemResult.findMany({ where: { roundId } });
      await tx.delphiRound.update({ where: { id: roundId }, data: { status: "COMPLETED", endedAt: new Date(), error: null, scaleSCviAve: computeScaleCvi(results).sCviAve } });
    }
    return { deviation: false as const, decision: result.decision, roundDone: remaining === 0 };
  });
}

export async function setDelphiRoundStatus(actorId: string | null, roundId: string, action: "START" | "PAUSE" | "RETRY") {
  const prisma = await db();
  const round = await prisma.delphiRound.findUniqueOrThrow({ where: { id: roundId } });
  if (round.finalizedAt || round.status === "COMPLETED") return round.status;
  const status = action === "START" ? "RUNNING" : "PAUSED";
  if (action === "START" && round.status === "FAILED") return round.status;
  await prisma.delphiRound.update({
    where: { id: roundId },
    data: { status, ...(action === "START" && !round.startedAt ? { startedAt: new Date() } : {}), ...(action === "RETRY" ? { error: null } : {}) },
  });
  if (actorId && action !== "START") {
    await prisma.auditEvent.create({ data: { actorId, actorKind: "USER", action: `DELPHI_ROUND_${action}`, targetType: "DelphiRound", targetId: roundId, payload: {} } });
  }
  return status;
}

/**
 * Researcher review of one item (docs/05 §6 G3): clarity critical or not,
 * construct conflict, note. The decision is recomputed by lib/method.
 */
export async function reviewDelphiItem(actorId: string, resultId: string, input: { clarityCritical: boolean | null; constructConflict: boolean; note: string | null }) {
  const prisma = await db();
  const res = await prisma.delphiItemResult.findUniqueOrThrow({ where: { id: resultId }, include: { round: true } });
  if (res.round.finalizedAt) throw new DelphiError("STATE", "Ronde sudah final; tinjauan tidak dapat diubah.");
  if (res.clarityFlags > 0 && input.clarityCritical === null) throw new DelphiError("INVALID", "Tentukan apakah isu kejelasan kritis.");
  const rows = await prisma.delphiRating.findMany({ where: { roundId: res.roundId, indicatorId: res.indicatorId } });
  assertSingleOrigin(rows);
  const ratings = seatsIn(res.round.panelSize).map((s) => (rows.find((r) => r.seatIndex === s)?.relevance ?? null) as Relevance);
  const code = (await prisma.indicator.findUniqueOrThrow({ where: { id: res.indicatorId }, select: { code: true } })).code;
  const result = computeItemCvi(
    { indicatorCode: code, ratings, round: res.round.roundNumber, clarityCritical: input.clarityCritical === true, constructConflict: input.constructConflict },
    res.round.panelSize,
  );
  // docs/05 §3.3: HAPUS_DARI_INTI needs a construct reason from the researcher.
  if (result.decision === "HAPUS_DARI_INTI" && !(input.note ?? "").trim()) throw new DelphiError("INVALID", "Hapus dari inti wajib disertai alasan konstruk peneliti.");
  await prisma.$transaction([
    prisma.delphiItemResult.update({
      where: { id: resultId },
      data: {
        clarityCritical: input.clarityCritical,
        constructConflict: input.constructConflict,
        researcherNote: input.note,
        decision: result.decision,
        reason: result.reasons.join("; "),
        reviewedById: actorId,
        reviewedAt: new Date(),
      },
    }),
    prisma.auditEvent.create({
      data: { actorId, actorKind: "USER", action: "DELPHI_ITEM_REVIEW", targetType: "DelphiItemResult", targetId: resultId, payload: { code, clarityCritical: input.clarityCritical, constructConflict: input.constructConflict, decision: result.decision } },
    }),
  ]);
  return result.decision;
}

export async function finalizeDelphiRound(actorId: string, roundId: string) {
  const prisma = await db();
  const round = await prisma.delphiRound.findUniqueOrThrow({ where: { id: roundId }, include: { results: true } });
  if (round.finalizedAt) return;
  if (round.status !== "COMPLETED") throw new DelphiError("STATE", "Ronde belum selesai dikumpulkan.");
  const unreviewed = round.results.filter((r) => r.clarityFlags > 0 && r.clarityCritical === null).length;
  const noReason = round.results.filter((r) => r.decision === "HAPUS_DARI_INTI" && !r.researcherNote?.trim()).length;
  const blocked = [...(unreviewed ? [`DELPHI_CLARITY_UNREVIEWED: ${unreviewed}`] : []), ...(noReason ? [`REMOVAL_WITHOUT_REASON: ${noReason}`] : [])];
  if (blocked.length) throw new DelphiError("INVALID", "Tinjauan peneliti belum lengkap.", blocked);
  await prisma.$transaction([
    prisma.delphiRound.update({ where: { id: roundId }, data: { finalizedAt: new Date(), finalizedById: actorId, scaleSCviAve: computeScaleCvi(round.results).sCviAve } }),
    prisma.auditEvent.create({ data: { actorId, actorKind: "USER", action: "DELPHI_ROUND_FINALIZE", targetType: "DelphiRound", targetId: roundId, payload: { round: round.roundNumber } } }),
  ]);
  await recordEvaluation(round.versionId, "G3_DELPHI", `Evaluasi otomatis setelah R${round.roundNumber} difinalisasi.`);
}

/** Round room: progress, per-item results with review state. */
export async function getDelphiRoundView(roundId: string) {
  const prisma = await db();
  const round = await prisma.delphiRound.findUnique({
    where: { id: roundId },
    include: {
      version: { select: { id: true, label: true } },
      config: { select: { name: true, seats: { orderBy: { seatIndex: "asc" }, select: { seatIndex: true, label: true, field: true, isNewMember: true, contextScope: true, modelProfile: { select: { label: true } } } } } },
      results: true,
      ratings: { select: { indicatorId: true, seatIndex: true, relevance: true, clarityFlag: true, clarityNote: true, reason: true, error: true, tokensIn: true, tokensOut: true } },
    },
  });
  if (!round) return null;
  const indicators = await prisma.indicator.findMany({ where: { aspect: { domain: { versionId: round.versionId } }, code: { in: round.scopeCodes } }, select: { id: true, code: true, name: true } });
  const byCode = new Map(indicators.map((i) => [i.code, i]));
  const items = round.scopeCodes.map((code) => {
    const ind = byCode.get(code);
    const result = ind ? round.results.find((r) => r.indicatorId === ind.id) ?? null : null;
    const ratings = ind ? round.ratings.filter((r) => r.indicatorId === ind.id) : [];
    return { code, indicatorId: ind?.id ?? null, name: ind?.name ?? code, result, ratings };
  });
  return { round, items };
}

/**
 * docs/04 §7: what each seat is shown between rounds — own score, median,
 * IQR, and distribution; never another seat's answer or identity.
 */
export async function getRoundFeedback(roundId: string) {
  const view = await getDelphiRoundView(roundId);
  if (!view) return null;
  const seats = seatsIn(view.round.panelSize);
  return {
    round: view.round,
    items: view.items.map((item) => {
      const ratings = seats.map((s) => (item.ratings.find((r) => r.seatIndex === s)?.relevance ?? null) as Relevance);
      const complete = ratings.every((r) => r !== null);
      return { code: item.code, name: item.name, perSeat: complete ? seats.map((s) => ({ seatIndex: s, ...buildRoundFeedback(ratings, s) })) : null };
    }),
  };
}

export async function failDelphiRound(roundId: string, error: string) {
  const prisma = await db();
  await prisma.delphiRound.update({ where: { id: roundId }, data: { status: "FAILED", error } });
}
