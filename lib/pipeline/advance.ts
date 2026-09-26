import type { Prisma } from "@/generated/prisma/client";
import { AHP_PROMPT_VERSIONS, runNextAhpMatrix } from "@/lib/ahp/run-matrix";
import { db } from "@/lib/db/client";
import { createAhpSession, setAhpSessionStatus } from "@/lib/db/repository/ahp-sessions";
import { getArtifactHierarchy } from "@/lib/db/repository/artifact";
import { createDelphiRound, planNextRound, setDelphiRoundStatus } from "@/lib/db/repository/delphi-rounds";
import { evaluateFgdGateFor } from "@/lib/db/repository/fgd-gate";
import { createFgdSession, setSessionState } from "@/lib/db/repository/fgd-sessions";
import { recordEvaluation } from "@/lib/db/repository/gates";
import { listPanelsForEditor } from "@/lib/db/repository/panel-admin";
import { loadRun, refreshRunCosts, updateRun, updateStep, type RunPlan, type StepKind } from "@/lib/db/repository/pipeline";
import { createAssessment, setAssessmentStatus } from "@/lib/db/repository/scoring-runs";
import { createDerivedVersion, suggestDerivedLabel } from "@/lib/db/repository/version-derive";
import { DELPHI_PROMPT_VERSIONS, runNextDelphiItem } from "@/lib/delphi/run-round";
import { buildAgendaPlan, estimateCalls } from "@/lib/fgd/agenda";
import { PROMPT_VERSIONS, runNextItem } from "@/lib/fgd/run-item";
import { runNextScore, SCORING_PROMPT_VERSIONS } from "@/lib/scoring/run-item";

/**
 * Pipeline runner (SPECIFICATION §4.9). One call = one unit of work of the
 * current step, delegated to the same orchestrators the screens use. The run
 * never passes a gate and never makes a researcher decision: it pauses with
 * WAITING_GATE:<gate> or WAITING_RESEARCHER:<task> and resumes on the next
 * call once the condition holds (docs/07 P7).
 */
export type AdvanceOutcome =
  | { kind: "WORKED"; step: StepKind }
  | { kind: "WAITING"; step: StepKind; reason: string }
  | { kind: "STEP_DONE"; step: StepKind }
  | { kind: "DONE" }
  | { kind: "FAILED"; step: StepKind; error: string }
  | { kind: "STOPPED"; status: string };

type Step = Awaited<ReturnType<typeof loadRun>>["steps"][number];
type StepResult = { kind: "WORKED" } | { kind: "WAITING"; reason: string; detail?: Record<string, unknown> } | { kind: "DONE"; versionId?: string } | { kind: "FAILED"; error: string };

async function gateStatus(versionId: string, gate: string) {
  const prisma = await db();
  return (await prisma.gateRecord.findUnique({ where: { versionId_gate: { versionId, gate } } }))?.status ?? "PENDING";
}

const detailOf = (s: Step) => (s.detail ?? {}) as Record<string, unknown>;

