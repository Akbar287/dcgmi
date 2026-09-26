import { describe, expect, it } from "vitest";

import { loadPackage } from "../load";
import type { StoredIndicator } from "../types";
import { nameDifferences, validatePackage } from "../validate";

const { pkg } = loadPackage();

// Stored state as the baseline seed leaves it: structure and names only.
const stored: StoredIndicator[] = pkg.indicators.map((p) => ({
  code: p.code,
  domainCode: p.domainCode,
  aspectCode: p.aspectCode,
  name: p.name,
  isControlledException: p.isControlledException,
  operationalDefinition: null,
  rubric: [],
  evidence: [],
}));

describe("assessment package", () => {
  it("covers 43 indicators with rubric 1–5 and mandatory evidence each", () => {
    expect(pkg.indicators).toHaveLength(43);
    expect(pkg.rubric).toHaveLength(215);
    expect(validatePackage(pkg, stored)).toEqual([]);
    expect(pkg.indicators.filter((i) => i.isControlledException).map((i) => i.code).sort()).toEqual(["C20b", "C42"]);
  });

  it("refuses to add structure or move an indicator", () => {
    const moved = stored.map((s) => (s.code === "C02" ? { ...s, aspectCode: "A02" } : s));
    expect(validatePackage(pkg, moved)).toContain("Posisi C02 berbeda: artefak D1/A02, paket D1/A01.");
    expect(validatePackage(pkg, stored.filter((s) => s.code !== "C02"))[0]).toMatch(/C02 tidak ada di artefak/);
  });

  it("flags twin descriptors and missing levels", () => {
    const broken = structuredClone(pkg);
    const c02 = broken.rubric.filter((r) => r.indicatorCode === "C02");
    c02[1].descriptor = c02[0].descriptor;
    broken.rubric = broken.rubric.filter((r) => !(r.indicatorCode === "C03" && r.level === 5));
    const issues = validatePackage(broken, stored);
    expect(issues).toContain("Deskriptor kembar pada C02.");
    expect(issues).toContain("Rubrik C03 harus tepat level 1–5 (ada: 1,2,3,4).");
  });

  it("reports name differences without treating them as errors", () => {
    const renamed = stored.map((s) => (s.code === "C13" ? { ...s, name: "Struktur governance teknologi informasi" } : s));
    expect(nameDifferences(pkg, renamed)).toEqual([
      { code: "C13", stored: "Struktur governance teknologi informasi", packaged: "Struktur governance TI" },
    ]);
  });
});
