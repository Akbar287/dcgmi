import { callObject, type CallLog, type CallTarget } from "./call";
import { mockAssessment } from "./mock/scoring-fixtures";
import { ASSESSOR_SYSTEM, SCORING_ASSESSOR_EVIDENCE, type AssessContext } from "./prompts/scoring";
import { AssessmentSchema, type AssessorOutput } from "./schemas";

/**
 * Checks the schema cannot express (docs/04 §10): internal consistency and a
 * verbatim locator. `extra` adds the caller's method checks (the evidence
 * cap lives in lib/method, which lib/ai must not import).
 */
export function assessmentProblem(value: AssessorOutput, c: AssessContext): string | null {
  if ((value.missingKind === "MISSING_ADMINISTRATIF") !== (value.level === null)) return "MISSING_ADMINISTRATIF wajib level null, dan sebaliknya";
  const ids = new Set(c.evidence.map((e) => e.id));
  const unknown = value.satisfiedEvidence.filter((id) => !ids.has(id));
  if (unknown.length) return `id bukti tidak dikenal: ${unknown.join(", ")}`;
  if (value.satisfiedEvidence.length && !value.evidenceLocator?.trim()) return "bukti terpenuhi tanpa locator";
  if (value.evidenceLocator && !c.profileText.includes(value.evidenceLocator)) {
    // Still rejected; the hint only tells the retry what differs (a common slip: capitalising a mid-sentence start).
    const caseOnly = c.profileText.toLowerCase().includes(value.evidenceLocator.toLowerCase());
    return caseOnly
      ? "locator bukan kutipan verbatim dari profil: huruf besar/kecil berbeda — salin persis seperti di profil, termasuk huruf pertama bila kutipan dimulai di tengah kalimat"
      : "locator bukan kutipan verbatim dari profil";
  }
  return null;
}

export async function assessIndicator(
  target: CallTarget,
  code: string,
  c: AssessContext,
  mockSeed: number,
  extra: (value: AssessorOutput) => string | null,
): Promise<{ value: AssessorOutput; log: CallLog }> {
  return callObject({
    target,
    prompt: SCORING_ASSESSOR_EVIDENCE,
    system: ASSESSOR_SYSTEM,
    text: SCORING_ASSESSOR_EVIDENCE.render(c),
    schema: AssessmentSchema,
    maxOutputTokens: 600,
    mock: () => mockAssessment(code, c, mockSeed, target.modelId),
    validate: (v) => assessmentProblem(v, c) ?? extra(v),
  });
}
