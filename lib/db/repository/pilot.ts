import { evaluatePilotGate, exactAgreement, pilotCompleteness, pilotTraceability, quadraticWeightedKappa, type PilotGateInput } from "@/lib/method/pilot";
import type { MissingKind } from "@/lib/method/types";

import { db } from "../client";
import { createAssessment, ScoringError } from "./scoring-runs";

/**
 * Simulated inter-assessor pilot (docs/05 §5.6, researcher decision
 * 2026-09-29): assessors A and B (different models) score every chosen
 * fictional profile; κw, agreement, completeness and traceability follow.
 */
export async function createPilotRun(input: { actorId: string; versionId: string; profileIds: string[]; assessorA: string; assessorB: string; seed: number; promptVersions: Record<string, string> }) {
  if (input.assessorA === input.assessorB) throw new ScoringError("INVALID", "Asesor A dan B harus memakai model berbeda.");
  if (input.profileIds.length === 0) throw new ScoringError("INVALID", "Pilih minimal satu profil fiktif.");
  const prisma = await db();
  const g6 = await prisma.gateRecord.findUnique({ where: { versionId_gate: { versionId: input.versionId, gate: "G6_SCORING" } } });
  if (g6?.status !== "PASSED") throw new ScoringError("GATE", "Pilot baru dapat dijalankan setelah G6 lulus.", ["G6_NOT_PASSED"]);
  const run = await prisma.pilotRun.create({ data: { versionId: input.versionId, profileIds: input.profileIds, assessorA: input.assessorA, assessorB: input.assessorB, seed: input.seed, createdById: input.actorId } });
  for (const profileId of input.profileIds) {
    for (const role of ["A", "B"] as const) {
      await createAssessment({ actorId: input.actorId, versionId: input.versionId, profileId, modelProfileId: role === "A" ? input.assessorA : input.assessorB, seed: input.seed, promptVersions: input.promptVersions, pilot: { runId: run.id, role } });
    }
  }
  await prisma.auditEvent.create({ data: { actorId: input.actorId, actorKind: "USER", action: "PILOT_RUN_CREATE", targetType: "PilotRun", targetId: run.id, payload: { profiles: input.profileIds.length } } });
  return run.id;
}

export async function nextPilotAssessment(runId: string) {
  const prisma = await db();
  return prisma.assessment.findFirst({ where: { pilotRunId: runId, status: { notIn: ["COMPLETED", "CANCELLED"] } }, orderBy: [{ createdAt: "asc" }] });
}

export async function declarePilot(actorId: string, versionId: string, input: { kind: "ETHICS" | "ACCESS"; reference: string | null; date: string | null; note: string | null }) {
  const prisma = await db();
  await prisma.$transaction([
    prisma.pilotDeclaration.create({ data: { versionId, kind: input.kind, reference: input.reference, date: input.date, note: input.note, declaredById: actorId } }),
    prisma.auditEvent.create({ data: { actorId, actorKind: "USER", action: `PILOT_DECLARE_${input.kind}`, targetType: "ArtifactVersion", targetId: versionId, payload: { reference: input.reference, date: input.date } } }),
  ]);
}

type ScoreRow = { indicatorId: string; level: number | null; missingKind: string; evidenceLocator: string | null; satisfiedEvidence: string[] };

/** Per profile: κw, agreement, completeness and traceability of the latest completed A/B pair. */
export async function pilotResults(versionId: string) {
  const prisma = await db();
  const runs = await prisma.pilotRun.findMany({ where: { versionId }, orderBy: { createdAt: "desc" } });
  const assessments = await prisma.assessment.findMany({ where: { versionId, purpose: "PILOT" }, include: { scores: true, profile: { select: { label: true } } }, orderBy: { createdAt: "asc" } });
  const out: (PilotGateInput["pairs"][number] & { runId: string; confusion: number[][]; aId: string; bId: string; status: string })[] = [];
  for (const run of runs) {
    for (const profileId of run.profileIds) {
      const a = assessments.find((x) => x.pilotRunId === run.id && x.profileId === profileId && x.pilotRole === "A");
      const b = assessments.find((x) => x.pilotRunId === run.id && x.profileId === profileId && x.pilotRole === "B");
      if (!a || !b) continue;
      const done = a.status === "COMPLETED" && b.status === "COMPLETED";
      const pairs: [number, number][] = [];
      let excluded = 0;
      const confusion = Array.from({ length: 5 }, () => new Array<number>(5).fill(0));
      for (const sa of a.scores as ScoreRow[]) {
        const sb = (b.scores as ScoreRow[]).find((x) => x.indicatorId === sa.indicatorId);
        if (!sb) continue;
        if (sa.level === null || sb.level === null || sa.missingKind === "MISSING_ADMINISTRATIF" || sb.missingKind === "MISSING_ADMINISTRATIF") {
          excluded++;
          continue;
        }
        pairs.push([sa.level, sb.level]);
        confusion[sa.level - 1][sb.level - 1]++;
      }
      const shape = (s: ScoreRow[]) => s.map((x) => ({ level: x.level, missingKind: x.missingKind as MissingKind, locator: x.evidenceLocator, satisfied: x.satisfiedEvidence.length }));
      out.push({
        runId: run.id,
        status: done ? "COMPLETED" : "RUNNING",
        profile: a.profile?.label ?? profileId,
        aId: a.id,
        bId: b.id,
        kappa: done ? quadraticWeightedKappa(pairs) : null,
        agreement: done ? exactAgreement(pairs) : 0,
        compared: pairs.length,
        excluded,
        completeness: [pilotCompleteness(shape(a.scores as ScoreRow[])), pilotCompleteness(shape(b.scores as ScoreRow[]))],
        traceability: [pilotTraceability(shape(a.scores as ScoreRow[])), pilotTraceability(shape(b.scores as ScoreRow[]))],
        confusion,
      });
    }
  }
  return out;
}

/** G7 on the latest pilot run's completed pairs plus the latest declarations. */
export async function evaluatePilotGateFor(versionId: string) {
  const prisma = await db();
  const [g6, ethics, access, results] = await Promise.all([
    prisma.gateRecord.findUnique({ where: { versionId_gate: { versionId, gate: "G6_SCORING" } } }),
    prisma.pilotDeclaration.findFirst({ where: { versionId, kind: "ETHICS" }, orderBy: { createdAt: "desc" } }),
    prisma.pilotDeclaration.findFirst({ where: { versionId, kind: "ACCESS" }, orderBy: { createdAt: "desc" } }),
    pilotResults(versionId),
  ]);
  const latestRun = results[0]?.runId;
  const pairs = results.filter((r) => r.runId === latestRun && r.status === "COMPLETED");
  return {
    ...evaluatePilotGate({
      g6Passed: g6?.status === "PASSED",
      ethics: ethics?.reference ? { reference: ethics.reference, date: ethics.date ?? "" } : null,
      access: access?.note ? { note: access.note } : null,
      pairs,
      simulated: true,
    }),
    ethics,
    access,
    results,
  };
}
