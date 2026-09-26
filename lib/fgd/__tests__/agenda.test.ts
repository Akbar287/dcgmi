import { describe, expect, it } from "vitest";

import { BASELINE_A1_0 } from "../../../prisma/baseline/dcgmi-a1-0";
import { AGENDA_CORONG_11, buildAgendaPlan, estimateCalls, seededShuffle } from "../agenda";
import { componentBrief, type BriefDomain } from "../component-brief";

const domains = BASELINE_A1_0.map((d) => ({
  code: d.code,
  name: d.name,
  aspects: d.aspects.map((a) => ({ code: a.code, name: a.name, indicators: a.indicators.map((i) => ({ code: i.code, name: i.name })) })),
}));
const all = AGENDA_CORONG_11.map((s) => s.key);

describe("FGD agenda", () => {
  it("has the 11 funnel stages of §3.7.2 in order", () => {
    expect(all).toEqual([
      "PEMBUKAAN",
      "VALIDASI_MASALAH",
      "STRUKTUR_DOMAIN",
      "STRUKTUR_ASPEK",
      "INDIKATOR",
      "RUBRIK",
      "FORMULA",
      "PEMBOBOTAN",
      "INTERPRETASI",
      "KONTEKS_INDONESIA",
      "PRIORITAS_REVISI",
    ]);
  });

  it("plans 116 components for the full agenda and ~14 calls each on a six-seat panel", () => {
    const plan = buildAgendaPlan(domains, { stages: all, domains: [] });
    expect(plan.map((s) => s.items.length)).toEqual([1, 1, 8, 15, 43, 43, 1, 1, 1, 1, 1]);
    expect(estimateCalls(plan, 6, 0)).toEqual({ components: 116, calls: 116 * 14 });
    expect(estimateCalls(plan, 6, 1).calls).toBe(116 * 20);
  });

  it("narrows only the per-component stages to the chosen domains", () => {
    const plan = buildAgendaPlan(domains, { stages: ["PEMBUKAAN", "INDIKATOR"], domains: ["D1"] });
    expect(plan.map((s) => [s.key, s.items.length])).toEqual([
      ["PEMBUKAAN", 1],
      ["INDIKATOR", 7],
    ]);
  });

  it("shuffles deterministically from the seed", () => {
    const seats = [1, 2, 3, 4, 5, 6];
    expect(seededShuffle(seats, 42)).toEqual(seededShuffle(seats, 42));
    expect(seededShuffle(seats, 42).sort()).toEqual(seats);
    expect(seededShuffle(seats, 42)).not.toEqual(seededShuffle(seats, 43));
  });

  it("presents the rubric only in the rubric stage and never a result value", () => {
    const d: BriefDomain[] = [
      {
        code: "D1",
        name: "Infrastruktur",
        rationale: null,
        aspects: [
          {
            code: "A01",
            name: "Jaringan",
            rationale: null,
            indicators: [
              {
                code: "C02",
                name: "Konektivitas",
                isControlledException: false,
                operationalDefinition: "Def",
                assessmentObject: "Obj",
                boundaryNote: "Batas",
                rubric: [{ level: 1, label: "Initial", descriptor: "Awal" }],
                evidence: [{ kind: "NORMATIF", minimumFor: 3, mandatory: true, description: "Kebijakan" }],
              },
            ],
          },
        ],
      },
    ];
    expect(componentBrief("INDIKATOR", "INDICATOR", "C02", d)).not.toContain("Rubrik:");
    expect(componentBrief("RUBRIK", "RUBRIC", "C02", d)).toContain("1. Initial: Awal");
    expect(componentBrief("FORMULA", "INSTRUMENT", "FORMULA", d)).toMatch(/A\(i,j\)/);
    expect(componentBrief("FORMULA", "INSTRUMENT", "FORMULA", d)).not.toMatch(/I-CVI|0,\d/);
  });
});
