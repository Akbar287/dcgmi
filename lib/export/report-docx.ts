import { AlignmentType, BorderStyle, Document, Footer, HeadingLevel, ImageRun, Packer, PageNumber, Paragraph, ShadingType, Table, TableCell, TableOfContents, TableRow, TextRun, WidthType } from "docx";

import type { ReportData } from "@/lib/db/repository/report-data";
import { buildReportBlocks, reportTitle, type Block, type Cell, type ReportMeta } from "@/lib/report/blocks";
import type { ChapterState } from "@/lib/report/chapters";

import { svgToPng } from "./chart-png";

// Word (.docx) version of the full G1–G7 report (researcher decision
// 29 Sep 2026): same blocks as the PDF, charts as PNG, and — at the
// researcher's explicit request — no watermark, simulation note, or SIM_
// prefix (recorded in CHANGELOG-METHOD; the PDF keeps docs/07 P4).

const INK = { secondary: "52514E", muted: "898781", header: "EEF3FB", stripe: "F7F6F2", border: "C3C2B7" };
/** Text width of A4 portrait with 2 cm margins, in pixels at 96 dpi. */
const PAGE_WIDTH_PX = 642;
const HEADINGS = { 1: HeadingLevel.HEADING_1, 2: HeadingLevel.HEADING_2, 3: HeadingLevel.HEADING_3 } as const;

const cellText = (v: Cell) => (v === null || v === undefined ? "—" : typeof v === "boolean" ? (v ? "ya" : "tidak") : String(v));
const border = { style: BorderStyle.SINGLE, size: 2, color: INK.border };
const borders = { top: border, bottom: border, left: border, right: border };

function table(b: Extract<Block, { type: "table" }>) {
  const size = Math.round(((b.size ?? 7) + 1) * 2); // half-points: 7 pt in the PDF ≈ 8 pt in Word
  const total = b.columns.reduce((n, c) => n + (c.weight ?? 1), 0);
  const widths = b.columns.map((c) => Math.round(((c.weight ?? 1) / total) * 9638)); // twips (17 cm)
  const para = (t: string, bold: boolean, right: boolean) =>
    new Paragraph({ alignment: right ? AlignmentType.RIGHT : AlignmentType.LEFT, spacing: { before: 0, after: 0 }, children: [new TextRun({ text: t, bold, size })] });
  const header = new TableRow({
    tableHeader: true,
    children: b.columns.map((c, i) => new TableCell({ width: { size: widths[i], type: WidthType.DXA }, borders, shading: { type: ShadingType.CLEAR, color: "auto", fill: INK.header }, children: [para(c.header, true, c.align === "right")] })),
  });
  const rows = b.rows.length
    ? b.rows.map((r, ri) => new TableRow({ children: b.columns.map((c, i) => new TableCell({ width: { size: widths[i], type: WidthType.DXA }, borders, ...(ri % 2 ? { shading: { type: ShadingType.CLEAR, color: "auto", fill: INK.stripe } } : {}), children: [para(cellText(r[i]), false, c.align === "right")] })) }))
    : [new TableRow({ children: [new TableCell({ columnSpan: b.columns.length, borders, children: [para("(tidak ada data)", false, false)] })] })];
  return new Table({ width: { size: 9638, type: WidthType.DXA }, columnWidths: widths, rows: [header, ...rows] });
}

function keyValues(rows: [string, Cell][]) {
  return new Table({
    width: { size: 9638, type: WidthType.DXA },
    columnWidths: [2900, 6738],
    rows: rows.map(([k, v]) => new TableRow({ children: [
      new TableCell({ width: { size: 2900, type: WidthType.DXA }, borders, children: [new Paragraph({ children: [new TextRun({ text: k, bold: true, size: 18, color: INK.secondary })] })] }),
      new TableCell({ width: { size: 6738, type: WidthType.DXA }, borders, children: [new Paragraph({ children: [new TextRun({ text: cellText(v), size: 18 })] })] }),
    ] })),
  });
}

