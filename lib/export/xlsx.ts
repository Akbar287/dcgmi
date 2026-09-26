import ExcelJS from "exceljs";

import { needsWatermark, safeCell, sheetName, WATERMARK, type Cell, type ExportOrigin } from "./watermark";

/** docs/07 P4 XLSX: frozen watermark row on top of every sheet + SIM_ sheet name. */
export async function toXlsx(name: string, headers: string[], rows: Cell[][], origin: ExportOrigin): Promise<Buffer> {
  const book = new ExcelJS.Workbook();
  const watermark = needsWatermark(origin);
  const sheet = book.addWorksheet(sheetName(name, origin), { views: [{ state: "frozen", ySplit: watermark ? 2 : 1 }] });
  if (watermark) {
    const row = sheet.addRow([`${WATERMARK} _dataOrigin=${origin}`]);
    sheet.mergeCells(1, 1, 1, Math.max(1, headers.length));
    row.font = { bold: true, color: { argb: "FF7A4B00" } };
    row.getCell(1).fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFFFE8A3" } };
    row.getCell(1).alignment = { wrapText: true, vertical: "middle" };
    row.height = 36;
  }
  const header = sheet.addRow(headers);
  header.font = { bold: true };
  for (const r of rows) sheet.addRow(r.map((v) => safeCell(v)));
  sheet.columns.forEach((c) => (c.width = 22));
  return Buffer.from(await book.xlsx.writeBuffer());
}
