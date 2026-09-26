import type { Prisma } from "@/generated/prisma/client";
import type { SensitivityScenarioSpec } from "@/lib/ahp/scenarios";
import { aggregateGeometric, expectedAhpGroups, mostInconsistentPairs, priorityVector, sensitivity } from "@/lib/method/ahp";
import { METHOD } from "@/lib/method/constants";
import { evaluateAhpGate, type AhpGroupInput, type AhpMatrixStatus } from "@/lib/method/gates";
import type { Matrix, PriorityResult } from "@/lib/method/types";

import { db } from "../client";
import { listPanelsForEditor } from "./panel-admin";

export class AhpError extends Error {
  constructor(
    readonly code: "GATE" | "PANEL" | "INVALID",
    message: string,
    readonly details?: string[],
  ) {
    super(message);
    this.name = "AhpError";
  }
}

/** Docs/04 §8: at most two review rounds after the first fill. */
export const AHP_MAX_REVIEWS = 2;

export type SeatScope = "BOTH" | "DOMAIN" | "ASPECT";

export interface AhpSessionSettings {
  seatScopes: Record<string, SeatScope>;
  scenarios: SensitivityScenarioSpec[];
  promptVersions: Record<string, string>;
  estimatedCalls: number;
}

export interface AhpGroupSpec {
  key: string;
  level: "DOMAIN" | "ASPECT";
  parentCode: string | null;
  label: string;
  elements: { code: string; name: string; rationale: string | null }[];
}

export interface PairRecord {
  i: number;
  j: number;
  preferred: "A" | "B" | "EQUAL";
  intensity: number;
  reason: string;
  attempt: number;
  promptId: string;
  modelId: string;
  tokensIn: number | null;
  tokensOut: number | null;
}

export const groupKey = (level: string, parentCode: string | null) => (level === "DOMAIN" ? "DOMAIN" : `ASPECT/${parentCode}`);

/** Matrix groups of a version with their elements (expectedAhpGroups decides which exist). */
export async function ahpGroupsFor(versionId: string): Promise<AhpGroupSpec[]> {
  const prisma = await db();
  const domains = await prisma.domain.findMany({ where: { versionId }, orderBy: { order: "asc" }, include: { aspects: { orderBy: { order: "asc" } } } });
  const keys = new Set(expectedAhpGroups(domains.map((d) => ({ code: d.code, aspects: d.aspects.map((a) => a.code) }))));
  const out: AhpGroupSpec[] = [];
  if (keys.has("DOMAIN")) {
    out.push({ key: "DOMAIN", level: "DOMAIN", parentCode: null, label: "Antar-domain", elements: domains.map((d) => ({ code: d.code, name: d.name, rationale: d.rationale })) });
  }
  for (const d of domains) {
    if (!keys.has(`ASPECT/${d.code}`)) continue;
    out.push({
      key: `ASPECT/${d.code}`,
      level: "ASPECT",
      parentCode: d.code,
      label: `Antar-aspek dalam ${d.code} ${d.name}`,
      elements: d.aspects.map((a) => ({ code: a.code, name: a.name, rationale: a.rationale })),
    });
  }
  return out;
}

const pairCount = (n: number) => (n * (n - 1)) / 2;

export async function planAhpSession(versionId: string) {
  const prisma = await db();
  const version = await prisma.artifactVersion.findUniqueOrThrow({ where: { id: versionId }, include: { gates: { where: { gate: { in: ["G4_CONTENT_LOCK", "G5_AHP"] } } } } });
  const blocked: string[] = [];
  // §3.9.1 / docs/05 §4.4: AHP only on a CONTENT_LOCKED hierarchy.
  if (version.status !== "CONTENT_LOCKED") blocked.push("CONTENT_NOT_LOCKED");
  if (version.gates.find((g) => g.gate === "G4_CONTENT_LOCK")?.status !== "PASSED") blocked.push("G4_CONTENT_LOCK");
  // A passed G5 refers to one session's weights; a new session would change them silently.
  if (version.gates.find((g) => g.gate === "G5_AHP")?.status === "PASSED") blocked.push("G5_ALREADY_PASSED");
  const open = await prisma.ahpSession.findFirst({ where: { versionId, status: { in: ["QUEUED", "RUNNING", "PAUSED", "FAILED"] } }, select: { id: true } });
  if (open) blocked.push("AHP_SESSION_OPEN");
  const groups = await ahpGroupsFor(versionId);
  if (groups.length === 0) blocked.push("NO_AHP_GROUP");
  return { blocked, groups, domainCodes: groups.find((g) => g.key === "DOMAIN")?.elements.map((e) => e.code) ?? [] };
}

