import ExcelJS from "exceljs";

import { can } from "@/lib/auth/roles";
import { getCurrentUser } from "@/lib/auth/session";
import { db } from "@/lib/db/client";
import { getExportRecords } from "@/lib/db/repository/pre-review";
import { normalizeResponses, safeCell, type Row } from "@/lib/instruments/pre-review/normalize";

const HEADER_FILL = { type: "pattern", pattern: "solid", fgColor: { argb: "FF1F4E78" } } as const;

function addSheet(book: ExcelJS.Workbook, name: string, rows: Row[]) {
  const sheet = book.addWorksheet(name, { views: [{ state: "frozen", ySplit: 1 }] });
  rows.forEach((r) => sheet.addRow(r.map(safeCell)));
  const header = sheet.getRow(1);
  header.font = { bold: true, color: { argb: "FFFFFFFF" } };
  header.eachCell((c) => (c.fill = HEADER_FILL));
  sheet.columns.forEach((c) => {
    c.width = 24;
    c.alignment = { wrapText: true, vertical: "top" };
  });
}

// Port of exportResponses_(): reads the stored responses every time, never a
// cached dashboard, and neither computes CVI nor sets FGD decisions.
export async function GET(_request: Request, { params }: RouteContext<"/api/forms/[slug]/export">) {
  const user = await getCurrentUser();
  if (!user || !can(user.role, "instrument:manage")) return new Response("Forbidden", { status: 403 });

  const { slug } = await params;
  const prisma = await db();
  const form = await prisma.form.findUnique({ where: { slug }, select: { id: true } });
  if (!form) return new Response("Not found", { status: 404 });

  const { snapshot, records } = await getExportRecords(form.id);
  const result = normalizeResponses(records, snapshot.data);
  const stamp = new Date().toISOString().replace(/[-:]/g, "").replace(/\..+/, "");

  const book = new ExcelJS.Workbook();
  addSheet(book, "Build_Info", [
    ["Parameter", "Value"],
    ["Version", snapshot.builderVersion],
    ["Mode", snapshot.mode],
    ["Data origin", "REAL — pakar manusia; tidak pernah digabung dengan data SIMULATED"],
    ["Data SHA-256", snapshot.dataSha256],
    ["Build signature", snapshot.signature],
    ["Source questions", snapshot.source.questions.file],
    ["Source FGD", snapshot.source.fgd.file],
    ["Source questions SHA-256", snapshot.source.questions.sha256],
    ["Source FGD SHA-256", snapshot.source.fgd.sha256],
    ["Google test evidence", snapshot.config.TEST_EVIDENCE_NOTE],
    ["Scope limitation", "Rubrik/deskriptor level 1–5 tidak tersedia pada kedua workbook sumber."],
    ["Exported at", new Date().toISOString()],
    ["Exported by", user.id],
    ["Matching", "Cocokkan Expert ID + Canonical ID, bukan posisi baris. Duplikat/invalid tidak dipilih otomatis; periksa QC."],
  ]);
  addSheet(book, "DataEntry", result.data);
  addSheet(book, "Supplement", result.supplement);
  addSheet(book, "QC", result.qc);

  await prisma.auditEvent.create({
    data: {
      actorId: user.id,
      actorKind: "USER",
      action: "FORM_EXPORT",
      targetType: "Form",
      targetId: form.id,
      payload: { rows: result.data.length - 1, qualityIssues: result.qc.length - 1 },
    },
  });

  const buffer = await book.xlsx.writeBuffer();
  return new Response(buffer, {
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename="${snapshot.builderVersion}_${snapshot.mode}_REAL_${stamp}.xlsx"`,
      "Cache-Control": "no-store",
    },
  });
}
