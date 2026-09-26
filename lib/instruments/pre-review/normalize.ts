import { CONSENT_YES, PLACEHOLDER_ANSWER } from "./answers";
import type { Answers, FieldKey, SourceData } from "./types";

export interface ResponseRecord {
  id: string;
  timestamp: string;
  values: Answers;
}

export type Row = (string | number)[];

const FIELD_KEYS: FieldKey[] = ["decision", "evidence", "clarity", "overlap", "comment", "revision"];

/**
 * Port of normalize_() from R1–V2.1.2B. Kept line-for-line in behaviour (a
 * parity test runs the original) so exports match what the team already
 * reviewed. It groups by expert code, holds duplicates, and never picks one.
 */
export function normalizeResponses(records: ResponseRecord[], data: SourceData) {
  const codes = data.experts;
  const grouped: Record<string, ResponseRecord[]> = {};
  const qc: Row[] = [["Response ID", "Timestamp", "Expert ID", "Issue", "Detail"]];
  codes.forEach((c) => (grouped[c] = []));

  for (const r of records) {
    const v = r.values;
    const code = v.expert;
    if (v.consent !== CONSENT_YES) {
      qc.push([r.id, r.timestamp, "", "EXCLUDED_NO_CONSENT", "Tidak dipindahkan ke data indikator."]);
      continue;
    }
    if (!codes.includes(code)) {
      qc.push([r.id, r.timestamp, code, "INVALID_EXPERT", "Kode tidak sesuai mode."]);
      continue;
    }
    grouped[code].push(r);
  }

  const rows: Row[] = [data.dataHeaders.slice()];
  const supplement: Row[] = [
    ["Response ID", "Timestamp", "Expert ID", "Canonical ID", "Overlap / Placement", "Overall Comment", "FGD Availability"],
  ];
  let number = 0;

  for (const code of codes) {
    const candidates = grouped[code];
    const record = candidates.length === 1 ? candidates[0] : null;
    if (candidates.length > 1) {
      for (const r of candidates) {
        qc.push([r.id, r.timestamp, code, "DUPLICATE_EXPERT", "Semua respons kode ini ditahan; tim harus menyelesaikan duplikasi dari sumber."]);
      }
    }
    if (!candidates.length) qc.push(["", "", code, "MISSING_RESPONSE", "Belum ada respons setuju."]);

    for (const x of data.items) {
      number++;
      const row: Row = ["R" + String(number).padStart(3, "0"), code, x.id, x.domainCode, x.indicator, "", "", "", "", ""];
      if (record) {
        const v = record.values;
        const vals = Object.fromEntries(FIELD_KEYS.map((k) => [k, v[`${x.id}:${k}`] || ""])) as Record<FieldKey, string>;
        let invalid = false;
        for (const k of ["decision", "evidence", "clarity"] as const) {
          if (!data.options[k].includes(vals[k])) {
            invalid = true;
            qc.push([record.id, record.timestamp, code, "INVALID_OR_MISSING_FIELD", `${x.id}:${k}`]);
          }
        }
        if (vals.overlap && !data.options.overlap.includes(vals.overlap)) {
          invalid = true;
          qc.push([record.id, record.timestamp, code, "INVALID_OVERLAP", x.id]);
        }
        if (!String(vals.comment).trim() || !String(vals.revision).trim()) {
          invalid = true;
          qc.push([record.id, record.timestamp, code, "MISSING_QUALITATIVE", x.id]);
        }
        if (vals.decision !== data.options.decision[0]) {
          for (const t of [vals.comment, vals.revision]) {
            if (PLACEHOLDER_ANSWER.test(String(t).trim())) {
              invalid = true;
              qc.push([record.id, record.timestamp, code, "QUALITATIVE_REVIEW_REQUIRED", `${x.id}: jawaban placeholder untuk item non-accept.`]);
            }
          }
        }
        if (!invalid) row.splice(5, 5, vals.decision, vals.evidence, vals.clarity, vals.comment, vals.revision);
        supplement.push([record.id, record.timestamp, code, x.id, vals.overlap, v.overallComment || "", v.fgdAvailability || ""]);
      }
      rows.push(row);
    }
  }
  return { data: rows, supplement, qc };
}

/** Port of safeCell_(): keeps respondent text from becoming a spreadsheet formula. */
export function safeCell(x: string | number): string | number {
  return typeof x === "string" && /^[\s]*[=+@-]/.test(x) ? "'" + x : x;
}
