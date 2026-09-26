import { db } from "../client";
import { iso, type FlatRecord } from "../types";

function formatTally(tally: unknown): string | null {
  if (typeof tally !== "object" || tally === null) return null;
  const t = tally as Record<string, unknown>;
  const n = (k: string) => (typeof t[k] === "number" ? (t[k] as number) : 0);
  return `${n("TERIMA")} / ${n("TERIMA_DENGAN_REVISI")} / ${n("TOLAK")} (n=${n("total")})`;
}

export async function listFgdSessions(versionId: string): Promise<FlatRecord[]> {
  const prisma = await db();
  const rows = await prisma.fgdSession.findMany({
    where: { versionId },
    orderBy: { startedAt: "desc" },
    include: { config: { select: { name: true } }, _count: { select: { stages: true } } },
  });
  return rows.map((s) => ({
    id: s.id,
    origin: s.dataOrigin,
    config: s.config.name,
    agenda: s.agendaPreset,
    mode: s.mode,
    status: s.status,
    stages: s._count.stages,
    startedAt: iso(s.startedAt),
    endedAt: iso(s.endedAt),
  }));
}

export async function listFgdDecisions(versionId: string): Promise<FlatRecord[]> {
  const prisma = await db();
  const rows = await prisma.fgdDecisionRecord.findMany({
    where: { item: { stage: { session: { versionId } } } },
    orderBy: { createdAt: "desc" },
    include: {
      item: {
        select: { targetType: true, targetCode: true, stage: { select: { title: true, session: { select: { dataOrigin: true } } } } },
      },
    },
  });
  return rows.map((d) => ({
    id: d.id,
    origin: d.item.stage.session.dataOrigin,
    stage: d.item.stage.title,
    targetType: d.item.targetType,
    target: d.item.targetCode,
    decision: d.decision,
    rule: d.ruleFired,
    tally: formatTally(d.tally),
    note: d.note,
  }));
}

export async function listFgdSuggestions(versionId: string): Promise<FlatRecord[]> {
  const prisma = await db();
  const rows = await prisma.fgdSuggestion.findMany({
    where: { item: { stage: { session: { versionId } } } },
    include: { item: { select: { targetCode: true, stage: { select: { session: { select: { dataOrigin: true } } } } } } },
  });
  return rows.map((s) => ({
    id: s.id,
    origin: s.item.stage.session.dataOrigin,
    target: s.item.targetCode,
    seat: `#${s.seatIndex}`,
    action: s.action,
    quote: s.quote,
    rationale: s.rationale,
    adopted: s.adopted,
    notAdoptedReason: s.notAdoptedReason,
  }));
}
