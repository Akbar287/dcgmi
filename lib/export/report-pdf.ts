import type { ReportData } from "@/lib/db/repository/report-data";
import { buildReportBlocks, reportTitle, type Block, type ReportMeta } from "@/lib/report/blocks";
import type { ChapterState } from "@/lib/report/chapters";

import { svgToPng } from "./chart-png";
import { INK, ReportWriter } from "./pdf-writer";

export type { ReportMeta } from "@/lib/report/blocks";

const dt = (d: Date) => d.toISOString().replace("T", " ").slice(0, 16);

async function writeBlocks(w: ReportWriter, blocks: Block[]) {
  for (const b of blocks) {
    if (b.type === "cover") {
      w.newPage();
      w.y -= 120;
      w.text(b.title, { size: 18, font: w.bold, gap: 10 });
      w.text(b.subtitle, { size: 11, gap: 18 });
      w.keyValues(b.rows);
      w.text(b.note, { size: 8.5, color: INK.secondary });
      w.reserveToc(b.tocPages ?? 2);
    } else if (b.type === "heading") w.heading(b.text, b.level);
    else if (b.type === "narrative") {
      w.text(b.attribution, { size: 7, color: INK.muted, gap: 6 });
      for (const p of b.paragraphs) w.text(p, { size: 9, gap: 6 });
      w.y -= 4;
    } else if (b.type === "kv") w.keyValues(b.rows);
    else if (b.type === "table") w.table(b.columns, b.rows, { size: b.size });
    else if (b.type === "note") w.text(b.text, { size: 6.5, color: INK.muted });
    else if (b.type === "chart") {
      const img = svgToPng(b.svg);
      await w.image(img.png, img.height / img.width);
    }
  }
}

/**
 * Full G1–G7 report of the active lineage as PDF, without watermark at the
 * researcher's request (docs/07 P4 exception). Content comes from
 * buildReportBlocks, shared with the Word report.
 */
export async function renderReport(d: ReportData, chapters: ChapterState[], meta: ReportMeta) {
  const final = d.lineage[d.lineage.length - 1];
  return blocksToPdf(buildReportBlocks(d, chapters, meta), reportTitle(d), `${final.label} · ${dt(meta.generatedAt)}`);
}

/** Any block list (full report or one part) as PDF. */
export async function blocksToPdf(blocks: Block[], title: string, subtitle: string) {
  // No watermark or simulation marks on the report PDF (researcher decision 2026-09-29, docs/07 P4 exception).
  const w = await ReportWriter.create(title, "SIMULATED", { marks: false });
  await writeBlocks(w, blocks);
  return w.finish({ subtitle });
}
