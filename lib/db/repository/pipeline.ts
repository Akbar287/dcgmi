import type { Prisma } from "@/generated/prisma/client";
import type { SensitivityScenarioSpec } from "@/lib/ahp/scenarios";
import type { StageKey } from "@/lib/fgd/agenda";

import { db } from "../client";
import type { SeatScope } from "./ahp-sessions";

/** Designer configuration (SPECIFICATION §4.9 "definisi run"). */
export interface RunPlan {
  fgd: { configId: string; crossTalkRounds: number; stages: StageKey[]; domains: string[]; seed: number };
  delphi: { configId: string; seed: number };
  ahp: { configId: string; seatScopes: Record<string, SeatScope>; scenarios: SensitivityScenarioSpec[]; seed: number };
  scoring: { modelProfileId: string; profileIds: string[]; seed: number };
}

export type StepKind = "FGD" | "DERIVE" | "DELPHI" | "LOCK" | "AHP" | "SCORING";

/** Stage, label, and the gate that closes each step. */
export const RUN_STEPS: { kind: StepKind; stage: "FGD" | "DELPHI_CVI" | "CONTENT_LOCK" | "AHP" | "SCORING"; gate: string }[] = [
  { kind: "FGD", stage: "FGD", gate: "G2_FGD" },
  { kind: "DERIVE", stage: "FGD", gate: "G1_BASELINE" },
  { kind: "DELPHI", stage: "DELPHI_CVI", gate: "G3_DELPHI" },
  { kind: "LOCK", stage: "CONTENT_LOCK", gate: "G4_CONTENT_LOCK" },
  { kind: "AHP", stage: "AHP", gate: "G5_AHP" },
  { kind: "SCORING", stage: "SCORING", gate: "G6_SCORING" },
];

export async function createPipelineRun(input: { actorId: string; name: string; versionId: string; mode: "STEP" | "AUTO"; budgetUsd: number | null; plan: RunPlan }) {
  const prisma = await db();
  return prisma.$transaction(async (tx) => {
    const run = await tx.pipelineRun.create({
      data: {
        name: input.name,
        versionId: input.versionId,
        configId: input.plan.fgd.configId,
        mode: input.mode,
        status: "QUEUED",
        stagesPlan: input.plan as unknown as Prisma.InputJsonValue,
        budgetUsd: input.budgetUsd,
        createdById: input.actorId,
      },
    });
    for (const [order, s] of RUN_STEPS.entries()) {
      await tx.runStep.create({ data: { runId: run.id, order, stage: s.stage, label: s.kind, gateChecked: s.gate, status: "QUEUED", versionId: order === 0 ? input.versionId : null } });
    }
    await tx.auditEvent.create({ data: { actorId: input.actorId, actorKind: "USER", action: "PIPELINE_CREATE", targetType: "PipelineRun", targetId: run.id, payload: { name: input.name, mode: input.mode, budgetUsd: input.budgetUsd } } });
    return run.id;
  });
}

export async function loadRun(runId: string) {
  const prisma = await db();
  return prisma.pipelineRun.findUniqueOrThrow({ where: { id: runId }, include: { steps: { orderBy: { order: "asc" } } } });
}

export async function updateStep(stepId: string, data: Prisma.RunStepUpdateInput) {
  const prisma = await db();
  await prisma.runStep.update({ where: { id: stepId }, data });
}

export async function updateRun(runId: string, data: Prisma.PipelineRunUpdateInput) {
  const prisma = await db();
  await prisma.pipelineRun.update({ where: { id: runId }, data });
}

/** Spend per run and per step kind from the ledger (the single source of cost). */
export async function refreshRunCosts(runId: string) {
  const prisma = await db();
  const run = await loadRun(runId);
  const byKind = await prisma.modelCall.groupBy({ by: ["kind"], where: { runId }, _sum: { costUsd: true, tokensIn: true, tokensOut: true } });
  const kindOf: Record<StepKind, string | null> = { FGD: "FGD", DERIVE: null, DELPHI: "DELPHI", LOCK: null, AHP: "AHP", SCORING: "SCORING" };
  let total = 0;
  for (const s of run.steps) {
    const k = kindOf[s.label as StepKind];
    const row = byKind.find((b) => b.kind === k);
    const cost = row?._sum.costUsd ? Number(row._sum.costUsd) : 0;
    total += cost;
    if (k) await prisma.runStep.update({ where: { id: s.id }, data: { tokensIn: row?._sum.tokensIn ?? 0, tokensOut: row?._sum.tokensOut ?? 0, costUsd: cost } });
  }
  await prisma.pipelineRun.update({ where: { id: runId }, data: { spentUsd: total } });
}

export async function getRunView(runId: string) {
  const prisma = await db();
  const run = await prisma.pipelineRun.findUnique({ where: { id: runId }, include: { steps: { orderBy: { order: "asc" } } } });
  if (!run) return null;
  const versions = await prisma.artifactVersion.findMany({ where: { id: { in: [run.versionId, ...run.steps.map((s) => s.versionId).filter((v): v is string => !!v)] } }, select: { id: true, label: true } });
  const calls = await prisma.modelCall.count({ where: { runId } });
  return { run, versions: new Map(versions.map((v) => [v.id, v.label])), calls };
}
