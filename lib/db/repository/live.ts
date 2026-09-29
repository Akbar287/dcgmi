import { db } from "../client";

export const LIVE_REFS = ["FgdSession", "DelphiRound", "AhpSession", "Assessment", "PipelineRun"] as const;
export type LiveRef = (typeof LIVE_REFS)[number];

const TERMINAL = ["COMPLETED", "CANCELLED", "FAILED"];

/** Compact progress snapshot of a running thing; changes trigger a UI refresh. */
export async function liveStatus(type: LiveRef, id: string): Promise<{ status: string; progress: string; terminal: boolean } | null> {
  const prisma = await db();
  switch (type) {
    case "FgdSession": {
      const s = await prisma.fgdSession.findUnique({ where: { id }, select: { status: true } });
      if (!s) return null;
      const done = await prisma.fgdItem.count({ where: { stage: { sessionId: id }, status: "COMPLETED" } });
      const total = await prisma.fgdItem.count({ where: { stage: { sessionId: id } } });
      return { status: s.status, progress: `${done}/${total}`, terminal: TERMINAL.includes(s.status) };
    }
    case "DelphiRound": {
      const r = await prisma.delphiRound.findUnique({ where: { id }, select: { status: true, scopeCodes: true, finalizedAt: true, _count: { select: { results: true } } } });
      if (!r) return null;
      return { status: r.finalizedAt ? "FINALIZED" : r.status, progress: `${r._count.results}/${r.scopeCodes.length}`, terminal: !!r.finalizedAt };
    }
    case "AhpSession": {
      const s = await prisma.ahpSession.findUnique({ where: { id }, select: { status: true } });
      if (!s) return null;
      const pending = await prisma.ahpMatrix.count({ where: { sessionId: id, status: "PENDING" } });
      const all = await prisma.ahpMatrix.count({ where: { sessionId: id } });
      return { status: s.status, progress: `${all - pending}/${all}`, terminal: TERMINAL.includes(s.status) };
    }
    case "Assessment": {
      const a = await prisma.assessment.findUnique({ where: { id }, select: { status: true, versionId: true, _count: { select: { scores: true } } } });
      if (!a) return null;
      const total = await prisma.indicator.count({ where: { aspect: { domain: { versionId: a.versionId } }, deletedAt: null } });
      return { status: a.status, progress: `${a._count.scores}/${total}`, terminal: TERMINAL.includes(a.status) };
    }
    case "PipelineRun": {
      const r = await prisma.pipelineRun.findUnique({ where: { id }, select: { status: true, waitReason: true, spentUsd: true, steps: { select: { status: true } } } });
      if (!r) return null;
      return { status: `${r.status}${r.waitReason ? `:${r.waitReason}` : ""}`, progress: `${r.steps.filter((s) => s.status === "COMPLETED").length}/${r.steps.length} · $${Number(r.spentUsd).toFixed(4)}`, terminal: TERMINAL.includes(r.status) };
    }
  }
}

/** Ledger rows after the cursor for this ref (or run), oldest first. */
export async function liveCalls(type: LiveRef, id: string, after: Date) {
  const prisma = await db();
  const rows = await prisma.modelCall.findMany({
    where: { createdAt: { gt: after }, ...(type === "PipelineRun" ? { runId: id } : { refType: type, refId: id }) },
    orderBy: { createdAt: "asc" },
    take: 50,
    select: { id: true, createdAt: true, promptId: true, modelId: true, tokensIn: true, tokensOut: true, latencyMs: true, costUsd: true, ok: true, error: true },
  });
  return rows.map((r) => ({ ...r, createdAt: r.createdAt.toISOString(), costUsd: r.costUsd === null ? null : Number(r.costUsd) }));
}