export function estimateAhpCalls(groups: AhpGroupSpec[], seatScopes: Record<string, SeatScope>) {
  let calls = 0;
  for (const scope of Object.values(seatScopes)) {
    for (const g of groups) if (scope === "BOTH" || scope === g.level) calls += pairCount(g.elements.length);
  }
  return calls;
}

export async function createAhpSession(input: {
  actorId: string;
  versionId: string;
  configId: string;
  seed: number;
  seatScopes: Record<string, SeatScope>;
  scenarios: SensitivityScenarioSpec[];
  promptVersions: Record<string, string>;
  budgetUsd?: number | null;
  runId?: string | null;
}) {
  const plan = await planAhpSession(input.versionId);
  if (plan.blocked.length) throw new AhpError("GATE", "Sesi AHP belum dapat dibuat.", plan.blocked);
  const panel = (await listPanelsForEditor()).find((p) => p.id === input.configId);
  if (!panel || !["FGD_6", "DELPHI_8"].includes(panel.preset)) throw new AhpError("PANEL", "Pilih panel FGD_6 atau DELPHI_8.");
  if (!panel.validation.ready) throw new AhpError("PANEL", "Panel belum siap.", panel.validation.issues.map((i) => i.code));
  if (input.scenarios.length === 0) throw new AhpError("INVALID", "Daftar skenario sensitivitas kosong.");
  const seats = panel.seats.map((s) => s.seatIndex);
  const uncovered = plan.groups.filter((g) => !seats.some((s) => [g.level, "BOTH"].includes(input.seatScopes[String(s)] ?? "BOTH"))).map((g) => g.key);
  if (uncovered.length) throw new AhpError("INVALID", "Ada grup matriks tanpa kursi pengisi.", uncovered);

  const scopes = Object.fromEntries(seats.map((s) => [String(s), input.seatScopes[String(s)] ?? "BOTH"])) as Record<string, SeatScope>;
  const settings: AhpSessionSettings = { seatScopes: scopes, scenarios: input.scenarios, promptVersions: input.promptVersions, estimatedCalls: estimateAhpCalls(plan.groups, scopes) };
  const prisma = await db();
  return prisma.$transaction(async (tx) => {
    const session = await tx.ahpSession.create({
      data: {
        versionId: input.versionId,
        configId: panel.id,
        dataOrigin: "SIMULATED",
        scope: "DOMAIN+ASPECT",
        status: "QUEUED",
        aggregation: METHOD.AGGREGATION,
        seed: input.seed,
        budgetUsd: input.budgetUsd ?? null,
        runId: input.runId ?? null,
        settings: settings as unknown as Prisma.InputJsonValue,
        createdById: input.actorId,
      },
    });
    for (const s of seats) {
      for (const g of plan.groups) {
        if (scopes[String(s)] !== "BOTH" && scopes[String(s)] !== g.level) continue;
        await tx.ahpMatrix.create({ data: { sessionId: session.id, seatIndex: s, level: g.level, parentCode: g.parentCode, size: g.elements.length, elements: g.elements.map((e) => e.code), status: "PENDING" } });
      }
    }
    await tx.auditEvent.create({ data: { actorId: input.actorId, actorKind: "USER", action: "AHP_SESSION_CREATE", targetType: "AhpSession", targetId: session.id, payload: { seats: seats.length, groups: plan.groups.length, scenarios: input.scenarios.length } } });
    return session.id;
  });
}

export async function loadAhpRunContext(sessionId: string) {
  const prisma = await db();
  return prisma.ahpSession.findUniqueOrThrow({
    where: { id: sessionId },
    include: { config: { include: { seats: { orderBy: { seatIndex: "asc" }, include: { expert: { include: { persona: true } }, modelProfile: { include: { provider: true } } } } } } },
  });
}

export async function nextAhpMatrix(sessionId: string) {
  const prisma = await db();
  return prisma.ahpMatrix.findFirst({ where: { sessionId, status: "PENDING" }, orderBy: [{ seatIndex: "asc" }, { level: "asc" }, { parentCode: "asc" }, { attempt: "asc" }] });
}

