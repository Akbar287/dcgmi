import { join } from "node:path";

import { Resvg } from "@resvg/resvg-js";

// SVG charts → PNG for the PDF and Word reports. The font is bundled
// (DejaVu Sans) so text renders the same on servers without system fonts.

const FONT_DIR = join(process.cwd(), "node_modules", "dejavu-fonts-ttf", "ttf");
const FONT_FILES = ["DejaVuSans.ttf", "DejaVuSans-Bold.ttf"].map((f) => join(FONT_DIR, f));

export interface ChartImage {
  png: Uint8Array;
  /** Logical size in SVG pixels (the PNG is rendered at 2×). */
  width: number;
  height: number;
}

export function svgToPng(svg: string, scale = 2): ChartImage {
  const r = new Resvg(svg, { fitTo: { mode: "zoom", value: scale }, font: { fontFiles: FONT_FILES, loadSystemFonts: false, defaultFontFamily: "DejaVu Sans" }, background: "#ffffff" });
  const img = r.render();
  return { png: img.asPng(), width: img.width / scale, height: img.height / scale };
}
