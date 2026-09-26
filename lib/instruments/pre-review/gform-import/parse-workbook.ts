import ExcelJS from "exceljs";

export interface ParsedRow {
  rowNumber: number;
  timestamp: unknown;
  cells: string[];
}

export interface ParsedWorkbook {
  sheetNames: string[];
  responseSheet: string | null;
  headers: string[];
  rows: ParsedRow[];
  /** Build_Info written by the Apps Script (Parameter → Value), when exported with the spreadsheet. */
  buildInfo: Record<string, string> | null;
}

const TIMESTAMP_HEADER = /^(timestamp|stempel waktu|cap waktu|marca temporal)$/i;

function text(value: ExcelJS.CellValue): string {
  if (value === null || value === undefined) return "";
  if (value instanceof Date) return value.toISOString();
  if (typeof value === "object") {
    if ("richText" in value) return value.richText.map((r) => r.text).join("");
    if ("text" in value && typeof value.text === "string") return value.text;
    if ("result" in value) return text(value.result as ExcelJS.CellValue);
    if ("error" in value) return "";
  }
  return String(value);
}

function rowValues(row: ExcelJS.Row, width: number): ExcelJS.CellValue[] {
  return Array.from({ length: width }, (_, i) => row.getCell(i + 1).value);
}

/**
 * Reads a Google Sheets response export. The response sheet is found by its
 * timestamp header (the sheet name is localized: "Form Responses 1",
 * "Tanggapan Formulir 1", …); among candidates the one matching the most
 * expected question titles wins.
 */
export async function parseGoogleWorkbook(buffer: ArrayBuffer, expectedTitles: string[]): Promise<ParsedWorkbook> {
  const book = new ExcelJS.Workbook();
  await book.xlsx.load(buffer);
  const expected = new Set(expectedTitles);

  let best: { sheet: ExcelJS.Worksheet; headers: string[]; score: number } | null = null;
  for (const sheet of book.worksheets) {
    const width = sheet.actualColumnCount;
    if (width === 0) continue;
    const headers = rowValues(sheet.getRow(1), width).map((v) => text(v).trim());
    if (!TIMESTAMP_HEADER.test(headers[0] ?? "")) continue;
    const score = headers.filter((h) => expected.has(h)).length;
    if (!best || score > best.score) best = { sheet, headers, score };
  }

  let buildInfo: Record<string, string> | null = null;
  const info = book.getWorksheet("Build_Info");
  if (info) {
    buildInfo = {};
    info.eachRow((row, n) => {
      if (n === 1) return;
      const key = text(row.getCell(1).value).trim();
      if (key) buildInfo![key] = text(row.getCell(2).value).trim();
    });
  }

  const rows: ParsedRow[] = [];
  if (best) {
    const width = best.headers.length;
    best.sheet.eachRow((row, n) => {
      if (n === 1) return;
      const values = rowValues(row, width);
      const cells = values.map((v) => text(v));
      if (cells.every((c) => c.trim() === "")) return;
      rows.push({ rowNumber: n, timestamp: values[0], cells });
    });
  }

  return {
    sheetNames: book.worksheets.map((s) => s.name),
    responseSheet: best?.sheet.name ?? null,
    headers: best?.headers ?? [],
    rows,
    buildInfo,
  };
}

const WIB_OFFSET_MS = 7 * 60 * 60 * 1000;

/**
 * Google exports timestamps as timezone-less wall-clock values. They are read
 * as WIB (Asia/Jakarta, UTC+7) — the zone the R1–V2.1.2B script works in —
 * and the preview says so.
 */
export function parseTimestamp(value: unknown): Date | null {
  if (value instanceof Date && !Number.isNaN(value.getTime())) return new Date(value.getTime() - WIB_OFFSET_MS);
  if (typeof value !== "string") return null;
  const s = value.trim();
  const id = /^(\d{1,2})\/(\d{1,2})\/(\d{4})[ ,T]+(\d{1,2}):(\d{2})(?::(\d{2}))?$/.exec(s);
  if (id) {
    const [, d, m, y, h, min, sec] = id.map(Number);
    return new Date(Date.UTC(y, m - 1, d, h, min, sec || 0) - WIB_OFFSET_MS);
  }
  const iso = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}/.test(s) ? new Date(s) : null;
  return iso && !Number.isNaN(iso.getTime()) ? iso : null;
}
