import type { Prisma } from "@/generated/prisma/client";
import type { BriefDomain } from "@/lib/fgd/component-brief";
import type { PlannedStage, StageKey } from "@/lib/fgd/agenda";

import { db } from "../client";

type Tx = Prisma.TransactionClient;

export interface SessionSettings {
  selection: { stages: StageKey[]; domains: string[] };
  crossTalkRounds: number;
  promptVersions: Record<string, string>;
  estimatedCalls: number;
}

export async function getBriefDomains(versionId: string): Promise<BriefDomain[]> {
  const prisma = await db();
  const domains = await prisma.domain.findMany({
    where: { versionId },
    orderBy: { order: "asc" },
    include: {
      aspects: {
        orderBy: { order: "asc" },
        include: { indicators: { where: { deletedAt: null }, orderBy: { order: "asc" }, include: { rubricLevels: true, evidence: true } } },
      },
    },
  });
  return domains.map((d) => ({
    code: d.code,
    name: d.name,
    rationale: d.rationale,
    aspects: d.aspects.map((a) => ({
      code: a.code,
      name: a.name,
      rationale: a.rationale,
      indicators: a.indicators.map((i) => ({
        code: i.code,
        name: i.name,
        isControlledException: i.isControlledException,
        operationalDefinition: i.operationalDefinition,
        assessmentObject: i.assessmentObject,
        boundaryNote: i.boundaryNote,
        rubric: i.rubricLevels.map((r) => ({ level: r.level, label: r.label, descriptor: r.descriptor })),
        evidence: i.evidence.map((e) => ({ kind: e.kind, minimumFor: e.minimumFor, mandatory: e.mandatory, description: e.description })),
      })),
    })),
  }));
}

export async function createFgdSession(input: {
  actorId: string;
  versionId: string;
  configId: string;
  mode: "STEP" | "AUTO";
  seed: number;
  settings: SessionSettings;
  plan: PlannedStage[];
  budgetUsd?: number | null;
  runId?: string | null;
}) {
  const prisma = await db();
  return prisma.$transaction(
    async (tx) => {
      const session = await tx.fgdSession.create({
        data: {
          versionId: input.versionId,
          configId: input.configId,
          // Everything an AI panel writes is SIMULATED (docs/04 §10, docs/07 P1).
          dataOrigin: "SIMULATED",
          mode: input.mode,
          status: "QUEUED",
          seed: input.seed,
          budgetUsd: input.budgetUsd ?? null,
          runId: input.runId ?? null,
          settings: input.settings as unknown as Prisma.InputJsonValue,
          createdById: input.actorId,
        },
      });
      for (const [order, stage] of input.plan.entries()) {
        await tx.fgdStage.create({
          data: {
            sessionId: session.id,
            order,
            key: stage.key,
            title: stage.title,
            items: { create: stage.items.map((it, i) => ({ order: i, targetType: it.targetType, targetCode: it.targetCode, title: it.title })) },
          },
        });
      }
      await tx.auditEvent.create({
        data: {
          actorId: input.actorId,
          actorKind: "USER",
          action: "FGD_SESSION_CREATE",
          targetType: "FgdSession",
          targetId: session.id,
          payload: { configId: input.configId, mode: input.mode, seed: input.seed, ...input.settings } as unknown as Prisma.InputJsonValue,
        },
      });
      return session.id;
    },
    { timeout: 60_000 },
  );
}

export async function loadRunContext(sessionId: string) {
  const prisma = await db();
  const session = await prisma.fgdSession.findUniqueOrThrow({
    where: { id: sessionId },
    include: {
      config: {
        include: {
          seats: {
            orderBy: { seatIndex: "asc" },
            include: {
              expert: { include: { persona: true } },
              modelProfile: { include: { provider: true } },
            },
          },
        },
      },
    },
  });
  const profiles = await prisma.modelProfile.findMany({
    where: { id: { in: [session.config.facilitatorModelId, session.config.notetakerModelId].filter((x): x is string => Boolean(x)) } },
    include: { provider: true },
  });
  return { session, profiles };
}

const ACTIVE = ["QUEUED", "RUNNING", "PAUSED"] as const;

