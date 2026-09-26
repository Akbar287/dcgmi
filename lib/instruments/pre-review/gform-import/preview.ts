import { CONSENT_KEY, CONSENT_NO, CONSENT_YES, EXPERT_KEY, validateSubmission, type AnswerIssueCode } from "../answers";
import type { Answers, PreReviewSnapshot } from "../types";
import { parseTimestamp, type ParsedWorkbook } from "./parse-workbook";

export type RowStatus = "READY" | "DECLINED" | "ALREADY_IMPORTED" | "BLOCKED";

export type BlockReason =
  | "BAD_TIMESTAMP"
  | "INVALID_CONSENT"
  | "INVALID_EXPERT"
  | "TEST_CODE"
  | "DUPLICATE_IN_FILE"
  | "EXISTS_IN_APP_DRAFT"
  | "EXISTS_IN_APP_SUBMITTED";

/** QC labels follow normalize_() so preview, database, and export speak the same language. */
export type QcCode = "INVALID_OR_MISSING_FIELD" | "MISSING_QUALITATIVE" | "QUALITATIVE_REVIEW_REQUIRED" | "TOO_LONG";

export interface QcFlag {
  code: QcCode;
  key: string;
  canonicalId?: string;
}

export interface PreviewRow {
  rowNumber: number;
  timestamp: string | null;
  code: string;
  consent: string;
  status: RowStatus;
  reason?: BlockReason;
  answered: number;
  qc: QcFlag[];
  /** Stable identity of the source row, used to recognise re-uploads. */
  sourceKey: string;
}

export interface ImportPreview {
  sheetName: string | null;
  fileIssues: string[];
  fileWarnings: string[];
  matchedColumns: number;
  totalQuestions: number;
  missingTitles: string[];
  extraHeaders: string[];
  rows: PreviewRow[];
  counts: Record<RowStatus, number>;
}

export interface ExistingResponses {
  /** Responses that carry a code, by code. */
  byCode: Map<string, { completed: boolean; sourceKey: string | null }>;
  /** sourceKeys of rows already imported (including declined consents). */
  importedKeys: Set<string>;
}

export interface RowWithAnswers extends PreviewRow {
  answers: Answers;
  submittedAt: Date | null;
}

const TEST_CODES = new Set(["T01", "T02"]);

function qcOf(code: AnswerIssueCode): QcCode | null {
  if (code === "INVALID_CHOICE") return "INVALID_OR_MISSING_FIELD";
  if (code === "QUALITATIVE_REQUIRED") return "QUALITATIVE_REVIEW_REQUIRED";
  if (code === "TOO_LONG") return "TOO_LONG";
  return null;
}

function qcFlags(snapshot: PreReviewSnapshot, answers: Answers, code: string): QcFlag[] {
  const byKey = new Map(snapshot.plan.map((p) => [p.key, p]));
  const flags: QcFlag[] = [];
  for (const issue of validateSubmission(snapshot.plan, answers, snapshot.data.options, code)) {
    if (issue.code === "EXPERT_MISMATCH" || issue.code === "UNKNOWN_FIELD") continue;
    const field = byKey.get(issue.key)?.field;
    const mapped =
      issue.code === "REQUIRED"
        ? field === "comment" || field === "revision"
          ? "MISSING_QUALITATIVE"
          : "INVALID_OR_MISSING_FIELD"
        : qcOf(issue.code);
    if (mapped) flags.push({ code: mapped, key: issue.key, canonicalId: issue.canonicalId });
  }
  return flags;
}

/**
 * Builds the preview from a parsed workbook. Pure: the caller supplies what
 * already exists in the database. Nothing is repaired or chosen: duplicates
 * and conflicts are held, answers are kept exactly as submitted, and QC only
 * flags (researcher decisions 2026-09-26).
 */
