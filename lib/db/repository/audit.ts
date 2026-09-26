import { db } from "../client";
import { iso, type FlatRecord } from "../types";

const LIMIT = 500;

export async function listAuditEvents(): Promise<FlatRecord[]> {
  const prisma = await db();
  const rows = await prisma.auditEvent.findMany({ orderBy: { createdAt: "desc" }, take: LIMIT });
  return rows.map((e) => ({
    id: e.id,
    createdAt: iso(e.createdAt),
    actorKind: e.actorKind,
    actor: e.actorId,
    action: e.action,
    targetType: e.targetType,
    target: e.targetId,
  }));
}

export async function listModelCalls(): Promise<FlatRecord[]> {
  const prisma = await db();
  const rows = await prisma.fgdUtterance.findMany({
    where: { modelId: { not: null } },
    orderBy: { createdAt: "desc" },
    take: LIMIT,
    include: { item: { select: { stage: { select: { session: { select: { dataOrigin: true } } } } } } },
  });
  return rows.map((u) => ({
    id: u.id,
    origin: u.item.stage.session.dataOrigin,
    createdAt: iso(u.createdAt),
    speaker: u.speaker,
    model: u.modelId,
    promptHash: u.promptHash,
    tokensIn: u.tokensIn,
    tokensOut: u.tokensOut,
    latency: u.latencyMs,
  }));
}