/** Atomically moves the next queued component to RUNNING; null when none is left. */
export async function claimNextItem(sessionId: string) {
  const prisma = await db();
  return prisma.$transaction(async (tx) => {
    const session = await tx.fgdSession.findUniqueOrThrow({ where: { id: sessionId } });
    if (!(ACTIVE as readonly string[]).includes(session.status)) return null;
    const item = await tx.fgdItem.findFirst({
      where: { stage: { sessionId }, status: "QUEUED" },
      orderBy: [{ stage: { order: "asc" } }, { order: "asc" }],
      include: { stage: true },
    });
    if (!item) return null;
    const claimed = await tx.fgdItem.updateMany({ where: { id: item.id, status: "QUEUED" }, data: { status: "RUNNING", startedAt: new Date(), error: null } });
    if (claimed.count === 0) return null;
    await tx.fgdStage.update({ where: { id: item.stageId }, data: { status: "RUNNING" } });
    await tx.fgdSession.update({ where: { id: sessionId }, data: { status: "RUNNING", startedAt: session.startedAt ?? new Date() } });
    return item;
  });
}

export interface ItemResult {
  utterances: {
    kind: string;
    speaker: string;
    seatIndex: number | null;
    turn: number;
    content: string;
    modelId: string;
    promptId: string;
    promptVersion: string;
    promptHash: string;
    tokensIn: number | null;
    tokensOut: number | null;
    latencyMs: number;
  }[];
  positions: { seatIndex: number; position: "TERIMA" | "TERIMA_DENGAN_REVISI" | "TOLAK"; reason: string; proposedAction: string | null }[];
  suggestions: { seatIndex: number; action: string; quote: string; rationale: string }[];
  decision: { decision: string; ruleFired: string; tally: Prisma.InputJsonValue; note: string | null };
}

async function refreshStatuses(tx: Tx, stageId: string, sessionId: string) {
  const openInStage = await tx.fgdItem.count({ where: { stageId, status: { in: ["QUEUED", "RUNNING"] } } });
  if (openInStage === 0) await tx.fgdStage.update({ where: { id: stageId }, data: { status: "COMPLETED" } });
  const open = await tx.fgdItem.count({ where: { stage: { sessionId }, status: { in: ["QUEUED", "RUNNING"] } } });
  return { stageDone: openInStage === 0, sessionDone: open === 0 };
}

export async function saveItemResult(itemId: string, result: ItemResult) {
  const prisma = await db();
  return prisma.$transaction(
    async (tx) => {
      const item = await tx.fgdItem.findUniqueOrThrow({ where: { id: itemId }, include: { stage: true } });
      await tx.fgdUtterance.createMany({ data: result.utterances.map((u) => ({ itemId, ...u })) });
      await tx.fgdPosition.createMany({
        data: result.positions.map((p) => ({ itemId, seatIndex: p.seatIndex, position: p.position, reason: p.reason, proposedAction: p.proposedAction as never })),
      });
      if (result.suggestions.length) {
        await tx.fgdSuggestion.createMany({ data: result.suggestions.map((s) => ({ itemId, seatIndex: s.seatIndex, action: s.action as never, quote: s.quote, rationale: s.rationale })) });
      }
      await tx.fgdDecisionRecord.create({
        data: { itemId, decision: result.decision.decision as never, ruleFired: result.decision.ruleFired, tally: result.decision.tally, note: result.decision.note },
      });
      await tx.fgdItem.update({ where: { id: itemId }, data: { status: "COMPLETED", endedAt: new Date() } });
      const s = await refreshStatuses(tx, item.stageId, item.stage.sessionId);
      if (s.sessionDone) await tx.fgdSession.update({ where: { id: item.stage.sessionId }, data: { status: "COMPLETED", endedAt: new Date() } });
      return s;
    },
    { timeout: 60_000 },
  );
}

/** docs/01: a schema failure marks the step FAILED and stops the run — no default values. */
export async function failItem(itemId: string, error: string) {
  const prisma = await db();
  await prisma.$transaction(async (tx) => {
    const item = await tx.fgdItem.update({ where: { id: itemId }, data: { status: "FAILED", error: error.slice(0, 1000), endedAt: new Date() }, include: { stage: true } });
    await tx.fgdStage.update({ where: { id: item.stageId }, data: { status: "FAILED" } });
    await tx.fgdSession.update({ where: { id: item.stage.sessionId }, data: { status: "FAILED" } });
  });
}

