import { db } from "../client";
import type { FlatRecord } from "../types";

export async function listDelphiRounds(versionId: string): Promise<FlatRecord[]> {
  const prisma = await db();
  const rows = await prisma.delphiRound.findMany({
    where: { versionId },
    orderBy: { roundNumber: "asc" },
    include: { config: { select: { name: true } }, _count: { select: { ratings: true, results: true } } },
  });
  return rows.map((r) => ({
    id: r.id,
    origin: r.dataOrigin,
    round: r.roundNumber,
    config: r.config.name,
    panelSize: r.panelSize,
    status: r.status,
    ratings: r._count.ratings,
    scopeItems: r.scopeCodes.length,
    finalizedAt: r.finalizedAt?.toISOString() ?? null,
    // Stored by the Delphi orchestrator from lib/method/cvi.ts; never computed here.
    sCviAve: r.scaleSCviAve,
  }));
}

export async function listDelphiItemResults(versionId: string): Promise<FlatRecord[]> {
  const prisma = await db();
  const rows = await prisma.delphiItemResult.findMany({
    where: { round: { versionId } },
    orderBy: [{ round: { roundNumber: "asc" } }],
    include: { round: { select: { roundNumber: true, dataOrigin: true } } },
  });
  const indicatorIds = [...new Set(rows.map((r) => r.indicatorId))];
  const codes = new Map(
    (await prisma.indicator.findMany({ where: { id: { in: indicatorIds } }, select: { id: true, code: true } })).map(
      (i) => [i.id, i.code],
    ),
  );
  return rows.map((r) => ({
    id: r.id,
    origin: r.round.dataOrigin,
    round: r.round.roundNumber,
    indicator: codes.get(r.indicatorId) ?? r.indicatorId,
    iCvi: r.iCvi,
    validRaters: r.validRaters,
    median: r.median,
    iqr: r.iqr,
    decision: r.decision,
    clarityFlags: r.clarityFlags,
    clarityCritical: r.clarityCritical,
    reason: r.reason,
    researcherNote: r.researcherNote,
  }));
}
