import { answerKeys, CHOICE_TYPES, SAATY, TEXT_MAX, type Answers, type FieldDef, type FormDef, type SectionDef } from "./types";

export type AnswerIssueCode = "REQUIRED" | "INVALID_CHOICE" | "TOO_LONG" | "INVALID_SCALE" | "INVALID_DATE" | "INVALID_PAIR" | "UNKNOWN_FIELD";

export interface AnswerIssue {
  key: string;
  code: AnswerIssueCode;
}

const isoDate = /^\d{4}-\d{2}-\d{2}$/;

/** `A:5`, `B:3`, or `EQ` — preferred element and Saaty intensity (docs/04 §8). */
export function parsePair(v: string): { preferred: "A" | "B" | "EQUAL"; intensity: number } | null {
  if (v === "EQ") return { preferred: "EQUAL", intensity: 1 };
  const m = /^(A|B):([2-9])$/.exec(v);
  return m ? { preferred: m[1] as "A" | "B", intensity: Number(m[2]) } : null;
}

export function parseMulti(v: string): string[] | null {
  try {
    const a = JSON.parse(v);
    return Array.isArray(a) && a.every((x) => typeof x === "string") ? a : null;
  } catch {
    return null;
  }
}

/** Shape and required checks for one field; `strict` adds REQUIRED (not enforced on autosave). */
export function checkField(f: FieldDef, answers: Answers, strict: boolean): AnswerIssue[] {
  const out: AnswerIssue[] = [];
  const v = answers[f.key];
  const empty = (x: string | undefined) => x === undefined || x.trim() === "";
  switch (f.type) {
    case "INFO":
      return out;
    case "SHORT_TEXT":
    case "PARAGRAPH":
      if (!empty(v) && v!.length > TEXT_MAX[f.type]) out.push({ key: f.key, code: "TOO_LONG" });
      break;
    case "SINGLE_CHOICE":
    case "DROPDOWN":
      if (!empty(v) && !f.options.includes(v!)) out.push({ key: f.key, code: "INVALID_CHOICE" });
      break;
    case "MULTI_CHOICE": {
      if (!empty(v)) {
        const a = parseMulti(v!);
        if (!a || a.some((x) => !f.options.includes(x))) out.push({ key: f.key, code: "INVALID_CHOICE" });
        else if (strict && f.required && a.length === 0) out.push({ key: f.key, code: "REQUIRED" });
      }
      break;
    }
    case "LINEAR_SCALE": {
      const min = f.config?.min ?? 1;
      const max = f.config?.max ?? 5;
      if (!empty(v) && (!/^-?\d+$/.test(v!) || Number(v) < min || Number(v) > max)) out.push({ key: f.key, code: "INVALID_SCALE" });
      break;
    }
    case "RELEVANCE_4":
      if (!empty(v) && !["1", "2", "3", "4"].includes(v!)) out.push({ key: f.key, code: "INVALID_SCALE" });
      if (f.config?.clarity) {
        const c = answers[`${f.key}:clarity`];
        if (!empty(c) && c !== "1" && c !== "0") out.push({ key: `${f.key}:clarity`, code: "INVALID_CHOICE" });
        const note = answers[`${f.key}:clarityNote`];
        if (!empty(note) && note!.length > 300) out.push({ key: `${f.key}:clarityNote`, code: "TOO_LONG" });
      }
      break;
    case "DATE":
      if (!empty(v) && (!isoDate.test(v!) || Number.isNaN(Date.parse(v!)))) out.push({ key: f.key, code: "INVALID_DATE" });
      break;
    case "PAIRWISE":
      for (const k of answerKeys(f)) {
        const pv = answers[k];
        if (!empty(pv) && !parsePair(pv!)) out.push({ key: k, code: "INVALID_PAIR" });
        else if (strict && f.required && empty(pv)) out.push({ key: k, code: "REQUIRED" });
      }
      return out;
  }
  if (strict && f.required && (f.type === "MULTI_CHOICE" ? empty(v) || (parseMulti(v!) ?? []).length === 0 : empty(v))) out.push({ key: f.key, code: "REQUIRED" });
  return out;
}

export function validateSection(section: SectionDef, answers: Answers): AnswerIssue[] {
  return section.fields.flatMap((f) => checkField(f, answers, true));
}

/** Draft save: unknown keys and malformed values are refused; missing answers are fine. */
export function validateDraft(form: FormDef, answers: Answers): AnswerIssue[] {
  const fields = form.sections.flatMap((s) => s.fields);
  const known = new Set(fields.flatMap(answerKeys));
  const unknown = Object.keys(answers).filter((k) => !known.has(k)).map((key) => ({ key, code: "UNKNOWN_FIELD" as const }));
  return [...unknown, ...fields.flatMap((f) => checkField(f, answers, false))];
}

export { CHOICE_TYPES, SAATY };
