import ExcelJS from "exceljs";
import { beforeAll, describe, expect, it } from "vitest";

import { CONSENT_NO, CONSENT_YES } from "../../answers";
import { loadBuilderScript } from "../../load-builder-script";
import type { PreReviewSnapshot } from "../../types";
import { parseGoogleWorkbook, parseTimestamp } from "../parse-workbook";
import { buildPreview, type ExistingResponses } from "../preview";

let snap: PreReviewSnapshot;
const none: ExistingResponses = { byCode: new Map(), importedKeys: new Set() };

beforeAll(() => {
  snap = loadBuilderScript();
});

function answersFor(code: string, decision?: string): Record<string, string> {
  const a: Record<string, string> = { consent: CONSENT_YES, expert: code, fgdAvailability: "Bersedia" };
  for (const x of snap.data.items) {
    const d = decision ?? snap.data.options.decision[0];
    a[`${x.id}:decision`] = d;
    a[`${x.id}:evidence`] = snap.data.options.evidence[0];
    a[`${x.id}:clarity`] = snap.data.options.clarity[0];
    a[`${x.id}:comment`] = "Tidak ada catatan";
    a[`${x.id}:revision`] = "Tidak ada usulan";
  }
  return a;
}

/** A workbook shaped like Google's export: Timestamp + one column per question title. */
async function workbook(rows: { at: Date; answers: Record<string, string> }[], buildInfo?: [string, string][]) {
  const book = new ExcelJS.Workbook();
  const questions = snap.plan.filter((p) => p.type !== "PAGE");
  const sheet = book.addWorksheet("Tanggapan Formulir 1");
  sheet.addRow(["Stempel waktu", ...questions.map((q) => q.title)]);
  for (const r of rows) sheet.addRow([r.at, ...questions.map((q) => r.answers[q.key] ?? "")]);
  if (buildInfo) {
    const info = book.addWorksheet("Build_Info");
    info.addRow(["Parameter", "Value"]);
    buildInfo.forEach((b) => info.addRow(b));
  }
  const buffer = await book.xlsx.writeBuffer();
  return parseGoogleWorkbook(buffer as ArrayBuffer, questions.map((q) => q.title));
}

// Google exports wall-clock WIB as a timezone-less date; exceljs reads it as UTC.
const wib = (h: number, m = 0) => new Date(Date.UTC(2026, 8, 25, h, m));

describe("Google Form response import", () => {
  it("maps every question column by its exact title and reads WIB timestamps", async () => {
    const parsed = await workbook([{ at: wib(10), answers: answersFor("P01") }], [["Mode", "PRODUCTION"], ["Data SHA-256", snap.dataSha256]]);
    const { preview, rows } = buildPreview(parsed, snap, none);
    expect(preview.fileIssues).toEqual([]);
    expect(preview.matchedColumns).toBe(262);
    expect(preview.missingTitles).toEqual([]);
    expect(rows[0]).toMatchObject({ status: "READY", code: "P01", timestamp: "2026-09-25T03:00:00.000Z", qc: [] });
    expect(rows[0].answers["D1-A01-C02:decision"]).toBe(snap.data.options.decision[0]);
  });

  it("keeps a refusal as choice and time only, and holds duplicates, test codes, and unknown codes", async () => {
    const parsed = await workbook([
      { at: wib(9), answers: { consent: CONSENT_NO } },
      { at: wib(10), answers: answersFor("P02") },
      { at: wib(11), answers: answersFor("P02") },
      { at: wib(12), answers: answersFor("T01") },
      { at: wib(13), answers: answersFor("P99") },
    ]);
    const { preview, rows } = buildPreview(parsed, snap, none);
    expect(rows.map((r) => [r.status, r.reason])).toEqual([
      ["DECLINED", undefined],
      ["BLOCKED", "DUPLICATE_IN_FILE"],
      ["BLOCKED", "DUPLICATE_IN_FILE"],
      ["BLOCKED", "TEST_CODE"],
      ["BLOCKED", "INVALID_EXPERT"],
    ]);
    expect(rows[0].answers).toEqual({ consent: CONSENT_NO });
    expect(preview.counts).toEqual({ READY: 0, DECLINED: 1, ALREADY_IMPORTED: 0, BLOCKED: 4 });
  });

  it("imports placeholder answers as submitted but flags them for QC", async () => {
    const parsed = await workbook([{ at: wib(10), answers: answersFor("P03", "Perlu dibahas dalam FGD") }]);
    const { rows } = buildPreview(parsed, snap, none);
    expect(rows[0].status).toBe("READY");
    expect(rows[0].qc.filter((q) => q.code === "QUALITATIVE_REVIEW_REQUIRED")).toHaveLength(86);
    expect(rows[0].answers["D1-A01-C02:comment"]).toBe("Tidak ada catatan");
  });

  it("holds rows whose code already answered in the app and skips rows already imported", async () => {
    const parsed = await workbook([
      { at: wib(10), answers: answersFor("P01") },
      { at: wib(11), answers: answersFor("P04") },
    ]);
    const first = buildPreview(parsed, snap, none).rows;
    const existing: ExistingResponses = {
      byCode: new Map([
        ["P01", { completed: false, sourceKey: null }],
        ["P04", { completed: true, sourceKey: first[1].sourceKey }],
      ]),
      importedKeys: new Set([first[1].sourceKey]),
    };
    const { rows } = buildPreview(parsed, snap, existing);
    expect(rows.map((r) => [r.status, r.reason])).toEqual([
      ["BLOCKED", "EXISTS_IN_APP_DRAFT"],
      ["ALREADY_IMPORTED", undefined],
    ]);
  });

  it("refuses a file built from another snapshot or in TEST mode", async () => {
    const parsed = await workbook([{ at: wib(10), answers: answersFor("P01") }], [["Mode", "TEST"], ["Data SHA-256", "0".repeat(64)]]);
    const { preview, rows } = buildPreview(parsed, snap, none);
    expect(preview.fileIssues).toHaveLength(2);
    expect(rows).toEqual([]);
  });

  it("parses dd/mm/yyyy strings as WIB", () => {
    expect(parseTimestamp("25/09/2026 10:15:30")?.toISOString()).toBe("2026-09-25T03:15:30.000Z");
    expect(parseTimestamp("bukan tanggal")).toBeNull();
  });
});