export async function setAhpSessionStatus(actorId: string | null, sessionId: string, action: "START" | "PAUSE" | "RETRY" | "FAIL", error?: string) {
  const prisma = await db();
  const s = await prisma.ahpSession.findUniqueOrThrow({ where: { id: sessionId } });
  if (s.status === "COMPLETED" || s.status === "CANCELLED") return;
  if (action === "START" && s.status === "FAILED") return;
  const status = action === "START" ? "RUNNING" : action === "FAIL" ? "FAILED" : "PAUSED";
  await prisma.ahpSession.update({
    where: { id: sessionId },
    data: { status, ...(action === "START" && !s.startedAt ? { startedAt: new Date() } : {}), ...(action === "FAIL" ? { error } : action === "RETRY" ? { error: null } : {}) },
  });
  if (actorId && (action === "PAUSE" || action === "RETRY")) {
    await prisma.auditEvent.create({ data: { actorId, actorKind: "USER", action: `AHP_SESSION_${action}`, targetType: "AhpSession", targetId: sessionId, payload: {} } });
  }
}

/**
 * Stores one filled matrix. CR >= CR_MAX sends it back to the same seat with
 * its most inconsistent pairs — never corrected (§3.9.2) — up to two review
 * rounds; then RETURNED_UNRESOLVED and excluded from aggregation. When no
 * matrix is left, aggregation and sensitivity run (lib/method).
 */
export async function saveAhpMatrix(matrixId: string, pairs: PairRecord[], cells: Matrix, result: PriorityResult) {
  const prisma = await db();
  return prisma.$transaction(
    async (tx) => {
      const m = await tx.ahpMatrix.findUniqueOrThrow({ where: { id: matrixId } });
      const accepted = result.cr < METHOD.CR_MAX;
      const status: AhpMatrixStatus = accepted ? "ACCEPTED" : m.attempt < AHP_MAX_REVIEWS ? "RETURNED" : "RETURNED_UNRESOLVED";
      const tokensIn = pairs.filter((p) => p.attempt === m.attempt).reduce((n, p) => n + (p.tokensIn ?? 0), 0);
      const tokensOut = pairs.filter((p) => p.attempt === m.attempt).reduce((n, p) => n + (p.tokensOut ?? 0), 0);
      await tx.ahpMatrix.update({
        where: { id: m.id },
        data: { cells: cells as unknown as Prisma.InputJsonValue, pairs: pairs as unknown as Prisma.InputJsonValue, lambdaMax: result.lambdaMax, ci: result.ci, cr: result.cr, accepted, status, error: null, tokensIn, tokensOut },
      });
      if (status === "RETURNED") {
        await tx.ahpMatrix.create({
          data: {
            sessionId: m.sessionId,
            seatIndex: m.seatIndex,
            level: m.level,
            parentCode: m.parentCode,
            size: m.size,
            elements: m.elements,
            attempt: m.attempt + 1,
            status: "PENDING",
            revisionOf: m.id,
            pairs: pairs as unknown as Prisma.InputJsonValue,
            returnedPairs: mostInconsistentPairs(cells) as unknown as Prisma.InputJsonValue,
          },
        });
      }
      const remaining = await tx.ahpMatrix.count({ where: { sessionId: m.sessionId, status: "PENDING" } });
      if (remaining === 0) await finishSession(tx, m.sessionId);
      return { status, cr: result.cr, sessionDone: remaining === 0 };
    },
    { timeout: 60_000 },
  );
}

type Tx = Prisma.TransactionClient;

/** Latest attempt per seat and group. */
function latestAttempts<T extends { seatIndex: number; level: string; parentCode: string | null; attempt: number }>(rows: T[]) {
  const map = new Map<string, T>();
  for (const r of rows) {
    const k = `${r.seatIndex}|${groupKey(r.level, r.parentCode)}`;
    const prior = map.get(k);
    if (!prior || r.attempt > prior.attempt) map.set(k, r);
  }
  return [...map.values()];
}

