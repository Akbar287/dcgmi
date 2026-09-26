import { METHOD } from "@/lib/method/constants";

export interface RubricLevelInput {
  level: number;
  label: string;
  descriptor: string;
}

export interface EvidenceInput {
  kind: string;
  minimumFor: number | null;
  mandatory: boolean;
}

export type RubricIssueCode = "LEVEL_SET" | "EMPTY_DESCRIPTOR" | "TWIN_DESCRIPTOR" | "LEVEL_WITHOUT_EVIDENCE" | "EVIDENCE_LEVEL_OUT_OF_RANGE";

export interface RubricIssue {
  code: RubricIssueCode;
  level?: number;
  blocking: boolean;
}

const normalize = (s: string) => s.trim().toLowerCase().replace(/\s+/g, " ");

/**
 * docs/06 §4 rubric editor checks: ordered and distinct levels (blocking),
 * and levels that no mandatory evidence supports (a warning the researcher
 * reviews; "evidence-anchored" is a judgement, not a formula).
 */
export function checkRubric(levels: RubricLevelInput[], evidence: EvidenceInput[]): RubricIssue[] {
  const issues: RubricIssue[] = [];
  const expected = Array.from({ length: METHOD.LEVEL_MAX - METHOD.LEVEL_MIN + 1 }, (_, i) => METHOD.LEVEL_MIN + i);
  const present = [...levels.map((l) => l.level)].sort((a, b) => a - b);
  if (present.join(",") !== expected.join(",")) issues.push({ code: "LEVEL_SET", blocking: true });

  const seen = new Map<string, number>();
  for (const l of levels) {
    if (!l.descriptor.trim() || !l.label.trim()) issues.push({ code: "EMPTY_DESCRIPTOR", level: l.level, blocking: true });
    const key = normalize(l.descriptor);
    if (key && seen.has(key)) issues.push({ code: "TWIN_DESCRIPTOR", level: l.level, blocking: true });
    else seen.set(key, l.level);
  }

  for (const e of evidence) {
    if (e.minimumFor !== null && (e.minimumFor < METHOD.LEVEL_MIN || e.minimumFor > METHOD.LEVEL_MAX)) {
      issues.push({ code: "EVIDENCE_LEVEL_OUT_OF_RANGE", level: e.minimumFor, blocking: true });
    }
  }
  // Above the floor level, each level should be backed by mandatory evidence at or below it.
  for (const lvl of expected.slice(1)) {
    if (!evidence.some((e) => e.mandatory && e.minimumFor !== null && e.minimumFor <= lvl)) {
      issues.push({ code: "LEVEL_WITHOUT_EVIDENCE", level: lvl, blocking: false });
    }
  }
  return issues;
}
