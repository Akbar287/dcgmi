import type { Prisma } from "@/generated/prisma/client";
import { BudgetExceededError, type CallLog, type CallSink } from "@/lib/ai/call";
import { listGatewayModels } from "@/lib/ai/models";
import { callCost, estimateCallCost, isMockModel, perThousand, type Price } from "@/lib/costs/pricing";

import { db } from "../client";
import { iso, type FlatRecord } from "../types";

export const MONTHLY_CAP_KEY = "budget.monthlyUsd";

const num = (d: Prisma.Decimal | null | undefined) => (d === null || d === undefined ? null : Number(d));

/** Prices per model id from the model profiles; a mock model is free. */
export async function modelPrices(): Promise<Map<string, Price>> {
  const prisma = await db();
  const rows = await prisma.modelProfile.findMany({ select: { modelId: true, inputCostPer1k: true, outputCostPer1k: true } });
  const map = new Map<string, Price>();
  for (const r of rows) {
    const inp = num(r.inputCostPer1k);
    const out = num(r.outputCostPer1k);
    if (inp !== null && out !== null) map.set(r.modelId, { inputPer1k: inp, outputPer1k: out });
  }
  return map;
}

function priceOf(prices: Map<string, Price>, modelId: string): Price | null {
  if (isMockModel(modelId)) return { inputPer1k: 0, outputPer1k: 0 };
  return prices.get(modelId) ?? null;
}

export async function getMonthlyCap(): Promise<number | null> {
  const prisma = await db();
  const row = await prisma.appSetting.findUnique({ where: { key: MONTHLY_CAP_KEY } });
  const v = row ? Number((row.value as { usd?: number }).usd) : NaN;
  return Number.isFinite(v) && v > 0 ? v : null;
}

export async function setMonthlyCap(actorId: string, usd: number | null) {
  const prisma = await db();
  await prisma.$transaction([
    usd === null
      ? prisma.appSetting.deleteMany({ where: { key: MONTHLY_CAP_KEY } })
      : prisma.appSetting.upsert({ where: { key: MONTHLY_CAP_KEY }, create: { key: MONTHLY_CAP_KEY, value: { usd }, updatedById: actorId }, update: { value: { usd }, updatedById: actorId } }),
    prisma.auditEvent.create({ data: { actorId, actorKind: "USER", action: "BUDGET_CAP_SET", targetType: "AppSetting", targetId: MONTHLY_CAP_KEY, payload: { usd } } }),
  ]);
}

const monthStart = (d = new Date()) => new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), 1));

async function spent(where: Prisma.ModelCallWhereInput) {
  const prisma = await db();
  const r = await prisma.modelCall.aggregate({ where, _sum: { costUsd: true } });
  return num(r._sum.costUsd) ?? 0;
}

export const spentForRef = (refType: string, refId: string) => spent({ refType, refId });
export const spentForRun = (runId: string) => spent({ runId });
export const spentThisMonth = () => spent({ createdAt: { gte: monthStart() } });

export interface SinkScope {
  kind: "FGD" | "DELPHI" | "AHP" | "SCORING" | "PING";
  refType: string;
  refId: string;
  versionId?: string | null;
  runId?: string | null;
  /** Session budget in USD; null = none. */
  budgetUsd?: number | null;
}

const fmt = (v: number) => `$${v.toFixed(4)}`;

/**
 * Ledger + budget breaker (researcher decision 2026-09-26): each call is
 * refused BEFORE it is sent when its upper-bound estimate would exceed the
 * session budget, the run budget, or the monthly cap. With any budget in
 * force, a model without a known price is refused too. MOCK_AI costs $0.
 */
