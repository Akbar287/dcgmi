import { evaluateDelphiGate, type DelphiItemOutcome } from "@/lib/method/gates";
import type { DelphiDecision } from "@/lib/method/types";

import { db } from "../client";

export async function latestFinalizedResults(versionId: string) {
  const prisma = await db();
  const rows = await prisma.delphiItemResult.findMany({
    where: { round: { versionId, finalizedAt: { not: null } } },
    include: { round: { select: { roundNumber: true } } },
  });
  const codes = new Map((await prisma.indicator.findMany({ where: { id: { in: rows.map((r) => r.indicatorId) } }, select: { id: true, code: true } })).map((i) => [i.id, i.code]));
  return rows.map((r) => ({ ...r, code: codes.get(r.indicatorId) ?? r.indicatorId, roundNumber: r.round.roundNumber }));
}

/** G3 input: every live indicator, and the results of finalized SIMULATED rounds. */
export async function evaluateDelphiGateFor(versionId: string) {
  const prisma = await db();
  const indicators = await prisma.indicator.findMany({ where: { aspect: { domain: { versionId } }, deletedAt: null }, select: { code: true } });
  const rows = await latestFinalizedResults(versionId);
  const results: DelphiItemOutcome[] = rows.map((r) => ({
    code: r.code,
    round: r.roundNumber,
    iCvi: r.iCvi,
    validRaters: r.validRaters,
    decision: r.decision as DelphiDecision,
    clarityFlags: r.clarityFlags,
    clarityCritical: r.clarityCritical,
    researcherNote: r.researcherNote,
  }));
  return evaluateDelphiGate({ expected: indicators.map((i) => i.code), results });
}

