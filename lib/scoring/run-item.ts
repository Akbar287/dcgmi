import { withCallSink, type CallTarget } from "@/lib/ai/call";
import { SCORING_ASSESSOR_EVIDENCE } from "@/lib/ai/prompts/scoring";
import { assessIndicator } from "@/lib/ai/scoring";
import { finalizeAssessment, loadAssessmentContext, nextIndicatorToScore, saveScore, setAssessmentStatus } from "@/lib/db/repository/scoring-runs";
import { createCallSink } from "@/lib/db/repository/model-calls";
import { hash32 } from "@/lib/fgd/agenda";
import { indicatorPackage } from "@/lib/fgd/component-brief";
import { evidenceLevelCap } from "@/lib/method/scoring";

export const SCORING_PROMPT_VERSIONS = { [SCORING_ASSESSOR_EVIDENCE.id]: SCORING_ASSESSOR_EVIDENCE.version };

export type ScoringRunOutcome =
  | { kind: "NOTHING" | "BLOCKED"; status: string }
  | { kind: "ITEM_DONE" | "ASSESSMENT_DONE"; code: string; level: number | null; missingKind: string }
  | { kind: "FAILED"; error: string };

/**
 * One indicator per call (SPECIFICATION §4.8): the assessor reads the
 * fictional profile against the rubric and evidence list; lib/method sets
 * the evidence ceiling and a level above it is rejected, never trimmed.
 * After the last indicator the rollup runs with the G5 weights.
 */
export async function runNextScore(assessmentId: string): Promise<ScoringRunOutcome> {
  const { assessment: a } = await loadAssessmentContext(assessmentId);
  const sink = await createCallSink({ kind: "SCORING", refType: "Assessment", refId: assessmentId, versionId: a.versionId, runId: a.runId, budgetUsd: a.budgetUsd === null ? null : Number(a.budgetUsd) });
  return withCallSink(sink, () => scoreNext(assessmentId));
}

async function scoreNext(assessmentId: string): Promise<ScoringRunOutcome> {
  const { assessment, model } = await loadAssessmentContext(assessmentId);
  if (["COMPLETED", "CANCELLED"].includes(assessment.status)) return { kind: "NOTHING", status: assessment.status };
  if (assessment.status === "FAILED") return { kind: "BLOCKED", status: assessment.status };
  if (!assessment.profile || !model) {
    const error = "Profil atau model asesor tidak ditemukan.";
    await setAssessmentStatus(null, assessmentId, "FAIL", error);
    return { kind: "FAILED", error };
  }
  const ind = await nextIndicatorToScore(assessmentId);
  if (!ind) {
    // Every indicator is scored but the rollup did not finish (e.g. after a retry).
    try {
      await finalizeAssessment(assessmentId);
      return { kind: "ASSESSMENT_DONE", code: "", level: null, missingKind: "NONE" };
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      await setAssessmentStatus(null, assessmentId, "FAIL", `rollup: ${message}`);
      return { kind: "FAILED", error: message };
    }
  }
  await setAssessmentStatus(null, assessmentId, "START");

  const evidence = ind.evidence.map((e, i) => ({ id: `E${i + 1}`, dbId: e.id, kind: e.kind, minimumFor: e.minimumFor, mandatory: e.mandatory, description: e.description }));
  const ctx = {
    profileLabel: assessment.profile.label,
    profileText: assessment.profile.description,
    indicatorPackage: `Domain/aspek: ${ind.aspect.domain.code} ${ind.aspect.domain.name} / ${ind.aspect.code} ${ind.aspect.name}\n${indicatorPackage(
      {
        code: ind.code,
        name: ind.name,
        isControlledException: ind.isControlledException,
        operationalDefinition: ind.operationalDefinition,
        assessmentObject: ind.assessmentObject,
        boundaryNote: ind.boundaryNote,
        rubric: ind.rubricLevels.map((r) => ({ level: r.level, label: r.label, descriptor: r.descriptor })),
        evidence: [],
      },
      true,
    )}`,
    evidence: evidence.map((e) => ({ id: e.id, kind: e.kind, minimumFor: e.minimumFor, mandatory: e.mandatory, description: e.description })),
  };
  const target: CallTarget = { providerKey: model.provider.key, modelId: model.modelId, envKeyName: model.provider.envKeyName, baseUrl: model.provider.baseUrl, temperature: 0.2, seed: assessment.seed };
  const capOf = (satisfied: string[]) => evidenceLevelCap(evidence, satisfied);

  try {
    const r = await assessIndicator(target, ind.code, ctx, hash32(`${assessment.seed}|scoring`), (v) => {
      if (v.level === null || v.level <= capOf(v.satisfiedEvidence)) return null;
      // Name the unmet mandatory evidence so the single retry can fix the choice (the cap rule itself is unchanged).
      const missing = evidence.filter((e) => e.mandatory && (e.minimumFor ?? 1) <= v.level! && !v.satisfiedEvidence.includes(e.id)).map((e) => `${e.id} (L${e.minimumFor ?? 1})`);
      return `level ${v.level} melebihi plafon bukti wajib ${capOf(v.satisfiedEvidence)} (docs/05 §5.5); bukti wajib belum dipilih: ${missing.join(", ")} — pilih bila profil memuatnya, atau turunkan level`;
    });
    const saved = await saveScore(assessmentId, ind.id, {
      level: r.value.level,
      missingKind: r.value.missingKind,
      satisfiedEvidence: r.value.satisfiedEvidence.map((id) => evidence.find((e) => e.id === id)!.dbId),
      levelCap: capOf(r.value.satisfiedEvidence),
      evidenceLocator: r.value.evidenceLocator,
      rationale: r.value.rationale,
      log: r.log,
    });
    return { kind: saved.done ? "ASSESSMENT_DONE" : "ITEM_DONE", code: ind.code, level: r.value.level, missingKind: r.value.missingKind };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    await setAssessmentStatus(null, assessmentId, "FAIL", `${ind.code}: ${message}`);
    return { kind: "FAILED", error: message };
  }
}
