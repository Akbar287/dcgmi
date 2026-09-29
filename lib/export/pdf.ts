import { degrees, PDFDocument, rgb, StandardFonts, type PDFFont, type PDFPage } from "pdf-lib";

import { needsWatermark, WATERMARK, type Cell, type ExportOrigin } from "./watermark";

// docs/07 P4 PDF: diagonal watermark on every page + header + footer. The
// standard fonts cover WinAnsi only, so text is transliterated, never dropped.
const MAP: Record<string, string> = { "≥": ">=", "≤": "<=", "≠": "!=", "→": "->", "←": "<-", "×": "x", "λ": "lambda", "κ": "kappa", "−": "-", "…": "...", "·": "-", "—": "-", "–": "-", "“": '"', "”": '"', "‘": "'", "’": "'", "✓": "v", "✗": "x", "↑": "^", "↓": "v" };

export function winAnsi(text: string): string {
  return [...text].map((ch) => MAP[ch] ?? (ch.charCodeAt(0) < 256 ? ch : "?")).join("");
}

const PAGE = { w: 842, h: 595 }; // A4 landscape
const MARGIN = 36;
const SIZE = 7.5;
const LINE = 9.5;

function wrap(text: string, font: PDFFont, width: number): string[] {
  const out: string[] = [];
  for (const para of text.split("\n")) {
    let line = "";
    for (const word of para.split(/\s+/)) {
      const probe = line ? `${line} ${word}` : word;
      if (font.widthOfTextAtSize(probe, SIZE) <= width) line = probe;
      else {
        if (line) out.push(line);
        // Break words longer than the column.
        let w = word;
        while (font.widthOfTextAtSize(w, SIZE) > width && w.length > 1) {
          let cut = w.length - 1;
          while (cut > 1 && font.widthOfTextAtSize(w.slice(0, cut), SIZE) > width) cut--;
          out.push(w.slice(0, cut));
          w = w.slice(cut);
        }
        line = w;
      }
    }
    out.push(line);
  }
  return out.slice(0, 12);
}

function decorate(page: PDFPage, font: PDFFont, bold: PDFFont, title: string, subtitle: string, n: number, total: number, watermark: boolean, origin: ExportOrigin) {
  if (watermark) {
    // Fit the text on the page diagonal whatever the font metrics are.
    const text = "SIMULASI - BUKAN DATA PENELITIAN";
    const angle = Math.atan2(PAGE.h - 2 * MARGIN, PAGE.w - 2 * MARGIN);
    const diagonal = Math.hypot(PAGE.w - 2 * MARGIN, PAGE.h - 2 * MARGIN) * 0.8;
    const size = Math.min(60, (diagonal / bold.widthOfTextAtSize(text, 10)) * 10);
    const w = bold.widthOfTextAtSize(text, size);
    const x = PAGE.w / 2 - (w / 2) * Math.cos(angle) + (size / 3) * Math.sin(angle);
    const y = PAGE.h / 2 - (w / 2) * Math.sin(angle) - (size / 3) * Math.cos(angle);
    page.drawText(text, { x, y, size, font: bold, rotate: degrees((angle * 180) / Math.PI), color: rgb(0.85, 0.55, 0.1), opacity: 0.16 });
  }
  page.drawText(winAnsi(title), { x: MARGIN, y: PAGE.h - MARGIN, size: 11, font: bold });
  page.drawText(winAnsi(subtitle), { x: MARGIN, y: PAGE.h - MARGIN - 13, size: 7.5, font, color: rgb(0.35, 0.35, 0.35) });
  const foot = winAnsi(watermark ? `${WATERMARK} _dataOrigin=${origin}` : `_dataOrigin=${origin}`);
  const words = foot.split(" ");
  const lines: string[] = [""];
  for (const word of words) {
    const probe = lines[lines.length - 1] ? `${lines[lines.length - 1]} ${word}` : word;
    if (font.widthOfTextAtSize(probe, 6.5) > PAGE.w - 2 * MARGIN - 50) lines.push(word);
    else lines[lines.length - 1] = probe;
  }
  lines.forEach((l, i) => page.drawText(l, { x: MARGIN, y: 22 - i * 8, size: 6.5, font, color: rgb(0.45, 0.3, 0) }));
  page.drawText(`${n} / ${total}`, { x: PAGE.w - MARGIN - 30, y: 18, size: 7, font });
}

