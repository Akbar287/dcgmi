import { describe, expect, it } from "vitest";

import { validatePanel, type SeatForCheck } from "../composition";
import type { ExpertField } from "../presets";

const FGD: [ExpertField, string][] = [
  ["IT_GOVERNANCE", "openai"],
  ["IT_GOVERNANCE", "deepseek"],
  ["MANAJEMEN_PT", "qwen"],
  ["MANAJEMEN_PT", "anthropic"],
  ["SPBE", "google"],
  ["SUSTAINABILITY", "mistral"],
];

function seats(spec: [ExpertField, string][], opts: { newFrom?: number } = {}): SeatForCheck[] {
  return spec.map(([field, provider], i) => ({
    seatIndex: i + 1,
    label: `Pakar ${i + 1}`,
    field,
    isNewMember: opts.newFrom !== undefined && i >= opts.newFrom,
    contextScope: opts.newFrom !== undefined && i >= opts.newFrom ? "ARTIFACT_ONLY" : "FULL",
    expert: { id: `e${i}`, panelCode: `E${i + 1}`, field, personaStatus: "APPROVED" },
    model: { id: `m-${provider}`, label: provider, providerKey: provider, providerApproved: true, providerEnabled: true },
  }));
}

describe("validatePanel", () => {
  it("accepts the FGD-6 composition from §3.7.1", () => {
    expect(validatePanel("FGD_6", seats(FGD))).toEqual({ ready: true, issues: [], warnings: [] });
  });

  it("accepts DELPHI-8 with two isolated new members but warns on shared models", () => {
    const delphi = seats([...FGD, ["SPBE", "openai"], ["SUSTAINABILITY", "anthropic"]], { newFrom: 6 });
    const v = validatePanel("DELPHI_8", delphi);
    expect(v.issues).toEqual([]);
    expect(v.warnings.map((w) => [w.code, w.seats])).toEqual([
      ["SAME_MODEL", [1, 7]],
      ["SAME_MODEL", [4, 8]],
    ]);
  });

  it("blocks a new member that receives FGD context", () => {
    const delphi = seats([...FGD, ["SPBE", "openai"], ["SUSTAINABILITY", "anthropic"]], { newFrom: 6 });
    delphi[6].contextScope = "FULL";
    expect(validatePanel("DELPHI_8", delphi).issues.map((i) => i.code)).toEqual(["NEW_MEMBER_CONTEXT"]);
  });

  it("requires experts with matching field and an approved persona, once per panel", () => {
    const s = seats(FGD);
    s[0].expert = null;
    s[1].expert = { ...s[1].expert!, field: "SPBE", personaStatus: "DRAFT" };
    s[3].expert = { ...s[2].expert! };
    const codes = validatePanel("FGD_6", s).issues.map((i) => i.code).sort();
    expect(codes).toEqual(["DUPLICATE_EXPERT", "EXPERT_FIELD_MISMATCH", "EXPERT_MISSING", "PERSONA_NOT_APPROVED"]);
  });

  it("flags wrong field mix and unapproved providers", () => {
    const s = seats(FGD);
    s[5] = { ...s[5], field: "SPBE", expert: { ...s[5].expert!, field: "SPBE" }, model: { ...s[5].model, providerApproved: false } };
    const codes = validatePanel("FGD_6", s).issues.map((i) => i.code);
    expect(codes).toContain("FIELD_COMPOSITION");
    expect(codes).toContain("PROVIDER_NOT_APPROVED");
  });
});