async function fgdStep(run: Awaited<ReturnType<typeof loadRun>>, step: Step, plan: RunPlan): Promise<StepResult> {
  const prisma = await db();
  const versionId = step.versionId!;
  if (!step.refId) {
    if ((await gateStatus(versionId, "G1_BASELINE")) !== "PASSED") return { kind: "WAITING", reason: "WAITING_GATE:G1_BASELINE" };
    const panel = (await listPanelsForEditor()).find((p) => p.id === plan.fgd.configId);
    if (!panel?.validation.ready) return { kind: "FAILED", error: "Panel FGD belum siap." };
    const agenda = buildAgendaPlan(await getArtifactHierarchy(versionId), { stages: plan.fgd.stages, domains: plan.fgd.domains });
    const id = await createFgdSession({
      actorId: run.createdById ?? "pipeline",
      versionId,
      configId: panel.id,
      mode: "AUTO",
      seed: plan.fgd.seed,
      settings: { selection: { stages: plan.fgd.stages, domains: plan.fgd.domains }, crossTalkRounds: plan.fgd.crossTalkRounds, promptVersions: PROMPT_VERSIONS, estimatedCalls: estimateCalls(agenda, panel.seats.length, plan.fgd.crossTalkRounds).calls },
      plan: agenda,
      runId: run.id,
    });
    await updateStep(step.id, { refType: "FgdSession", refId: id });
    return { kind: "WORKED" };
  }
  const session = await prisma.fgdSession.findUniqueOrThrow({ where: { id: step.refId } });
  if (session.status === "FAILED") return { kind: "FAILED", error: "Komponen FGD gagal; lihat ruang sesi." };
  if (session.status !== "COMPLETED" && session.status !== "CANCELLED") {
    const o = await runNextItem(session.id);
    if (o.kind === "FAILED") return { kind: "FAILED", error: o.error };
    // AUTO stops at PEMBAHASAN_KHUSUS for the researcher (SPECIFICATION §4.5).
    if (o.kind === "STOPPED_SPECIAL") return { kind: "WAITING", reason: "WAITING_RESEARCHER:FGD_SPECIAL" };
    return { kind: "WORKED" };
  }
  // New results must be reviewed again: a G2 passed earlier drops to FAILED/PENDING
  // until the researcher decides and the Admin passes it again (docs/07 P7).
  if (!detailOf(step).g2Recorded) {
    await recordEvaluation(versionId, "G2_FGD", "Evaluasi otomatis setelah sesi FGD run pipeline selesai.");
    await updateStep(step.id, { detail: { ...detailOf(step), g2Recorded: true } as Prisma.InputJsonValue });
  }
  if ((await gateStatus(versionId, "G2_FGD")) === "PASSED") return { kind: "DONE" };
  const g2 = await evaluateFgdGateFor(versionId);
  return { kind: "WAITING", reason: g2.passed ? "WAITING_GATE:G2_FGD" : "WAITING_RESEARCHER:FGD_ADOPTION", detail: { unmet: g2.unmet.slice(0, 10) } };
}

async function deriveStep(run: Awaited<ReturnType<typeof loadRun>>, step: Step, source: string): Promise<StepResult> {
  const prisma = await db();
  if (!step.refId) {
    const parent = await prisma.artifactVersion.findUniqueOrThrow({ where: { id: source }, select: { label: true } });
    const taken = new Set((await prisma.artifactVersion.findMany({ select: { label: true } })).map((v) => v.label));
    const childId = await createDerivedVersion(run.createdById ?? "pipeline", source, suggestDerivedLabel(parent.label, taken), `Versi turunan run ${run.name}.`);
    await updateStep(step.id, { refType: "ArtifactVersion", refId: childId, versionId: childId });
    return { kind: "WAITING", reason: "WAITING_GATE:G1_BASELINE" };
  }
  // Revision tasks are applied by the researcher; the Admin then passes G1 and the inherited G2.
  if ((await gateStatus(step.refId, "G1_BASELINE")) !== "PASSED") return { kind: "WAITING", reason: "WAITING_GATE:G1_BASELINE" };
  if ((await gateStatus(step.refId, "G2_FGD")) !== "PASSED") return { kind: "WAITING", reason: "WAITING_GATE:G2_FGD" };
  return { kind: "DONE", versionId: step.refId };
}

async function delphiStep(run: Awaited<ReturnType<typeof loadRun>>, step: Step, plan: RunPlan): Promise<StepResult> {
  const prisma = await db();
  const versionId = step.versionId!;
  const last = await prisma.delphiRound.findFirst({ where: { versionId }, orderBy: { roundNumber: "desc" } });
  if (last && !last.finalizedAt) {
    if (last.status === "FAILED") return { kind: "FAILED", error: last.error ?? "Ronde Delphi berhenti." };
    if (last.status === "COMPLETED") return { kind: "WAITING", reason: "WAITING_RESEARCHER:DELPHI_REVIEW", detail: { round: last.roundNumber } };
    const o = await runNextDelphiItem(last.id);
    if (o.kind === "DEVIATION") return { kind: "FAILED", error: o.error };
    return { kind: "WORKED" };
  }
  const next = await planNextRound(versionId);
  if (next.blocked.includes("DELPHI_NOTHING_TO_RATE") || next.blocked.includes("DELPHI_MAX_ROUNDS")) {
    return (await gateStatus(versionId, "G3_DELPHI")) === "PASSED" ? { kind: "DONE" } : { kind: "WAITING", reason: "WAITING_GATE:G3_DELPHI" };
  }
  if (next.blocked.length) return { kind: "WAITING", reason: `WAITING_GATE:${next.blocked[0]}` };
  // Between rounds the researcher revises items; resuming the run acknowledges it.
  if (last && detailOf(step).revisedAfter !== last.roundNumber) {
    return { kind: "WAITING", reason: "WAITING_RESEARCHER:DELPHI_REVISE", detail: { revisedAfter: last.roundNumber, items: next.scopeCodes } };
  }
  const roundId = await createDelphiRound({ actorId: run.createdById ?? "pipeline", versionId, configId: plan.delphi.configId, seed: plan.delphi.seed + next.roundNumber, promptVersions: DELPHI_PROMPT_VERSIONS, runId: run.id });
  await updateStep(step.id, { refType: "DelphiRound", refId: roundId });
  return { kind: "WORKED" };
}

