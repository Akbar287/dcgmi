import { evaluateBaselineGate, GATE_ORDER, type GateEvaluation, type GateKey } from "@/lib/method/gates";
import { GateError } from "@/lib/method/errors";

import { db } from "../client";
import { getArtifactSnapshot } from "./artifact";

/** Gates whose conditions can be computed from stored data today. */
const EVALUATORS: Partial<Record<GateKey, (versionId: string) => Promise<GateEvaluation>>> = {
  G1_BASELINE: async (versionId) => evaluateBaselineGate(await getArtifactSnapshot(versionId)),
};

export function canEvaluate(gate: GateKey): boolean {
  return gate in EVALUATORS;
}

export async function evaluateGate(versionId: string, gate: GateKey): Promise<GateEvaluation> {
  const evaluator = EVALUATORS[gate];
  if (!evaluator) throw new GateError(gate, ["EVALUATOR_NOT_AVAILABLE"]);
  return evaluator(versionId);
}

/**
 * Stores an automatic evaluation. Met conditions become PENDING, never PASSED:
 * only an Admin passes a gate (docs/07 P7).
 */
export async function recordEvaluation(versionId: string, gate: GateKey, note: string) {
  const evaluation = await evaluateGate(versionId, gate);
  const prisma = await db();
  const current = await prisma.gateRecord.findUnique({ where: { versionId_gate: { versionId, gate } } });
  const status = evaluation.passed ? (current?.status === "PASSED" ? "PASSED" : "PENDING") : "FAILED";
  await prisma.gateRecord.upsert({
    where: { versionId_gate: { versionId, gate } },
    create: { versionId, gate, status, unmet: evaluation.unmet, warnings: evaluation.warnings, note },
    update: { status, unmet: evaluation.unmet, warnings: evaluation.warnings, note },
  });
  return evaluation;
}

/**
 * docs/03 passGate: re-evaluates from stored data at the moment of the
 * decision (the stored status is never trusted), requires the previous gate
 * to be PASSED, and writes the decision and its note to AuditEvent.
 */
export async function passGate(actorId: string, versionId: string, gate: GateKey, note: string): Promise<GateEvaluation> {
  const index = GATE_ORDER.indexOf(gate);
  const prisma = await db();
  if (index > 0) {
    const previous = GATE_ORDER[index - 1];
    const record = await prisma.gateRecord.findUnique({ where: { versionId_gate: { versionId, gate: previous } } });
    if (record?.status !== "PASSED") throw new GateError(gate, [`PREVIOUS_GATE_NOT_PASSED: ${previous}`]);
  }
  const evaluation = await evaluateGate(versionId, gate);
  if (!evaluation.passed) throw new GateError(gate, evaluation.unmet);
  const decidedAt = new Date();
  await prisma.$transaction([
    prisma.gateRecord.upsert({
      where: { versionId_gate: { versionId, gate } },
      create: { versionId, gate, status: "PASSED", unmet: [], warnings: evaluation.warnings, decidedById: actorId, decidedAt, note },
      update: { status: "PASSED", unmet: [], warnings: evaluation.warnings, decidedById: actorId, decidedAt, note },
    }),
    prisma.auditEvent.create({
      data: {
        actorId,
        actorKind: "USER",
        action: "GATE_PASS",
        targetType: "GateRecord",
        targetId: `${versionId}:${gate}`,
        payload: { gate, versionId, note, warnings: evaluation.warnings },
      },
    }),
  ]);
  return evaluation;
}
