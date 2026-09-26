import { toPages } from "./pages";
import type { Answers, PlanItem, SourceData } from "./types";

export const CONSENT_KEY = "consent";
export const EXPERT_KEY = "expert";
export const CONSENT_YES = "Bersedia";
export const CONSENT_NO = "Tidak bersedia";
export const PARAGRAPH_MAX = 10_000;

/**
 * Placeholder answers rejected for items not kept as-is. Copied verbatim from
 * normalize_() in R1–V2.1.2B so submit-time checks and export QC agree.
 */
export const PLACEHOLDER_ANSWER = /^(?:[-–—.]|tidak ada(?: catatan| usulan)?|n\/?a|nihil)$/i;

export type AnswerIssueCode =
  | "UNKNOWN_FIELD"
  | "REQUIRED"
  | "INVALID_CHOICE"
  | "TOO_LONG"
  | "QUALITATIVE_REQUIRED"
  | "EXPERT_MISMATCH";

export interface AnswerIssue {
  key: string;
  code: AnswerIssueCode;
  /** Indicator the issue belongs to, for messages that point at it. */
  canonicalId?: string;
}

function checkShape(item: PlanItem, value: string | undefined, issues: AnswerIssue[]) {
  const ref = { key: item.key, canonicalId: item.canonicalId };
  if (value === undefined || value.trim() === "") {
    if (item.required) issues.push({ ...ref, code: "REQUIRED" });
    return;
  }
  if (item.type === "MC" && !item.choices.includes(value)) issues.push({ ...ref, code: "INVALID_CHOICE" });
  if (item.type === "PARA" && value.length > PARAGRAPH_MAX) issues.push({ ...ref, code: "TOO_LONG" });
}

/** Rule stated to respondents: reasons and proposals are required unless kept as-is. */
function checkQualitative(fields: PlanItem[], answers: Answers, options: SourceData["options"], issues: AnswerIssue[]) {
  const keep = options.decision[0];
  for (const f of fields) {
    if (f.field !== "comment" && f.field !== "revision") continue;
    const decision = answers[`${f.canonicalId}:decision`];
    if (!decision || decision === keep) continue;
    const text = (answers[f.key] ?? "").trim();
    if (text !== "" && PLACEHOLDER_ANSWER.test(text)) {
      issues.push({ key: f.key, canonicalId: f.canonicalId, code: "QUALITATIVE_REQUIRED" });
    }
  }
}

/** Draft saves: only reject values that could never be valid; nothing is required yet. */
export function validateDraft(plan: PlanItem[], answers: Answers): AnswerIssue[] {
  const byKey = new Map(plan.filter((p) => p.type !== "PAGE").map((p) => [p.key, p]));
  const issues: AnswerIssue[] = [];
  for (const [key, value] of Object.entries(answers)) {
    const item = byKey.get(key);
    if (!item) {
      issues.push({ key, code: "UNKNOWN_FIELD" });
      continue;
    }
    if (value === "") continue;
    checkShape({ ...item, required: false }, value, issues);
  }
  return issues;
}

/** Validates one page (index into toPages) before moving on. */
export function validatePage(plan: PlanItem[], pageIndex: number, answers: Answers, options: SourceData["options"]): AnswerIssue[] {
  const page = toPages(plan)[pageIndex];
  if (!page) return [];
  const issues: AnswerIssue[] = [];
  for (const f of page.fields) checkShape(f, answers[f.key], issues);
  checkQualitative(page.fields, answers, options, issues);
  return issues;
}

/** Full submission with consent given. `expertCode` is the code bound to the account. */
export function validateSubmission(
  plan: PlanItem[],
  answers: Answers,
  options: SourceData["options"],
  expertCode: string,
): AnswerIssue[] {
  const issues = validateDraft(plan, answers).filter((i) => i.code === "UNKNOWN_FIELD");
  const pages = toPages(plan);
  pages.forEach((_, i) => issues.push(...validatePage(plan, i, answers, options)));
  if (answers[CONSENT_KEY] !== CONSENT_YES) issues.push({ key: CONSENT_KEY, code: "INVALID_CHOICE" });
  if (answers[EXPERT_KEY] !== expertCode) issues.push({ key: EXPERT_KEY, code: "EXPERT_MISMATCH" });
  return issues;
}