async function lockStep(step: Step): Promise<StepResult> {
  const prisma = await db();
  const locked = await prisma.artifactVersion.findFirst({ where: { parentId: step.versionId!, status: "CONTENT_LOCKED" }, select: { id: true } });
  if (!locked) return { kind: "WAITING", reason: "WAITING_GATE:G4_CONTENT_LOCK" };
  await updateStep(step.id, { refType: "ArtifactVersion", refId: locked.id });
  return { kind: "DONE", versionId: locked.id };
}

async function ahpStep(run: Awaited<ReturnType<typeof loadRun>>, step: Step, plan: RunPlan): Promise<StepResult> {
  const prisma = await db();
  const versionId = step.versionId!;
  if (!step.refId) {
    const id = await createAhpSession({ actorId: run.createdById ?? "pipeline", versionId, configId: plan.ahp.configId, seed: plan.ahp.seed, seatScopes: plan.ahp.seatScopes, scenarios: plan.ahp.scenarios, promptVersions: AHP_PROMPT_VERSIONS, runId: run.id });
    await updateStep(step.id, { refType: "AhpSession", refId: id });
    return { kind: "WORKED" };
  }
  const s = await prisma.ahpSession.findUniqueOrThrow({ where: { id: step.refId } });
  if (s.status === "FAILED") return { kind: "FAILED", error: s.error ?? "Sesi AHP berhenti." };
  if (s.status !== "COMPLETED") {
    const o = await runNextAhpMatrix(s.id);
    return o.kind === "FAILED" ? { kind: "FAILED", error: o.error } : { kind: "WORKED" };
  }
  return (await gateStatus(versionId, "G5_AHP")) === "PASSED" ? { kind: "DONE" } : { kind: "WAITING", reason: "WAITING_GATE:G5_AHP" };
}

async function scoringStep(run: Awaited<ReturnType<typeof loadRun>>, step: Step, plan: RunPlan): Promise<StepResult> {
  const prisma = await db();
  const versionId = step.versionId!;
  const ids = (detailOf(step).assessments as string[] | undefined) ?? [];
  if (ids.length < plan.scoring.profileIds.length) {
    const profileId = plan.scoring.profileIds[ids.length];
    const id = await createAssessment({ actorId: run.createdById ?? "pipeline", versionId, profileId, modelProfileId: plan.scoring.modelProfileId, seed: plan.scoring.seed, promptVersions: SCORING_PROMPT_VERSIONS, runId: run.id });
    await updateStep(step.id, { refType: "Assessment", refId: id, detail: { ...detailOf(step), assessments: [...ids, id] } as Prisma.InputJsonValue });
    return { kind: "WORKED" };
  }
  const open = await prisma.assessment.findFirst({ where: { id: { in: ids }, status: { not: "COMPLETED" } }, orderBy: { createdAt: "asc" } });
  if (open) {
    if (open.status === "FAILED" || open.status === "CANCELLED") return { kind: "FAILED", error: open.error ?? "Asesmen berhenti." };
    await updateStep(step.id, { refId: open.id });
    const o = await runNextScore(open.id);
    return o.kind === "FAILED" ? { kind: "FAILED", error: o.error } : { kind: "WORKED" };
  }
  if ((await gateStatus(versionId, "G6_SCORING")) === "PASSED") return { kind: "DONE" };
  // The independent recompute report is uploaded by the researcher (docs/05 §7).
  return { kind: "WAITING", reason: "WAITING_RESEARCHER:RECOMPUTE_AND_G6" };
}

