import { describe, expect, it } from "vitest";

import { exportFilename, exportOrigin, needsWatermark, sheetName, toCsv, toJson, WATERMARK } from "../watermark";

describe("docs/07 P4 watermark", () => {
  it("derives the origin; anything not REAL-only is watermarked", () => {
    expect(exportOrigin(["SIMULATED", "SIMULATED"], "artefak")).toBe("SIMULATED");
    expect(exportOrigin(["REAL"], "instrumen")).toBe("REAL");
    expect(exportOrigin(["REAL", "SIMULATED"], "instrumen")).toBe("MIXED");
    expect(exportOrigin([], "fgd")).toBe("SIMULATED");
    expect(exportOrigin([], "artefak")).toBe("NONE");
    expect(needsWatermark("NONE")).toBe(true);
    expect(needsWatermark("MIXED")).toBe(true);
    expect(needsWatermark("REAL")).toBe(false);
  });

  it("CSV: three comment lines first and a _SIMULATED file suffix", () => {
    const csv = toCsv(["a", "b"], [["=SUM(A1)", "x,y"]], "SIMULATED").split("\n");
    expect(csv.slice(0, 3).every((l) => l.startsWith("# "))).toBe(true);
    expect(csv[0]).toContain("KELUARAN SIMULASI");
    expect(csv[4]).toBe(`'=SUM(A1),"x,y"`);
    expect(exportFilename("fgd sesi", "csv", "SIMULATED")).toBe("SIM_fgd_sesi_SIMULATED.csv");
  });

  it("JSON: _warning and _dataOrigin at the root", () => {
    const doc = JSON.parse(toJson({ table: "x" }, ["a"], [{ a: 1 }], "SIMULATED"));
    expect(doc._warning).toBe(WATERMARK);
    expect(doc._dataOrigin).toBe("SIMULATED");
    expect(Object.keys(doc).slice(0, 2)).toEqual(["_warning", "_dataOrigin"]);
  });

  it("XLSX sheet names start with SIM_ and fit 31 characters", () => {
    expect(sheetName("Matriks Pairwise yang sangat panjang sekali", "SIMULATED")).toMatch(/^SIM_.{0,27}$/);
    expect(exportFilename("x", "xlsx", "REAL")).toBe("x.xlsx");
  });
});
