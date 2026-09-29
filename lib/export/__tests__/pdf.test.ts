import { describe, expect, it } from "vitest";

import { toPdf, winAnsi } from "../pdf";

describe("docs/07 P4 PDF", () => {
  it("watermarks every page of a simulated export, none for REAL", async () => {
    const rows = Array.from({ length: 150 }, (_, i) => [`C${i}`, "Deskripsi panjang ≥ dua baris — dengan simbol κ dan λ", i]);
    const sim = await toPdf("Uji", "sub", ["Kode", "Deskripsi", "N"], rows, "SIMULATED");
    expect(sim.pages).toBeGreaterThan(1);
    expect(sim.watermarked).toBe(sim.pages);
    expect(Buffer.from(sim.bytes.slice(0, 5)).toString()).toBe("%PDF-");
    const real = await toPdf("Uji", "sub", ["Kode"], [["C1"]], "REAL");
    expect(real.watermarked).toBe(0);
  });
  it("transliterates characters outside WinAnsi instead of dropping them", () => {
    expect(winAnsi("I-CVI ≥ 0,78 → κ")).toBe("I-CVI >= 0,78 -> kappa");
  });
});
