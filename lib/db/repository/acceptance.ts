import ExcelJS from "exceljs";

import { exportFilename, sheetName, toCsv, toJson, WATERMARK } from "@/lib/export/watermark";
import { toPdf } from "@/lib/export/pdf";
import { toXlsx } from "@/lib/export/xlsx";
import { GateError } from "@/lib/method/errors";
import { assertGate, evaluateAhpGate, evaluateBaselineGate } from "@/lib/method/gates";
import { runMethodSelfCheck } from "@/lib/method/selfcheck";

import { db } from "../client";
import { assertSingleOrigin, OriginMismatchError } from "../origin";
import { getArtifactSnapshot } from "./artifact";
import { evaluateScoringGateFor } from "./scoring-runs";

export interface Criterion {
  n: number;
  ok: boolean;
  detail: string;
}

/**
 * SPECIFICATION §6 acceptance criteria, evaluated live against the running
 * code and the stored data of the active version (not a static checklist).
 */
export async function evaluateAcceptance(versionId: string | null): Promise<Criterion[]> {
  const prisma = await db();
  const out: Criterion[] = [];

  const self = runMethodSelfCheck();
  const failed = self.filter((c) => !c.ok);
  out.push({ n: 1, ok: failed.length === 0, detail: failed.length ? `gagal: ${failed.map((c) => c.id).join(", ")}` : `${self.length} vektor docs/05 lulus saat dijalankan` });

  if (versionId) {
    const g6 = await evaluateScoringGateFor(versionId);
    const c = g6.lastCheck;
    const ok = !!c && c.ok && c.exportSha256 === g6.exportSha256;
    out.push({ n: 2, ok, detail: c ? `laporan ${c.ok ? "identik" : `berbeda (${c.diffCount})`}${c.exportSha256 === g6.exportSha256 ? "" : ", untuk ekspor lama"}` : "belum ada laporan recompute.py untuk versi aktif" });
  } else out.push({ n: 2, ok: false, detail: "tidak ada versi aktif" });

  try {
    assertGate(evaluateAhpGate({ contentLocked: false, expectedGroups: ["DOMAIN"], groups: [], sensitivityRun: false }));
    out.push({ n: 3, ok: false, detail: "tidak melempar GateError" });
  } catch (e) {
    out.push({ n: 3, ok: e instanceof GateError && e.unmet.includes("CONTENT_NOT_LOCKED"), detail: e instanceof Error ? e.message : String(e) });
  }

  try {
    assertSingleOrigin([{ dataOrigin: "SIMULATED" }, { dataOrigin: "REAL" }]);
    out.push({ n: 4, ok: false, detail: "tidak melempar OriginMismatchError" });
  } catch (e) {
    out.push({ n: 4, ok: e instanceof OriginMismatchError, detail: e instanceof Error ? e.message : String(e) });
  }

  const csv = toCsv(["a"], [[1]], "SIMULATED");
  const json = JSON.parse(toJson({}, ["a"], [{ a: 1 }], "SIMULATED"));
  const book = new ExcelJS.Workbook();
  await book.xlsx.load((await toXlsx("uji", ["a"], [[1]], "SIMULATED")) as unknown as ArrayBuffer);
  const sheet = book.worksheets[0];
  const xlsxOk = sheet.name === sheetName("uji", "SIMULATED") && String(sheet.getRow(1).getCell(1).value).startsWith(WATERMARK.slice(0, 20)) && (sheet.views[0] as { ySplit?: number }).ySplit === 2;
  const pdf = await toPdf("uji", "uji", ["a"], Array.from({ length: 120 }, (_, i) => [i]), "SIMULATED");
  const pdfOk = pdf.pages > 1 && pdf.watermarked === pdf.pages;
  const wmOk = csv.startsWith("# KELUARAN SIMULASI") && json._warning === WATERMARK && json._dataOrigin === "SIMULATED" && xlsxOk && pdfOk && exportFilename("x", "csv", "SIMULATED").startsWith("SIM_");
  out.push({ n: 5, ok: wmOk, detail: wmOk ? `CSV, XLSX, JSON, PDF (${pdf.pages} halaman, semuanya berwatermark), dan nama berkas SIM_ diperiksa; pengecualian tercatat: laporan G1–G7 (PDF/Word) tanpa watermark atas keputusan peneliti 29 Sep 2026` : "watermark tidak lengkap" });

  const deviating = await prisma.delphiItemResult.count({ where: { validRaters: { not: 8 } } });
  out.push({ n: 6, ok: deviating === 0, detail: deviating ? `${deviating} hasil butir dengan penilai valid ≠ 8 tersimpan` : "tidak ada hasil butir dengan penilai ≠ 8; ronde menyimpang dihentikan (C7)" });

  const passedG1 = await prisma.gateRecord.findMany({ where: { gate: "G1_BASELINE", status: "PASSED" }, include: { version: { select: { label: true } } } });
  const broken: string[] = [];
  for (const g of passedG1) {
    const e = evaluateBaselineGate(await getArtifactSnapshot(g.versionId));
    if (!e.passed) broken.push(g.version.label);
  }
  out.push({ n: 7, ok: broken.length === 0 && passedG1.length > 0, detail: broken.length ? `G1 lulus tetapi paket tidak lengkap: ${broken.join(", ")}` : `${passedG1.length} versi dengan G1 lulus, semuanya lengkap` });
  return out;
}
