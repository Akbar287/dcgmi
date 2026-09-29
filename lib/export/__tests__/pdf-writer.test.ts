import { describe, expect, it } from "vitest";

import { ReportWriter } from "../pdf-writer";

describe("ReportWriter marks", () => {
  it("watermarks every page of a simulated report by default (docs/07 P4)", async () => {
    const w = await ReportWriter.create("Uji", "SIMULATED");
    w.newPage();
    w.text("isi");
    w.newPage();
    const r = await w.finish({ subtitle: "uji" });
    expect(r.watermarked).toBe(r.pages);
  });

  it("drops all marks only when asked (G1–G7 report exception)", async () => {
    const w = await ReportWriter.create("Uji", "SIMULATED", { marks: false });
    w.newPage();
    w.text("isi");
    const r = await w.finish({ subtitle: "uji" });
    expect(r.watermarked).toBe(0);
  });
});