export function buildPreview(parsed: ParsedWorkbook, snapshot: PreReviewSnapshot, existing: ExistingResponses): { preview: ImportPreview; rows: RowWithAnswers[] } {
  const fileIssues: string[] = [];
  const fileWarnings: string[] = [];
  const questions = snapshot.plan.filter((p) => p.type !== "PAGE");
  const titleToKey = new Map(questions.map((q) => [q.title, q.key]));

  if (!parsed.responseSheet) fileIssues.push("Sheet respons Google Form (kolom pertama Timestamp/Stempel waktu) tidak ditemukan.");

  if (parsed.buildInfo) {
    const info = parsed.buildInfo;
    if (info["Data SHA-256"] && info["Data SHA-256"] !== snapshot.dataSha256) {
      fileIssues.push(`Build_Info: Data SHA-256 ${info["Data SHA-256"].slice(0, 12)}… berbeda dari snapshot form ini (${snapshot.dataSha256.slice(0, 12)}…).`);
    }
    if (info.Mode && info.Mode !== snapshot.mode) fileIssues.push(`Build_Info: mode ${info.Mode}, bukan ${snapshot.mode}. Respons TEST tidak diimpor sebagai data pakar.`);
    if (info["Build signature"] && info["Build signature"] !== snapshot.signature) {
      fileWarnings.push("Build_Info: signature build berbeda dari form di aplikasi; judul kolom tetap dicocokkan satu per satu.");
    }
  } else {
    fileWarnings.push("Sheet Build_Info tidak ada; kecocokan versi hanya diperiksa lewat judul kolom.");
  }

  const columnKey = parsed.headers.map((h) => titleToKey.get(h) ?? null);
  const matched = new Set(columnKey.filter((k): k is string => k !== null));
  const missingTitles = questions.filter((q) => !matched.has(q.key)).map((q) => q.title);
  const extraHeaders = parsed.headers.slice(1).filter((h, i) => h && columnKey[i + 1] === null);
  if (parsed.responseSheet && (!matched.has(CONSENT_KEY) || !matched.has(EXPERT_KEY))) {
    fileIssues.push("Kolom persetujuan dan/atau kode pakar tidak ditemukan; file tidak dapat dipetakan.");
  }
  // "Kode pakar" is on the page after consent, so its column is absent only when nobody consented; fine either way.
  if (missingTitles.length > 0) fileWarnings.push(`${missingTitles.length} pertanyaan tidak ditemukan sebagai kolom; jawabannya dianggap kosong.`);
  if (extraHeaders.length > 0) fileWarnings.push(`${extraHeaders.length} kolom tidak dikenal diabaikan.`);

  const rows: RowWithAnswers[] = [];
  if (fileIssues.length === 0) {
    for (const r of parsed.rows) {
      const answers: Answers = {};
      columnKey.forEach((key, i) => {
        if (key) answers[key] = r.cells[i] ?? "";
      });
      const submittedAt = parseTimestamp(r.timestamp);
      const consent = (answers[CONSENT_KEY] ?? "").trim();
      const code = (answers[EXPERT_KEY] ?? "").trim();
      const sourceKey = `${submittedAt?.toISOString() ?? `row${r.rowNumber}`}|${consent === CONSENT_NO ? "-" : code}`;
      const base = {
        rowNumber: r.rowNumber,
        timestamp: submittedAt?.toISOString() ?? null,
        code,
        consent,
        answered: Object.values(answers).filter((v) => v.trim() !== "").length,
        sourceKey,
        submittedAt,
      };
      let row: RowWithAnswers;
      if (!submittedAt) row = { ...base, status: "BLOCKED", reason: "BAD_TIMESTAMP", qc: [], answers };
      else if (consent === CONSENT_NO) {
        // Only the choice and the time are kept, as the consent text promises.
        row = { ...base, code: "", status: existing.importedKeys.has(sourceKey) ? "ALREADY_IMPORTED" : "DECLINED", qc: [], answers: { [CONSENT_KEY]: CONSENT_NO } };
      } else if (consent !== CONSENT_YES) row = { ...base, status: "BLOCKED", reason: "INVALID_CONSENT", qc: [], answers };
      else if (TEST_CODES.has(code)) row = { ...base, status: "BLOCKED", reason: "TEST_CODE", qc: [], answers };
      else if (!snapshot.data.experts.includes(code)) row = { ...base, status: "BLOCKED", reason: "INVALID_EXPERT", qc: [], answers };
      else row = { ...base, status: "READY", qc: qcFlags(snapshot, answers, code), answers: { ...answers, [CONSENT_KEY]: consent, [EXPERT_KEY]: code } };
      rows.push(row);
    }

    // Conflicts: duplicates in the file hold every copy; app responses hold the row.
    const perCode = new Map<string, number>();
    for (const r of rows) if (r.status === "READY") perCode.set(r.code, (perCode.get(r.code) ?? 0) + 1);
    for (const r of rows) {
      if (r.status !== "READY") continue;
      const prior = existing.byCode.get(r.code);
      if (prior?.sourceKey === r.sourceKey || existing.importedKeys.has(r.sourceKey)) r.status = "ALREADY_IMPORTED";
      else if ((perCode.get(r.code) ?? 0) > 1) Object.assign(r, { status: "BLOCKED", reason: "DUPLICATE_IN_FILE" });
      else if (prior) Object.assign(r, { status: "BLOCKED", reason: prior.completed ? "EXISTS_IN_APP_SUBMITTED" : "EXISTS_IN_APP_DRAFT" });
    }
  }

  const counts: Record<RowStatus, number> = { READY: 0, DECLINED: 0, ALREADY_IMPORTED: 0, BLOCKED: 0 };
  rows.forEach((r) => counts[r.status]++);
  return {
    preview: {
      sheetName: parsed.responseSheet,
      fileIssues,
      fileWarnings,
      matchedColumns: matched.size,
      totalQuestions: questions.length,
      missingTitles,
      extraHeaders,
      // Answers stay on the server; the browser only needs the summary per row.
      rows: rows.map((r) => ({
        rowNumber: r.rowNumber,
        timestamp: r.timestamp,
        code: r.code,
        consent: r.consent,
        status: r.status,
        reason: r.reason,
        answered: r.answered,
        qc: r.qc,
        sourceKey: r.sourceKey,
      })),
      counts,
    },
    rows,
  };
}