export async function pauseSession(sessionId: string) {
  const prisma = await db();
  await prisma.fgdSession.updateMany({ where: { id: sessionId, status: { in: ["QUEUED", "RUNNING"] } }, data: { status: "PAUSED" } });
}

export async function setSessionState(actorId: string, sessionId: string, action: "CANCEL" | "RETRY_FAILED") {
  const prisma = await db();
  await prisma.$transaction(async (tx) => {
    if (action === "CANCEL") {
      await tx.fgdSession.update({ where: { id: sessionId }, data: { status: "CANCELLED", endedAt: new Date() } });
    } else {
      // Retrying re-runs the failed component from scratch; nothing partial was stored.
      await tx.fgdItem.updateMany({ where: { stage: { sessionId }, status: "FAILED" }, data: { status: "QUEUED", error: null } });
      await tx.fgdStage.updateMany({ where: { sessionId, status: "FAILED" }, data: { status: "RUNNING" } });
      await tx.fgdSession.update({ where: { id: sessionId }, data: { status: "PAUSED" } });
    }
    await tx.auditEvent.create({ data: { actorId, actorKind: "USER", action: `FGD_SESSION_${action}`, targetType: "FgdSession", targetId: sessionId, payload: {} } });
  });
}

export async function getSessionRoom(sessionId: string, itemId: string | null) {
  const prisma = await db();
  const session = await prisma.fgdSession.findUnique({
    where: { id: sessionId },
    include: {
      version: { select: { label: true } },
      config: {
        include: {
          seats: {
            orderBy: { seatIndex: "asc" },
            include: { expert: { select: { panelCode: true } }, modelProfile: { include: { provider: { select: { label: true } } } } },
          },
        },
      },
      stages: {
        orderBy: { order: "asc" },
        include: { items: { orderBy: { order: "asc" }, include: { decision: { select: { decision: true } } } } },
      },
    },
  });
  if (!session) return null;
  const items = session.stages.flatMap((s) => s.items);
  const selectedId = itemId && items.some((i) => i.id === itemId) ? itemId : ([...items].reverse().find((i) => i.status === "COMPLETED" || i.status === "FAILED" || i.status === "RUNNING")?.id ?? items[0]?.id ?? null);
  const selected = selectedId
    ? await prisma.fgdItem.findUnique({
        where: { id: selectedId },
        include: { utterances: { orderBy: { turn: "asc" } }, positions: { orderBy: { seatIndex: "asc" } }, suggestions: true, decision: true, stage: { select: { title: true, key: true } } },
      })
    : null;
  const totals = await prisma.fgdUtterance.aggregate({
    where: { item: { stage: { sessionId } } },
    _count: true,
    _sum: { tokensIn: true, tokensOut: true },
  });
  return { session, selected, totals };
}

export async function listSuggestionsForAdoption(versionId: string) {
  const prisma = await db();
  return prisma.fgdSuggestion.findMany({
    where: { item: { stage: { session: { versionId } } } },
    orderBy: [{ item: { stage: { session: { createdAt: "desc" } } } }, { item: { targetCode: "asc" } }, { seatIndex: "asc" }],
    include: { item: { select: { targetCode: true, title: true, stage: { select: { title: true, session: { select: { id: true, dataOrigin: true } } } } } } },
  });
}

export async function setSuggestionAdoption(actorId: string, suggestionId: string, adopted: boolean | null, reason: string | null) {
  const prisma = await db();
  await prisma.$transaction([
    prisma.fgdSuggestion.update({ where: { id: suggestionId }, data: { adopted, notAdoptedReason: adopted === false ? reason : null } }),
    prisma.auditEvent.create({ data: { actorId, actorKind: "USER", action: "FGD_SUGGESTION_ADOPTION", targetType: "FgdSuggestion", targetId: suggestionId, payload: { adopted } } }),
  ]);
}
