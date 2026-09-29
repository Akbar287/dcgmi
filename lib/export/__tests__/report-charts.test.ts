import { describe, expect, it } from "vitest";

import { svgToPng } from "../chart-png";
import { barChart, columns, donut, dotRange, groupedBars, heatmap, lineChart, stackedBars, tornado } from "../chart-svg";
import { blocksToDocx } from "../report-docx";

const isSvg = (s: string) => s.startsWith("<svg") && s.endsWith("</svg>");

describe("report charts (SVG)", () => {
  it("bar chart prints values, a reference line, and held (null) rows", () => {
    const svg = barChart("I-CVI", [{ label: "C01", value: 0.875 }, { label: "C02", value: null, note: "ditahan" }], { max: 1, digits: 3, reference: { value: 0.78, label: "0,78" } });
    expect(isSvg(svg)).toBe(true);
    expect(svg).toContain("0,875");
    expect(svg).toContain("stroke-dasharray");
    expect(svg).toContain("ditahan");
  });

  it("donut shows the total and each slice with its share", () => {
    const svg = donut("Adopsi", [{ label: "Diadopsi", value: 3 }, { label: "Tidak", value: 1 }]);
    expect(svg).toContain(">4<");
    expect(svg).toContain("3 (75,0%)");
    expect(svg).toContain("1 (25,0%)");
  });

  it("heatmap prints values and leaves null cells empty", () => {
    const svg = heatmap("A×B", ["A=1", "A=2"], ["B=1", "B=2"], [[2, null], [0, 5]], { frameDiagonal: true });
    expect(svg).toContain(">5<");
    expect(svg).not.toContain(">null<");
    expect(svg).toContain("bingkai = diagonal");
  });

  it("other builders render and escape labels", () => {
    for (const svg of [
      stackedBars("S", ["a", "b"], [{ label: "x & y", counts: { a: 2, b: 1 } }]),
      groupedBars("G", ["D1"], [{ name: "P1", values: [3.2] }, { name: "P2", values: [null] }]),
      columns("C", ["1", "2"], [{ name: "n", values: [4, 0] }]),
      lineChart("L", ["01:00", "02:00"], [{ name: "calls", values: [10, 30] }]),
      tornado("T", [{ label: "D1", base: 0.2, low: 0.1, high: 0.3 }]),
      dotRange("W", [{ label: "D1", aggregate: 0.25, individual: [0.2, 0.3] }]),
    ]) expect(isSvg(svg)).toBe(true);
    expect(stackedBars("S", ["a"], [{ label: "x & y", counts: { a: 1 } }])).toContain("x &amp; y");
  });

  it("rasterises with the bundled font", () => {
    const img = svgToPng(donut("Uji ≥ 0,78", [{ label: "a", value: 1 }]));
    expect(img.png.byteLength).toBeGreaterThan(1000);
    expect(img.width).toBe(900);
  });
});

describe("Word report", () => {
  it("builds a .docx with headings, tables, and chart images", async () => {
    const bytes = await blocksToDocx(
      [
        { type: "cover", title: "LAPORAN", subtitle: "G1–G7", rows: [["Dibuat", "2026-09-29"], ["Asal data", "SIMULATED"]], note: "catatan" },
        { type: "heading", text: "1. Pendahuluan", level: 1 },
        { type: "narrative", attribution: "Narasi AI", paragraphs: ["Paragraf satu."] },
        { type: "table", columns: [{ header: "Kode" }, { header: "Nilai", align: "right" }], rows: [["C01", 0.875], ["C02", null]] },
        { type: "chart", title: "Donut", svg: donut("Donut", [{ label: "a", value: 2 }]) },
      ],
      "Laporan uji",
    );
    const zip = Buffer.from(bytes).toString("latin1");
    expect(zip.startsWith("PK")).toBe(true);
    expect(zip).toContain("word/document.xml");
    expect(zip).toContain("word/media/");
  });
});
