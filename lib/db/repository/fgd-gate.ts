import { AGENDA_CORONG_11, buildAgendaPlan } from "@/lib/fgd/agenda";
import { evaluateFgdGate, type FgdResultInput } from "@/lib/method/gates";
import type { FgdDecisionType } from "@/lib/method/types";

import { db } from "../client";
import { getArtifactHierarchy } from "./artifact";

/**
 * Builds the G2 input for a version: the full expected agenda (all 11 stages,
 * all domains) and every completed component result across its FGD sessions.
 * Selection of the latest result per component happens in lib/method.
 */
export async function gatherFgdGateInput(versionId: string) {
  const prisma = await db();
  const plan = buildAgendaPlan(await getArtifactHierarchy(versionId), { stages: AGENDA_CORONG_11.map((s) => s.key), domains: [] });
  const expected = plan.flatMap((s) => s.items.map((i) => ({ stage: s.key, targetCode: i.targetCode })));
  const items = await prisma.fgdItem.findMany({
    where: { status: "COMPLETED", stage: { session: { versionId, dataOrigin: "SIMULATED" } } },
    include: {
      stage: { select: { key: true } },
      decision: true,
      suggestions: { select: { adopted: true, notAdoptedReason: true } },
      _count: { select: { positions: true } },
    },
  });
  const results: FgdResultInput[] = items
    .filter((i) => i.decision)
    .map((i) => ({
      resultId: i.id,
      stage: i.stage.key,
      targetCode: i.targetCode,
      completedAt: (i.endedAt ?? i.decision!.createdAt).toISOString(),
      positions: i._count.positions,
      decision: i.decision!.decision as FgdDecisionType,
      resolutionNote: i.decision!.resolutionNote,
      suggestions: i.suggestions,
    }));
  return { expected, results };
}

/**
 * docs/05 §6: a derived version without FGD sessions of its own inherits its
 * parent's G2 — met when the parent's G2 is PASSED. An Admin still passes it.
 */
export async function evaluateFgdGateFor(versionId: string): Promise<ReturnType<typeof evaluateFgdGate>> {
  const prisma = await db();
  const [own, version] = await Promise.all([
    prisma.fgdSession.count({ where: { versionId } }),
    prisma.artifactVersion.findUnique({ where: { id: versionId }, select: { parent: { select: { label: true, gates: { where: { gate: "G2_FGD" }, select: { status: true } } } } } }),
  ]);
  if (own === 0 && version?.parent) {
    const passed = version.parent.gates[0]?.status === "PASSED";
    return {
      gate: "G2_FGD",
      passed,
      unmet: passed ? [] : [`G2_PARENT_NOT_PASSED: ${version.parent.label}`],
      warnings: [`G2_INHERITED_FROM_PARENT: ${version.parent.label}`],
      counted: [],
    };
  }
  return evaluateFgdGate(await gatherFgdGateInput(versionId));
}

export async function listSpecialDiscussions(versionId: string) {
  const prisma = await db();
  const { counted } = await evaluateFgdGateFor(versionId);
  const rows = await prisma.fgdDecisionRecord.findMany({
    where: { decision: "PEMBAHASAN_KHUSUS", itemId: { in: counted } },
    include: { item: { select: { title: true, targetCode: true, stage: { select: { title: true } } } } },
    orderBy: { createdAt: "asc" },
  });
  return rows.map((r) => ({
    id: r.id,
    stage: r.item.stage.title,
    title: r.item.title,
    tally: r.tally as Record<string, number>,
    ruleFired: r.ruleFired,
    note: r.note,
    resolutionNote: r.resolutionNote,
    resolvedAt: r.resolvedAt?.toISOString() ?? null,
  }));
}

/** §3.7.3: special discussion happens before an action is set; the outcome is recorded here. */
export async function resolveSpecialDiscussion(actorId: string, decisionId: string, note: string) {
  const prisma = await db();
  await prisma.$transaction([
    prisma.fgdDecisionRecord.update({ where: { id: decisionId }, data: { resolutionNote: note, resolvedById: actorId, resolvedAt: new Date() } }),
    prisma.auditEvent.create({ data: { actorId, actorKind: "USER", action: "FGD_SPECIAL_RESOLVED", targetType: "FgdDecisionRecord", targetId: decisionId, payload: { length: note.length } } }),
  ]);
}
