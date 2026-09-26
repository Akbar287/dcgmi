import { describe, expect, it } from "vitest";

import { diffVersions, type DiffIndicator } from "../diff";
import { checkRubric } from "../rubric-check";

const levels = [1, 2, 3, 4, 5].map((level) => ({ level, label: `L${level}`, descriptor: `Deskriptor ${level}` }));
const evidence = [2, 3, 4, 5].map((m) => ({ kind: "NORMATIF", minimumFor: m, mandatory: true }));

describe("checkRubric", () => {
  it("passes five distinct, evidence-backed levels", () => {
    expect(checkRubric(levels, evidence)).toEqual([]);
  });

  it("blocks gaps, empty and twin descriptors", () => {
    const bad = [...levels.slice(0, 3), { level: 4, label: "L4", descriptor: "deskriptor  3" }];
    const codes = checkRubric(bad, evidence).map((i) => `${i.code}${i.level ?? ""}`);
    expect(codes).toEqual(["LEVEL_SET", "TWIN_DESCRIPTOR4"]);
    expect(checkRubric([...levels.slice(0, 4), { level: 5, label: "L5", descriptor: " " }], evidence)[0]).toMatchObject({ code: "EMPTY_DESCRIPTOR", level: 5, blocking: true });
  });

  it("warns, without blocking, on levels no mandatory evidence supports", () => {
    const issues = checkRubric(levels, [{ kind: "HASIL", minimumFor: 4, mandatory: true }]);
    expect(issues.map((i) => [i.code, i.level, i.blocking])).toEqual([
      ["LEVEL_WITHOUT_EVIDENCE", 2, false],
      ["LEVEL_WITHOUT_EVIDENCE", 3, false],
    ]);
  });
});

const ind = (code: string, over: Partial<DiffIndicator> = {}): DiffIndicator => ({
  code,
  name: `Indikator ${code}`,
  domainCode: "D1",
  aspectCode: "A01",
  deleted: false,
  operationalDefinition: "Def",
  assessmentObject: "Obj",
  boundaryNote: null,
  rubric: levels,
  evidence: [{ kind: "NORMATIF", minimumFor: 3, mandatory: true, description: "Kebijakan" }],
  ...over,
});

describe("diffVersions", () => {
  it("reports added, removed (incl. soft-deleted), moved, reformulated, rubric and evidence changes", () => {
    const from = [ind("C01"), ind("C02"), ind("C03"), ind("C04")];
    const to = [
      ind("C01", { operationalDefinition: "Def baru" }),
      ind("C02", { aspectCode: "A02" }),
      ind("C03", { deleted: true }),
      ind("C04", { rubric: [...levels.slice(0, 4), { level: 5, label: "L5", descriptor: "Baru" }], evidence: [] }),
      ind("C99", { domainCode: "D2", aspectCode: "A04" }),
    ];
    expect(diffVersions(from, to).map((d) => `${d.code}:${d.kind}:${d.detail}`)).toEqual([
      "C01:REFORMULATED:operationalDefinition",
      "C02:MOVED:D1/A01 → D1/A02",
      "C03:REMOVED:D1/A01",
      "C04:EVIDENCE_CHANGED:1 → 0",
      "C04:RUBRIC_CHANGED:",
      "C99:ADDED:D2/A04",
    ]);
  });

  it("finds nothing between identical versions", () => {
    expect(diffVersions([ind("C01")], [ind("C01")])).toEqual([]);
  });
});
