import { degrees, PDFDocument, rgb, StandardFonts, type PDFFont, type PDFPage, type RGB } from "pdf-lib";

import { winAnsi } from "./pdf";
import { needsWatermark, WATERMARK, type ExportOrigin } from "./watermark";

// Flowing PDF layout for the full report (docs/07 P4 watermark on every
// page). Nothing is truncated: long cells continue on the next page with the
// table header repeated.

export const hex = (h: string): RGB => rgb(parseInt(h.slice(1, 3), 16) / 255, parseInt(h.slice(3, 5), 16) / 255, parseInt(h.slice(5, 7), 16) / 255);

export const INK = { primary: hex("#0b0b0b"), secondary: hex("#52514e"), muted: hex("#898781"), grid: hex("#e1e0d9"), baseline: hex("#c3c2b7"), surface: hex("#fcfcfb"), stripe: hex("#f4f3ef") };

export type Cell = string | number | boolean | null | undefined;

export interface Column {
  header: string;
  /** Relative width weight. */
  weight?: number;
  align?: "left" | "right";
}

export class ReportWriter {
  readonly doc: PDFDocument;
  font!: PDFFont;
  bold!: PDFFont;
  page!: PDFPage;
  y = 0;
  readonly w = 595; // A4 portrait
  readonly h = 842;
  readonly margin = 42;
  readonly toc: { title: string; level: number; page: number }[] = [];
  private pages: PDFPage[] = [];
  private tocPages: PDFPage[] = [];

  private constructor(doc: PDFDocument, readonly title: string, readonly origin: ExportOrigin, readonly marks: boolean) {
    this.doc = doc;
  }

  /**
   * `marks: false` drops the watermark, the footer warning, and the subject
   * warning — only for the G1–G7 report at the researcher's explicit request
   * (CHANGELOG-METHOD 2026-09-29). Every other export keeps docs/07 P4.
   */
  static async create(title: string, origin: ExportOrigin, opts: { marks?: boolean } = {}) {
    const doc = await PDFDocument.create();
    const w = new ReportWriter(doc, title, origin, opts.marks ?? true);
    w.font = await doc.embedFont(StandardFonts.Helvetica);
    w.bold = await doc.embedFont(StandardFonts.HelveticaBold);
    return w;
  }

  get width() {
    return this.w - this.margin * 2;
  }

  get pageCount() {
    return this.pages.length;
  }

  newPage() {
    this.page = this.doc.addPage([this.w, this.h]);
    this.pages.push(this.page);
    this.y = this.h - this.margin - 18;
    return this.page;
  }

  /** Reserve pages for the table of contents, filled in at the end. */
  reserveToc(n: number) {
    for (let i = 0; i < n; i++) this.tocPages.push(this.newPage());
  }

  ensure(height: number) {
    if (this.y - height < this.margin + 16) this.newPage();
  }

  lines(text: string, size: number, width: number, font = this.font): string[] {
    const out: string[] = [];
    for (const para of winAnsi(text).split("\n")) {
      let line = "";
      for (const word of para.split(/\s+/)) {
        if (!word) continue;
        const probe = line ? `${line} ${word}` : word;
        if (font.widthOfTextAtSize(probe, size) <= width) {
          line = probe;
          continue;
        }
        if (line) out.push(line);
        let rest = word;
        while (font.widthOfTextAtSize(rest, size) > width && rest.length > 1) {
          let cut = rest.length - 1;
          while (cut > 1 && font.widthOfTextAtSize(rest.slice(0, cut), size) > width) cut--;
          out.push(rest.slice(0, cut));
          rest = rest.slice(cut);
        }
        line = rest;
      }
      out.push(line);
    }
    return out;
  }

  text(t: string, opts: { size?: number; font?: PDFFont; color?: RGB; indent?: number; gap?: number } = {}) {
    const size = opts.size ?? 9;
    const lh = size * 1.35;
    for (const l of this.lines(t, size, this.width - (opts.indent ?? 0), opts.font)) {
      this.ensure(lh);
      this.page.drawText(l, { x: this.margin + (opts.indent ?? 0), y: this.y, size, font: opts.font ?? this.font, color: opts.color ?? INK.primary });
      this.y -= lh;
    }
    this.y -= opts.gap ?? 4;
  }

