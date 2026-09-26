import { db } from "../client";
import { decimal, iso, type FlatRecord } from "../types";

export async function listPipelineRuns(versionId: string): Promise<FlatRecord[]> {
  const prisma = await db();
  const rows = await prisma.pipelineRun.findMany({
    // A run moves across derived versions; list it on every version it touched.
    where: { OR: [{ versionId }, { steps: { some: { versionId } } }] },
    orderBy: { createdAt: "desc" },
    include: { _count: { select: { steps: true } } },
  });
  return rows.map((r) => ({
    id: r.id,
    name: r.name,
    mode: r.mode,
    status: r.status,
    steps: r._count.steps,
    budget: decimal(r.budgetUsd),
    spent: decimal(r.spentUsd),
    startedAt: iso(r.startedAt),
    endedAt: iso(r.endedAt),
    action: r.id,
  }));
}

export async function listRunSteps(versionId: string): Promise<FlatRecord[]> {
  const prisma = await db();
  const rows = await prisma.runStep.findMany({
    where: { run: { OR: [{ versionId }, { steps: { some: { versionId } } }] } },
    orderBy: [{ run: { createdAt: "desc" } }, { order: "asc" }],
    include: { run: { select: { name: true } } },
  });
  return rows.map((s) => ({
    id: s.id,
    run: s.run.name,
    order: s.order,
    stage: s.stage,
    label: s.label,
    status: s.status,
    gateChecked: s.gateChecked,
    tokensIn: s.tokensIn,
    tokensOut: s.tokensOut,
    cost: decimal(s.costUsd),
    error: s.error,
  }));
}