/** Table export as PDF; the watermark cannot be switched off (derived from origin). */
export async function toPdf(title: string, subtitle: string, headers: string[], rows: Cell[][], origin: ExportOrigin): Promise<{ bytes: Uint8Array; pages: number; watermarked: number }> {
  const doc = await PDFDocument.create();
  const font = await doc.embedFont(StandardFonts.Helvetica);
  const bold = await doc.embedFont(StandardFonts.HelveticaBold);
  const watermark = needsWatermark(origin);
  const width = PAGE.w - MARGIN * 2;
  // Column widths from measured text: never narrower than the header or the
  // longest single word (so codes like SIMULATED do not break), capped for long text.
  const sample = rows.slice(0, 300);
  const measure = (s: string, f = font) => f.widthOfTextAtSize(winAnsi(s), SIZE);
  const minW = headers.map((h, i) => Math.min(120, Math.max(measure(h, bold), ...sample.map((r) => Math.max(0, ...String(r[i] ?? "").split(/\s+/).map((w) => measure(w)))))) + 6);
  const want = headers.map((h, i) => Math.min(260, Math.max(minW[i], ...sample.map((r) => measure(String(r[i] ?? "")) + 6))));
  const total = want.reduce((a, b) => a + b, 0);
  const colW = total <= width ? want.map((w) => w * (width / total)) : (() => {
    // Shrink only the flexible part above each column's minimum.
    const base = minW.reduce((a, b) => a + b, 0);
    const flex = want.map((w, i) => w - minW[i]);
    const room = Math.max(0, width - base);
    const flexSum = flex.reduce((a, b) => a + b, 0) || 1;
    const cols = minW.map((m, i) => m + (flex[i] / flexSum) * room);
    const scale = width / cols.reduce((a, b) => a + b, 0);
    return cols.map((c) => c * scale);
  })();

  const pages: PDFPage[] = [];
  let page!: PDFPage;
  let y = 0;
  const newPage = () => {
    page = doc.addPage([PAGE.w, PAGE.h]);
    pages.push(page);
    y = PAGE.h - MARGIN - 32;
    let x = MARGIN;
    headers.forEach((h, i) => {
      page.drawText(winAnsi(h).slice(0, 40), { x: x + 2, y, size: SIZE, font: bold });
      x += colW[i];
    });
    y -= 4;
    page.drawLine({ start: { x: MARGIN, y }, end: { x: PAGE.w - MARGIN, y }, thickness: 0.6, color: rgb(0.6, 0.6, 0.6) });
    y -= LINE;
  };
  newPage();
  for (const r of rows) {
    const cells = r.map((v, i) => wrap(winAnsi(v === null ? "" : String(v)), font, colW[i] - 4));
    const height = Math.max(1, ...cells.map((c) => c.length)) * LINE + 2;
    if (y - height < 32) newPage();
    let x = MARGIN;
    cells.forEach((lines, i) => {
      lines.forEach((l, k) => page.drawText(l, { x: x + 2, y: y - k * LINE, size: SIZE, font }));
      x += colW[i];
    });
    y -= height;
    page.drawLine({ start: { x: MARGIN, y: y + LINE - 2 }, end: { x: PAGE.w - MARGIN, y: y + LINE - 2 }, thickness: 0.2, color: rgb(0.85, 0.85, 0.85) });
  }
  pages.forEach((p, i) => decorate(p, font, bold, title, subtitle, i + 1, pages.length, watermark, origin));
  doc.setTitle(winAnsi(title));
  doc.setSubject(watermark ? winAnsi(WATERMARK) : "REAL");
  return { bytes: await doc.save(), pages: pages.length, watermarked: watermark ? pages.length : 0 };
}