export async function createCallSink(scope: SinkScope): Promise<CallSink> {
  const prisma = await db();
  const [prices, cap] = await Promise.all([modelPrices(), getMonthlyCap()]);
  const run = scope.runId ? await prisma.pipelineRun.findUnique({ where: { id: scope.runId }, select: { budgetUsd: true } }) : null;
  const runBudget = num(run?.budgetUsd);
  return {
    async before(call) {
      const price = priceOf(prices, call.modelId);
      const budgets = [scope.budgetUsd ?? null, runBudget, cap].some((b) => b !== null);
      if (!price) {
        if (budgets) throw new BudgetExceededError(`ANGGARAN: harga model ${call.modelId} belum diketahui; panggilan ditolak karena ada anggaran yang berlaku.`);
        return;
      }
      const est = estimateCallCost(call.inputChars, call.maxOutputTokens, price);
      if (est === 0) return;
      if (scope.budgetUsd != null) {
        const used = await spentForRef(scope.refType, scope.refId);
        if (used + est > scope.budgetUsd) throw new BudgetExceededError(`ANGGARAN sesi: terpakai ${fmt(used)} + estimasi ${fmt(est)} > ${fmt(scope.budgetUsd)}.`);
      }
      if (scope.runId && runBudget !== null) {
        const used = await spentForRun(scope.runId);
        if (used + est > runBudget) throw new BudgetExceededError(`ANGGARAN run: terpakai ${fmt(used)} + estimasi ${fmt(est)} > ${fmt(runBudget)}.`);
      }
      if (cap !== null) {
        const used = await spentThisMonth();
        if (used + est > cap) throw new BudgetExceededError(`ANGGARAN bulanan: terpakai ${fmt(used)} + estimasi ${fmt(est)} > ${fmt(cap)}.`);
      }
    },
    async after(log: CallLog, error: string | null) {
      const price = priceOf(prices, log.modelId);
      await prisma.modelCall.create({
        data: {
          kind: scope.kind,
          refType: scope.refType,
          refId: scope.refId,
          runId: scope.runId ?? null,
          versionId: scope.versionId ?? null,
          dataOrigin: "SIMULATED",
          modelId: log.modelId,
          promptId: log.promptId,
          promptVersion: log.promptVersion,
          promptHash: log.promptHash,
          tokensIn: log.tokensIn,
          tokensOut: log.tokensOut,
          latencyMs: log.latencyMs,
          costUsd: price ? callCost(log.tokensIn, log.tokensOut, price) : null,
          ok: error === null,
          error,
        },
      });
    },
  };
}

// ── Unified model log (Audit → Log Model) ────────────────────────────

const LIMIT = 1000;

export async function listModelCallLedger(): Promise<FlatRecord[]> {
  const prisma = await db();
  const rows = await prisma.modelCall.findMany({ orderBy: { createdAt: "desc" }, take: LIMIT });
  return rows.map((c) => ({
    id: c.id,
    origin: c.dataOrigin,
    createdAt: iso(c.createdAt),
    kind: c.kind,
    speaker: c.promptId,
    model: c.modelId,
    promptHash: c.promptHash,
    tokensIn: c.tokensIn,
    tokensOut: c.tokensOut,
    latency: c.latencyMs,
    cost: num(c.costUsd),
    ok: c.ok,
    error: c.error,
  }));
}

/** Spend summary for Settings → Anggaran. */
export async function spendSummary() {
  const prisma = await db();
  const since = monthStart();
  const [month, all, byModel, unpriced] = await Promise.all([
    spentThisMonth(),
    spent({}),
    prisma.modelCall.groupBy({ by: ["modelId"], where: { createdAt: { gte: since } }, _sum: { costUsd: true, tokensIn: true, tokensOut: true }, _count: true }),
    prisma.modelCall.count({ where: { costUsd: null } }),
  ]);
  return {
    since,
    month,
    all,
    unpriced,
    byModel: byModel.map((m) => ({ modelId: m.modelId, calls: m._count, tokensIn: m._sum.tokensIn ?? 0, tokensOut: m._sum.tokensOut ?? 0, cost: num(m._sum.costUsd) ?? 0 })).sort((a, b) => b.cost - a.cost),
  };
}

/**
 * One-time backfill of calls made before the ledger existed (FGD utterances,
 * Delphi ratings, AHP pair judgements, assessor scores). Idempotent per ref.
 */