  heading(t: string, level: 1 | 2 | 3) {
    const size = level === 1 ? 16 : level === 2 ? 12 : 10;
    if (level === 1) this.newPage();
    else this.ensure(size * 3);
    this.y -= level === 1 ? 0 : 6;
    this.toc.push({ title: t, level, page: this.pages.length });
    this.text(t, { size, font: this.bold, gap: level === 1 ? 8 : 4 });
  }

  keyValues(rows: [string, Cell][]) {
    const kw = 150;
    for (const [k, v] of rows) {
      const vl = this.lines(String(v ?? "—"), 8.5, this.width - kw);
      this.ensure(vl.length * 11.5);
      this.page.drawText(winAnsi(k), { x: this.margin, y: this.y, size: 8.5, font: this.bold, color: INK.secondary });
      vl.forEach((l, i) => this.page.drawText(l, { x: this.margin + kw, y: this.y - i * 11.5, size: 8.5, font: this.font }));
      this.y -= vl.length * 11.5 + 2;
    }
    this.y -= 4;
  }

  /** Full table; rows that do not fit continue on the next page (header repeated). */
  table(columns: Column[], rows: Cell[][], opts: { size?: number } = {}) {
    const size = opts.size ?? 7;
    const lh = size * 1.3;
    const total = columns.reduce((n, c) => n + (c.weight ?? 1), 0);
    const widths = columns.map((c) => ((c.weight ?? 1) / total) * this.width);
    const header = () => {
      const hl = columns.map((c, i) => this.lines(c.header, size, widths[i] - 4, this.bold));
      const hh = Math.max(...hl.map((l) => l.length)) * lh + 4;
      this.ensure(hh + lh * 2);
      let x = this.margin;
      hl.forEach((ls, i) => {
        ls.forEach((l, k) => {
          const hw = this.bold.widthOfTextAtSize(l, size);
          this.page.drawText(l, { x: columns[i].align === "right" ? x + widths[i] - 2 - hw : x + 2, y: this.y - k * lh, size, font: this.bold, color: INK.secondary });
        });
        x += widths[i];
      });
      this.y -= hh - lh + 2;
      this.page.drawLine({ start: { x: this.margin, y: this.y + lh - 3 }, end: { x: this.margin + this.width, y: this.y + lh - 3 }, thickness: 0.6, color: INK.baseline });
      this.y -= 2;
    };
    if (rows.length === 0) {
      header();
      this.text("(tidak ada data)", { size, color: INK.muted });
      return;
    }
    header();
    rows.forEach((r, ri) => {
      let cells = r.map((v, i) => this.lines(v === null || v === undefined ? "—" : typeof v === "boolean" ? (v ? "ya" : "tidak") : String(v), size, widths[i] - 4));
      while (cells.some((c) => c.length)) {
        const room = Math.max(1, Math.floor((this.y - this.margin - 16) / lh));
        if (room < 2) {
          this.newPage();
          header();
          continue;
        }
        const take = Math.min(room, Math.max(...cells.map((c) => c.length)));
        if (ri % 2 === 1) this.page.drawRectangle({ x: this.margin, y: this.y - (take - 1) * lh - 2.5, width: this.width, height: take * lh + 1, color: INK.stripe });
        let x = this.margin;
        cells.forEach((c, i) => {
          c.slice(0, take).forEach((l, k) => {
            const tw = this.font.widthOfTextAtSize(l, size);
            this.page.drawText(l, { x: columns[i].align === "right" ? x + widths[i] - 2 - tw : x + 2, y: this.y - k * lh, size, font: this.font, color: INK.primary });
          });
          x += widths[i];
        });
        this.y -= take * lh + 1.5;
        cells = cells.map((c) => c.slice(take));
        if (cells.some((c) => c.length)) {
          this.newPage();
          header();
        }
      }
    });
    this.y -= 6;
  }