function toDocx(blocks: Block[]) {
  const children: (Paragraph | Table | TableOfContents)[] = [];
  const spacer = () => new Paragraph({ spacing: { after: 120 }, children: [] });
  for (const b of blocks) {
    if (b.type === "cover") {
      children.push(new Paragraph({ spacing: { before: 2400, after: 240 }, children: [new TextRun({ text: b.title, bold: true, size: 40 })] }));
      children.push(new Paragraph({ spacing: { after: 480 }, children: [new TextRun({ text: b.subtitle, size: 24 })] }));
      children.push(keyValues(b.rows.filter(([k]) => k !== "Asal data")));
      children.push(new Paragraph({ spacing: { before: 240 }, children: [new TextRun({ text: b.note, size: 18, color: INK.secondary })] }));
      children.push(new Paragraph({ pageBreakBefore: true, heading: HeadingLevel.TITLE, children: [new TextRun({ text: "Daftar isi" })] }));
      children.push(new TableOfContents("Daftar isi", { hyperlink: true, headingStyleRange: "1-2" }));
    } else if (b.type === "heading") {
      children.push(new Paragraph({ heading: HEADINGS[b.level], pageBreakBefore: b.level === 1, children: [new TextRun({ text: b.text })] }));
    } else if (b.type === "narrative") {
      children.push(new Paragraph({ spacing: { after: 120 }, children: [new TextRun({ text: b.attribution, italics: true, size: 16, color: INK.muted })] }));
      for (const p of b.paragraphs) children.push(new Paragraph({ spacing: { after: 160 }, alignment: AlignmentType.JUSTIFIED, children: [new TextRun({ text: p, size: 21 })] }));
    } else if (b.type === "kv") {
      children.push(keyValues(b.rows), spacer());
    } else if (b.type === "table") {
      children.push(table(b), spacer());
    } else if (b.type === "note") {
      children.push(new Paragraph({ spacing: { after: 160 }, children: [new TextRun({ text: b.text, size: 16, color: INK.muted })] }));
    } else if (b.type === "chart") {
      const img = svgToPng(b.svg);
      const width = Math.min(PAGE_WIDTH_PX, img.width);
      children.push(new Paragraph({ keepNext: true, spacing: { before: 120, after: 60 }, children: [new ImageRun({ type: "png", data: img.png, transformation: { width, height: Math.round(width * (img.height / img.width)) }, altText: { title: b.title, description: b.title, name: b.title } })] }));
    }
  }
  return children;
}

export async function renderReportDocx(d: ReportData, chapters: ChapterState[], meta: ReportMeta): Promise<Uint8Array> {
  return blocksToDocx(buildReportBlocks(d, chapters, meta), reportTitle(d));
}

export async function blocksToDocx(blocks: Block[], title: string): Promise<Uint8Array> {
  const children = toDocx(blocks);
  const doc = new Document({
    title,
    creator: "DCGMI Dry-Run Console",
    features: { updateFields: true },
    styles: {
      default: { document: { run: { font: "Calibri", size: 20 } } },
      paragraphStyles: [
        { id: "Heading1", name: "Heading 1", basedOn: "Normal", next: "Normal", quickFormat: true, run: { size: 32, bold: true, color: "0B0B0B" }, paragraph: { spacing: { before: 240, after: 160 } } },
        { id: "Heading2", name: "Heading 2", basedOn: "Normal", next: "Normal", quickFormat: true, run: { size: 26, bold: true, color: "184F95" }, paragraph: { spacing: { before: 240, after: 120 }, keepNext: true } },
        { id: "Heading3", name: "Heading 3", basedOn: "Normal", next: "Normal", quickFormat: true, run: { size: 22, bold: true, color: "52514E" }, paragraph: { spacing: { before: 200, after: 100 }, keepNext: true } },
      ],
    },
    sections: [
      {
        properties: { page: { margin: { top: 1134, bottom: 1134, left: 1134, right: 1134 } } },
        footers: {
          default: new Footer({ children: [new Paragraph({ alignment: AlignmentType.RIGHT, children: [new TextRun({ children: [PageNumber.CURRENT, " / ", PageNumber.TOTAL_PAGES], size: 16, color: INK.muted })] })] }),
        },
        children,
      },
    ],
  });
  return new Uint8Array(await Packer.toBuffer(doc));
}
