import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { assessIndicator, assessmentProblem } from "../scoring";
import { mockAssessment } from "../mock/scoring-fixtures";
import { SCORING_ASSESSOR_EVIDENCE } from "../prompts/scoring";
import { SIMULATION_BOUNDARY } from "../prompts/fgd";

const evidence = [
  { id: "E1", kind: "NORMATIF", minimumFor: 2, mandatory: true, description: "SK" },
  { id: "E2", kind: "IMPLEMENTASI", minimumFor: 3, mandatory: true, description: "Log" },
];
const ctx = (profileText: string) => ({ profileLabel: "[FIKTIF] PTS Contoh", profileText, indicatorPackage: "Indikator C05 — …", evidence });
const target = { providerKey: "gateway", modelId: "openai/gpt-x", envKeyName: "AI_GATEWAY_API_KEY", baseUrl: null };

let previous: string | undefined;
beforeEach(() => {
  previous = process.env.MOCK_AI;
  process.env.MOCK_AI = "1";
});
afterEach(() => {
  process.env.MOCK_AI = previous;
});

describe("assessor prompt and checks", () => {
  it("carries id, version, boundary, and no weights or formula", () => {
    const text = SCORING_ASSESSOR_EVIDENCE.render(ctx("Profil."));
    expect(SCORING_ASSESSOR_EVIDENCE.id).toBe("scoring.assessor.evidence");
    expect(text).toContain(SIMULATION_BOUNDARY);
    expect(text).not.toMatch(/bobot|w\(i\)|DCGMI =|komposit/i);
  });

  it("rejects inconsistent or non-verbatim output", () => {
    const c = ctx("C05: SK rektor tersedia sejak 2024.");
    expect(assessmentProblem({ missingKind: "MISSING_ADMINISTRATIF", level: 2, satisfiedEvidence: [], evidenceLocator: null, rationale: "x".repeat(10) }, c)).toMatch(/level null/);
    expect(assessmentProblem({ missingKind: "NONE", level: 2, satisfiedEvidence: ["E9"], evidenceLocator: "SK", rationale: "x".repeat(10) }, c)).toMatch(/tidak dikenal/);
    expect(assessmentProblem({ missingKind: "NONE", level: 2, satisfiedEvidence: ["E1"], evidenceLocator: "SK dekan", rationale: "x".repeat(10) }, c)).toMatch(/verbatim/);
    expect(assessmentProblem({ missingKind: "NONE", level: 2, satisfiedEvidence: ["E1"], evidenceLocator: "SK rektor tersedia", rationale: "x".repeat(10) }, c)).toBeNull();
  });

  it("mock follows the fictional profile's steering lines", () => {
    expect(mockAssessment("C05", ctx("C05: dokumen belum diterima."), 1).missingKind).toBe("MISSING_ADMINISTRATIF");
    const none = mockAssessment("C05", ctx("C05: tidak ada praktik ini."), 1);
    expect([none.missingKind, none.level]).toEqual(["TIDAK_ADA_KAPABILITAS", 1]);
    const l3 = mockAssessment("C05", ctx("C05: kebijakan dan log tersedia, level 3."), 1);
    expect([l3.level, l3.satisfiedEvidence]).toEqual([3, ["E1", "E2"]]);
  });

  it("a failing caller check fails the call after the retry (no default value)", async () => {
    await expect(assessIndicator(target, "C05", ctx("C05: level 3."), 1, () => "melebihi plafon")).rejects.toThrow(/skema setelah 2 percobaan/);
  });
});