async function finishSession(tx: Tx, sessionId: string) {
  const session = await tx.ahpSession.findUniqueOrThrow({ where: { id: sessionId } });
  const settings = session.settings as unknown as AhpSessionSettings;
  const latest = latestAttempts(await tx.ahpMatrix.findMany({ where: { sessionId } }));
  const groups = new Map<string, typeof latest>();
  for (const m of latest) groups.set(groupKey(m.level, m.parentCode), [...(groups.get(groupKey(m.level, m.parentCode)) ?? []), m]);

  const errors: string[] = [];
  let domainWeights: Record<string, number> | null = null;
  for (const [key, rows] of groups) {
    const { level, parentCode, elements } = rows[0];
    // Individual weights and CR are reported for every seat, accepted or not (docs/05 §4.4).
    for (const r of rows) {
      const cells = r.cells as unknown as Matrix;
      const { weights } = priorityVector(cells);
      await tx.ahpWeight.createMany({ data: elements.map((code, i) => ({ sessionId, level, parentCode, targetCode: code, seatIndex: r.seatIndex, weight: weights[i] })) });
    }
    const accepted = rows.filter((r) => r.status === "ACCEPTED");
    if (accepted.length === 0) {
      errors.push(`ALL_MATRICES_INCONSISTENT: ${key}`);
      continue;
    }
    const agg = aggregateGeometric(accepted.map((r) => ({ seatIndex: r.seatIndex, matrix: r.cells as unknown as Matrix })));
    await tx.ahpWeight.createMany({ data: elements.map((code, i) => ({ sessionId, level, parentCode, targetCode: code, seatIndex: null, weight: agg.weights[i] })) });
    await tx.auditEvent.create({
      data: { actorKind: "SYSTEM", action: "AHP_AGGREGATE", targetType: "AhpSession", targetId: sessionId, payload: { group: key, includedSeats: agg.includedSeats, cr: agg.cr, lambdaMax: agg.lambdaMax } },
    });
    if (key === "DOMAIN") domainWeights = Object.fromEntries(elements.map((c, i) => [c, agg.weights[i]]));
  }
  if (domainWeights) {
    for (const s of settings.scenarios) {
      const r = sensitivity(domainWeights, s.target, s.delta);
      await tx.sensitivityScenario.create({
        data: { sessionId, name: s.name, mutation: { target: s.target, delta: s.delta } as Prisma.InputJsonValue, result: { weights: r.weights, rankBefore: r.rankBefore, rankAfter: r.rankAfter } as Prisma.InputJsonValue, rankChanged: r.rankChanged },
      });
    }
  }
  await tx.ahpSession.update({ where: { id: sessionId }, data: { status: "COMPLETED", endedAt: new Date(), error: errors.length ? errors.join("; ") : null } });
}

/** G5 input: the latest COMPLETED SIMULATED session of a version (docs/05 §6). */
export async function evaluateAhpGateFor(versionId: string) {
  const prisma = await db();
  const [version, groups, session] = await Promise.all([
    prisma.artifactVersion.findUniqueOrThrow({ where: { id: versionId }, select: { status: true } }),
    ahpGroupsFor(versionId),
    prisma.ahpSession.findFirst({
      where: { versionId, dataOrigin: "SIMULATED", status: "COMPLETED" },
      orderBy: { createdAt: "desc" },
      include: { matrices: true, weights: { where: { seatIndex: null, archived: false }, select: { level: true, parentCode: true } }, _count: { select: { sensitivity: true } } },
    }),
  ]);
  const inputs: AhpGroupInput[] = [];
  if (session) {
    const latest = latestAttempts(session.matrices);
    const aggregated = new Set(session.weights.map((w) => groupKey(w.level, w.parentCode)));
    for (const key of new Set(latest.map((m) => groupKey(m.level, m.parentCode)))) {
      inputs.push({
        key,
        matrices: latest.filter((m) => groupKey(m.level, m.parentCode) === key).map((m) => ({ seatIndex: m.seatIndex, status: m.status as AhpMatrixStatus, cr: m.cr })),
        aggregated: aggregated.has(key),
      });
    }
  }
  const scenarios = session ? ((session.settings as unknown as AhpSessionSettings | null)?.scenarios.length ?? 0) : 0;
  return {
    ...evaluateAhpGate({
      contentLocked: version.status === "CONTENT_LOCKED",
      expectedGroups: groups.map((g) => g.key),
      groups: inputs,
      sensitivityRun: Boolean(session) && session!._count.sensitivity > 0 && session!._count.sensitivity === scenarios,
    }),
    sessionId: session?.id ?? null,
  };
}

/** Session room: matrices (all attempts), aggregated and individual weights, sensitivity. */
export async function getAhpSessionView(sessionId: string) {
  const prisma = await db();
  const session = await prisma.ahpSession.findUnique({
    where: { id: sessionId },
    include: {
      version: { select: { id: true, label: true } },
      config: { select: { name: true, seats: { orderBy: { seatIndex: "asc" }, select: { seatIndex: true, label: true, field: true, modelProfile: { select: { label: true } } } } } },
      matrices: { orderBy: [{ level: "asc" }, { parentCode: "asc" }, { seatIndex: "asc" }, { attempt: "asc" }] },
      weights: { where: { archived: false } },
      sensitivity: true,
    },
  });
  if (!session) return null;
  const groups = await ahpGroupsFor(session.versionId);
  return { session, groups, latest: latestAttempts(session.matrices) };
}
