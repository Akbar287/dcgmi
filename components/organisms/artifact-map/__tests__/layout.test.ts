import { describe, expect, it } from "vitest";

import { incompleteIndicators } from "../../../../app/(app)/_lib/gate-view";
import { BASELINE_A1_0 } from "../../../../prisma/baseline/dcgmi-a1-0";

import { computeLayout, GEOMETRY, lineage, type MapDomain } from "../layout";

const domains: MapDomain[] = BASELINE_A1_0.map((d) => ({
  code: d.code,
  name: d.name,
  aspects: d.aspects.map((a) => ({
    code: a.code,
    name: a.name,
    indicators: a.indicators.map((i) => ({
      code: i.code,
      name: i.name,
      isControlledException: false,
      operationalDefinition: null,
      complete: true,
    })),
  })),
}));

describe("artifact map layout", () => {
  const { nodes, links, height } = computeLayout(domains);
  const by = (level: string) => nodes.filter((n) => n.level === level);

  it("lays out the 8–15–43 baseline with one link per parent-child pair", () => {
    expect([by("domain").length, by("aspect").length, by("indicator").length]).toEqual([8, 15, 43]);
    expect(links).toHaveLength(15 + 43);
    expect(height).toBeGreaterThan(43 * GEOMETRY.row);
  });

  it("assigns categorical slots by domain order, never by size", () => {
    expect(by("domain").map((d) => d.slot)).toEqual([1, 2, 3, 4, 5, 6, 7, 8]);
    expect(nodes.every((n) => n.slot === nodes.find((d) => d.id === n.domainId)!.slot)).toBe(true);
  });

  it("centres each parent on its children and never overlaps leaves", () => {
    const leaves = by("indicator").map((n) => n.y);
    leaves.slice(1).forEach((y, i) => expect(y - leaves[i]).toBeGreaterThanOrEqual(GEOMETRY.row));
    for (const a of by("aspect")) {
      const kids = nodes.filter((n) => n.aspectId === a.id && n.level === "indicator").map((n) => n.y);
      expect(a.y).toBeCloseTo((Math.min(...kids) + Math.max(...kids)) / 2);
    }
  });

  it("highlights ancestors and descendants of the active node", () => {
    const set = lineage(nodes, "a:D1/A01")!;
    expect([...set].filter((id) => id.startsWith("i:")).sort()).toEqual(["i:C02", "i:C03", "i:C04"]);
    expect(set.has("d:D1")).toBe(true);
    expect(set.has("d:D2")).toBe(false);
  });
});

describe("incompleteIndicators", () => {
  it("reads indicator codes from G1 unmet entries only", () => {
    const codes = incompleteIndicators({
      gate: "G1_BASELINE",
      passed: false,
      unmet: ["INDICATOR_WITHOUT_RUBRIC: C02", "RUBRIC_LEVEL_GAP: C03 [1,2]", "CONTROLLED_EXCEPTION_MISSING: C42"],
      warnings: [],
    });
    expect([...codes].sort()).toEqual(["C02", "C03"]);
  });
});