export async function backfillModelCalls() {
  const prisma = await db();
  if ((await prisma.modelCall.count()) > 0) return 0;
  const prices = await modelPrices();
  const rows: Prisma.ModelCallCreateManyInput[] = [];
  const cost = (modelId: string, tin: number | null, tout: number | null) => {
    const p = priceOf(prices, modelId);
    return p ? callCost(tin, tout, p) : null;
  };
  for (const u of await prisma.fgdUtterance.findMany({ where: { modelId: { not: null } }, include: { item: { select: { stage: { select: { session: { select: { id: true, versionId: true } } } } } } } })) {
    rows.push({ createdAt: u.createdAt, kind: "FGD", refType: "FgdSession", refId: u.item.stage.session.id, versionId: u.item.stage.session.versionId, modelId: u.modelId!, promptId: u.promptId ?? "?", promptVersion: u.promptVersion ?? "?", promptHash: u.promptHash ?? "", tokensIn: u.tokensIn, tokensOut: u.tokensOut, latencyMs: u.latencyMs, costUsd: cost(u.modelId!, u.tokensIn, u.tokensOut) });
  }
  for (const r of await prisma.delphiRating.findMany({ where: { modelId: { not: null } }, include: { round: { select: { versionId: true } } } })) {
    rows.push({ createdAt: r.createdAt, kind: "DELPHI", refType: "DelphiRound", refId: r.roundId, versionId: r.round.versionId, modelId: r.modelId!, promptId: r.promptId ?? "?", promptVersion: r.promptVersion ?? "?", promptHash: r.promptHash ?? "", tokensIn: r.tokensIn, tokensOut: r.tokensOut, latencyMs: r.latencyMs, costUsd: cost(r.modelId!, r.tokensIn, r.tokensOut) });
  }
  for (const m of await prisma.ahpMatrix.findMany({ where: { pairs: { not: undefined } }, include: { session: { select: { versionId: true } } } })) {
    for (const p of ((m.pairs as { attempt: number; promptId: string; modelId: string; tokensIn: number | null; tokensOut: number | null }[] | null) ?? []).filter((p) => p.attempt === m.attempt)) {
      rows.push({ createdAt: m.createdAt, kind: "AHP", refType: "AhpSession", refId: m.sessionId, versionId: m.session.versionId, modelId: p.modelId, promptId: p.promptId, promptVersion: "1.0.0", promptHash: "", tokensIn: p.tokensIn, tokensOut: p.tokensOut, latencyMs: null, costUsd: cost(p.modelId, p.tokensIn, p.tokensOut) });
    }
  }
  for (const s of await prisma.indicatorScore.findMany({ where: { modelId: { not: null } }, include: { assessment: { select: { versionId: true, createdAt: true } } } })) {
    rows.push({ createdAt: s.assessment.createdAt, kind: "SCORING", refType: "Assessment", refId: s.assessmentId, versionId: s.assessment.versionId, modelId: s.modelId!, promptId: s.promptId ?? "?", promptVersion: s.promptVersion ?? "?", promptHash: s.promptHash ?? "", tokensIn: s.tokensIn, tokensOut: s.tokensOut, latencyMs: null, costUsd: cost(s.modelId!, s.tokensIn, s.tokensOut) });
  }
  if (rows.length) await prisma.modelCall.createMany({ data: rows });
  return rows.length;
}

// ── Prices (Settings → Anggaran) ─────────────────────────────────────

export async function listModelPrices() {
  const prisma = await db();
  const rows = await prisma.modelProfile.findMany({ include: { provider: { select: { key: true, label: true } } }, orderBy: [{ provider: { label: "asc" } }, { label: "asc" }] });
  return rows.map((m) => ({ id: m.id, label: m.label, modelId: m.modelId, provider: m.provider.label, gateway: m.provider.key === "gateway", input: num(m.inputCostPer1k), output: num(m.outputCostPer1k), source: m.priceSource }));
}

export async function setModelPrice(actorId: string, modelProfileId: string, input: number | null, output: number | null) {
  const prisma = await db();
  await prisma.$transaction([
    prisma.modelProfile.update({ where: { id: modelProfileId }, data: { inputCostPer1k: input, outputCostPer1k: output, priceSource: input === null && output === null ? null : "MANUAL" } }),
    prisma.auditEvent.create({ data: { actorId, actorKind: "USER", action: "MODEL_PRICE_SET", targetType: "ModelProfile", targetId: modelProfileId, payload: { input, output } } }),
  ]);
}

/** Gateway catalog prices for gateway models whose price is not MANUAL. */
export async function refreshCatalogPrices(actorId: string) {
  const catalog = new Map((await listGatewayModels()).map((m) => [m.id, m.pricing]));
  const prisma = await db();
  const models = await prisma.modelProfile.findMany({ where: { provider: { key: "gateway" }, NOT: { priceSource: "MANUAL" } } });
  let updated = 0;
  for (const m of models) {
    const p = catalog.get(m.modelId);
    const inp = perThousand(p?.input);
    const out = perThousand(p?.output);
    if (inp === null || out === null) continue;
    await prisma.modelProfile.update({ where: { id: m.id }, data: { inputCostPer1k: inp, outputCostPer1k: out, priceSource: "CATALOG" } });
    updated++;
  }
  await prisma.auditEvent.create({ data: { actorId, actorKind: "USER", action: "MODEL_PRICE_CATALOG", targetType: "ModelProfile", targetId: null, payload: { updated } } });
  return updated;
}

// ── Estimator (Run → Estimator) ──────────────────────────────────────

/** Mean tokens per prompt from real calls; null when there is no history. */
export async function tokenHistory() {
  const prisma = await db();
  const rows = await prisma.modelCall.groupBy({ by: ["promptId"], where: { ok: true, NOT: { modelId: { startsWith: "mock:" } }, tokensIn: { not: null } }, _avg: { tokensIn: true, tokensOut: true }, _count: true });
  return new Map(rows.map((r) => [r.promptId, { in: r._avg.tokensIn ?? 0, out: r._avg.tokensOut ?? 0, n: r._count }]));
}
