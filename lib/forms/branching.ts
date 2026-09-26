import { BRANCHING_TYPES, type Answers, type FormDef, type SectionDef } from "./types";

export type Target = number | "SUBMIT";

/** Where to go after a section: a branching answer wins over the section default. */
export function nextTarget(form: FormDef, section: SectionDef, answers: Answers): Target {
  for (const f of section.fields) {
    if (!BRANCHING_TYPES.includes(f.type) || !f.branching) continue;
    const a = answers[f.key];
    if (a !== undefined && a in f.branching) return f.branching[a];
  }
  if (section.next === "SUBMIT") return "SUBMIT";
  if (section.next === "NEXT") {
    const after = form.sections.filter((s) => s.order > section.order).sort((x, y) => x.order - y.order)[0];
    return after ? after.order : "SUBMIT";
  }
  return section.next;
}

/** Sections the respondent actually visits for these answers (skipped sections are not validated). */
export function visitedPath(form: FormDef, answers: Answers): number[] {
  const path: number[] = [];
  let current = [...form.sections].sort((a, b) => a.order - b.order)[0];
  const seen = new Set<number>();
  while (current && !seen.has(current.order)) {
    path.push(current.order);
    seen.add(current.order);
    const t = nextTarget(form, current, answers);
    if (t === "SUBMIT") break;
    current = form.sections.find((s) => s.order === t)!;
  }
  return path;
}

export type BranchIssueCode = "CYCLE" | "BAD_TARGET" | "UNREACHABLE" | "EMPTY_SECTION" | "NO_OPTIONS" | "BRANCH_ON_UNKNOWN_OPTION";

export interface BranchIssue {
  code: BranchIssueCode;
  section: number;
  detail: string;
}

/**
 * SPECIFICATION §4.2 "percabangan dengan pemeriksa siklus": every jump must
 * target an existing section, no path may loop, and every section must be
 * reachable from the first. Issues block activation.
 */
export function checkStructure(form: FormDef): BranchIssue[] {
  const issues: BranchIssue[] = [];
  const orders = new Set(form.sections.map((s) => s.order));
  const sorted = [...form.sections].sort((a, b) => a.order - b.order);
  const edges = new Map<number, Set<number>>();
  for (const s of sorted) {
    const out = new Set<number>();
    const add = (t: Target, detail: string) => {
      if (t === "SUBMIT") return;
      if (!orders.has(t)) issues.push({ code: "BAD_TARGET", section: s.order, detail });
      else out.add(t);
    };
    if (s.fields.length === 0) issues.push({ code: "EMPTY_SECTION", section: s.order, detail: s.title });
    if (s.next === "NEXT") {
      const after = sorted.find((x) => x.order > s.order);
      if (after) out.add(after.order);
    } else add(s.next, `default → ${s.next}`);
    for (const f of s.fields) {
      if (["SINGLE_CHOICE", "MULTI_CHOICE", "DROPDOWN"].includes(f.type) && f.options.length < 2) issues.push({ code: "NO_OPTIONS", section: s.order, detail: f.key });
      if (!f.branching) continue;
      for (const [opt, t] of Object.entries(f.branching)) {
        if (!f.options.includes(opt)) issues.push({ code: "BRANCH_ON_UNKNOWN_OPTION", section: s.order, detail: `${f.key}: ${opt}` });
        add(t, `${f.key}: ${opt} → ${t}`);
      }
    }
    edges.set(s.order, out);
  }
  // Cycle detection (DFS with colours).
  const colour = new Map<number, 0 | 1 | 2>();
  const visit = (n: number, trail: number[]) => {
    colour.set(n, 1);
    for (const m of edges.get(n) ?? []) {
      if (colour.get(m) === 1) issues.push({ code: "CYCLE", section: n, detail: [...trail, n, m].join(" → ") });
      else if (!colour.get(m)) visit(m, [...trail, n]);
    }
    colour.set(n, 2);
  };
  if (sorted.length) visit(sorted[0].order, []);
  for (const s of sorted) if (!colour.get(s.order)) issues.push({ code: "UNREACHABLE", section: s.order, detail: s.title });
  return issues;
}