  /** A PNG chart scaled to the text width; moves to a new page when it does not fit. */
  async image(png: Uint8Array, ratio: number) {
    const img = await this.doc.embedPng(png);
    const width = this.width;
    const height = width * ratio;
    this.ensure(height + 8);
    this.page.drawImage(img, { x: this.margin, y: this.y - height, width, height });
    this.y -= height + 12;
  }

  /** Reserve an area and let a chart draw into it (x, y = bottom-left). */
  area(height: number, draw: (page: PDFPage, x: number, y: number, w: number, h: number) => void) {
    this.ensure(height + 6);
    draw(this.page, this.margin, this.y - height, this.width, height);
    this.y -= height + 10;
  }

  async finish(meta: { subtitle: string }) {
    const n = this.pages.length;
    const wm = this.marks && needsWatermark(this.origin);
    // Table of contents.
    let tp = 0;
    let ty = this.h - this.margin - 18;
    const tocPage = () => this.tocPages[tp];
    if (tocPage()) {
      tocPage().drawText("Daftar isi", { x: this.margin, y: ty, size: 16, font: this.bold });
      ty -= 26;
      for (const e of this.toc.filter((x) => x.level <= 2)) {
        if (ty < this.margin + 20) {
          tp++;
          if (!tocPage()) break;
          ty = this.h - this.margin - 18;
        }
        const size = e.level === 1 ? 9.5 : 8.5;
        const indent = e.level === 1 ? 0 : 14;
        const label = winAnsi(e.title).slice(0, 95);
        tocPage().drawText(label, { x: this.margin + indent, y: ty, size, font: e.level === 1 ? this.bold : this.font });
        const num = String(e.page);
        tocPage().drawText(num, { x: this.w - this.margin - this.font.widthOfTextAtSize(num, size), y: ty, size, font: this.font, color: INK.secondary });
        ty -= size * 1.55;
      }
    }
    this.pages.forEach((p, i) => {
      if (wm) {
        const text = "SIMULASI - BUKAN DATA PENELITIAN";
        const angle = Math.atan2(this.h - 2 * this.margin, this.w - 2 * this.margin);
        const diag = Math.hypot(this.w - 2 * this.margin, this.h - 2 * this.margin) * 0.82;
        const size = Math.min(56, (diag / this.bold.widthOfTextAtSize(text, 10)) * 10);
        const tw = this.bold.widthOfTextAtSize(text, size);
        p.drawText(text, {
          x: this.w / 2 - (tw / 2) * Math.cos(angle) + (size / 3) * Math.sin(angle),
          y: this.h / 2 - (tw / 2) * Math.sin(angle) - (size / 3) * Math.cos(angle),
          size,
          font: this.bold,
          rotate: degrees((angle * 180) / Math.PI),
          color: hex("#d98f1f"),
          opacity: 0.13,
        });
      }
      p.drawText(winAnsi(this.title), { x: this.margin, y: this.h - this.margin + 12, size: 7.5, font: this.bold, color: INK.secondary });
      p.drawText(winAnsi(meta.subtitle), { x: this.w - this.margin - this.font.widthOfTextAtSize(winAnsi(meta.subtitle), 7), y: this.h - this.margin + 12, size: 7, font: this.font, color: INK.muted });
      const foot = this.marks ? this.lines(wm ? `${WATERMARK} _dataOrigin=${this.origin}` : `_dataOrigin=${this.origin}`, 6.3, this.width - 40) : [];
      foot.forEach((l, k) => p.drawText(l, { x: this.margin, y: 24 - k * 7.5, size: 6.3, font: this.font, color: hex("#7a5200") }));
      const num = `${i + 1} / ${n}`;
      p.drawText(num, { x: this.w - this.margin - this.font.widthOfTextAtSize(num, 7), y: 24, size: 7, font: this.font, color: INK.secondary });
    });
    this.doc.setTitle(winAnsi(this.title));
    this.doc.setSubject(wm ? winAnsi(WATERMARK) : this.marks ? "REAL" : winAnsi(this.title));
    this.doc.setCreator("DCGMI Dry-Run Console");
    return { bytes: await this.doc.save({ useObjectStreams: true }), pages: n, watermarked: wm ? n : 0 };
  }
}