export async function advanceRun(runId: string): Promise<AdvanceOutcome> {
  const run = await loadRun(runId);
  if (["COMPLETED", "CANCELLED", "FAILED"].includes(run.status)) return { kind: "STOPPED", status: run.status };
  const plan = run.stagesPlan as unknown as RunPlan;
  const index = run.steps.findIndex((s) => s.status !== "COMPLETED");
  if (index === -1) {
    await updateRun(runId, { status: "COMPLETED", endedAt: new Date(), waitReason: null });
    return { kind: "DONE" };
  }
  const step = run.steps[index];
  const kind = step.label as StepKind;
  if (!step.versionId && index > 0) {
    // Each step works on the version the previous step produced.
    const prev = run.steps[index - 1];
    const versionId = prev.label === "DERIVE" || prev.label === "LOCK" ? prev.refId! : prev.versionId!;
    await updateStep(step.id, { versionId });
    step.versionId = versionId;
  }
  await updateRun(runId, { status: "RUNNING", waitReason: null, ...(run.startedAt ? {} : { startedAt: new Date() }) });
  if (step.status === "QUEUED") await updateStep(step.id, { status: "RUNNING", startedAt: new Date() });

  let result: StepResult;
  try {
    result =
      kind === "FGD" ? await fgdStep(run, step, plan)
      : kind === "DERIVE" ? await deriveStep(run, step, run.steps[0].versionId!)
      : kind === "DELPHI" ? await delphiStep(run, step, plan)
      : kind === "LOCK" ? await lockStep(step)
      : kind === "AHP" ? await ahpStep(run, step, plan)
      : await scoringStep(run, step, plan);
  } catch (error) {
    result = { kind: "FAILED", error: error instanceof Error ? error.message : String(error) };
  }
  await refreshRunCosts(runId);

  if (result.kind === "FAILED") {
    await updateStep(step.id, { status: "FAILED", error: result.error });
    await updateRun(runId, { status: "FAILED", error: `${kind}: ${result.error}` });
    return { kind: "FAILED", step: kind, error: result.error };
  }
  if (result.kind === "WAITING") {
    await updateStep(step.id, { status: "PAUSED", waitReason: result.reason, ...(result.detail ? { detail: { ...detailOf(step), ...result.detail } as Prisma.InputJsonValue } : {}) });
    await updateRun(runId, { status: "PAUSED", waitReason: result.reason });
    return { kind: "WAITING", step: kind, reason: result.reason };
  }
  if (result.kind === "DONE") {
    await updateStep(step.id, { status: "COMPLETED", endedAt: new Date(), waitReason: null, error: null, ...(result.versionId ? { refId: result.versionId } : {}) });
    const last = index === run.steps.length - 1;
    if (last) {
      await updateRun(runId, { status: "COMPLETED", endedAt: new Date(), waitReason: null });
      return { kind: "DONE" };
    }
    if (run.mode === "STEP") {
      await updateRun(runId, { status: "PAUSED", waitReason: "STEP_DONE" });
      return { kind: "STEP_DONE", step: kind };
    }
    return { kind: "STEP_DONE", step: kind };
  }
  await updateStep(step.id, { status: "RUNNING", waitReason: null });
  return { kind: "WORKED", step: kind };
}

/** PAUSE / CANCEL / RETRY (the failed session is retried by its own control). */
export async function controlRun(actorId: string, runId: string, action: "PAUSE" | "CANCEL" | "RETRY") {
  const run = await loadRun(runId);
  const prisma = await db();
  if (action === "CANCEL") await updateRun(runId, { status: "CANCELLED", endedAt: new Date() });
  else if (action === "PAUSE") {
    if (run.status === "RUNNING" || run.status === "QUEUED") await updateRun(runId, { status: "PAUSED", waitReason: "PAUSED_BY_USER" });
  } else if (run.status === "FAILED") {
    const step = run.steps.find((s) => s.status === "FAILED");
    if (step?.refId) {
      if (step.refType === "FgdSession") await setSessionState(actorId, step.refId, "RETRY_FAILED");
      if (step.refType === "DelphiRound") await setDelphiRoundStatus(actorId, step.refId, "RETRY");
      if (step.refType === "AhpSession") await setAhpSessionStatus(actorId, step.refId, "RETRY");
      if (step.refType === "Assessment") await setAssessmentStatus(actorId, step.refId, "RETRY");
    }
    if (step) await updateStep(step.id, { status: "RUNNING", error: null });
    await updateRun(runId, { status: "PAUSED", error: null, waitReason: "RETRY" });
  }
  await prisma.auditEvent.create({ data: { actorId, actorKind: "USER", action: `PIPELINE_${action}`, targetType: "PipelineRun", targetId: runId, payload: {} } });
}
