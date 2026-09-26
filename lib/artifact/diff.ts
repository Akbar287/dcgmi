// Diff between two artifact versions (SPECIFICATION §4.1): added / removed /
// moved / reformulated, plus rubric and evidence changes. Compared by
// indicator code, which is stable across versions (C20b/C42 are never renumbered).

export interface DiffIndicator {
  code: string;
  name: string;
  domainCode: string;
  aspectCode: string;
  deleted: boolean;
  operationalDefinition: string | null;
  assessmentObject: string | null;
  boundaryNote: string | null;
  rubric: { level: number; label: string; descriptor: string }[];
  evidence: { kind: string; minimumFor: number | null; mandatory: boolean; description: string }[];
}

export type DiffKind = "ADDED" | "REMOVED" | "MOVED" | "REFORMULATED" | "RUBRIC_CHANGED" | "EVIDENCE_CHANGED";

export interface DiffEntry {
  code: string;
  name: string;
  kind: DiffKind;
  detail: string;
}

const FIELDS = ["name", "operationalDefinition", "assessmentObject", "boundaryNote"] as const;

const rubricKey = (r: DiffIndicator["rubric"]) =>
  JSON.stringify([...r].sort((a, b) => a.level - b.level).map((l) => [l.level, l.label.trim(), l.descriptor.trim()]));
const evidenceKey = (e: DiffIndicator["evidence"]) =>
  JSON.stringify(e.map((x) => [x.kind, x.minimumFor, x.mandatory, x.description.trim()]).sort());

export function diffVersions(from: DiffIndicator[], to: DiffIndicator[]): DiffEntry[] {
  const out: DiffEntry[] = [];
  const before = new Map(from.filter((i) => !i.deleted).map((i) => [i.code, i]));
  const after = new Map(to.filter((i) => !i.deleted).map((i) => [i.code, i]));

  for (const [code, a] of after) {
    const b = before.get(code);
    if (!b) {
      out.push({ code, name: a.name, kind: "ADDED", detail: `${a.domainCode}/${a.aspectCode}` });
      continue;
    }
    if (b.domainCode !== a.domainCode || b.aspectCode !== a.aspectCode) {
      out.push({ code, name: a.name, kind: "MOVED", detail: `${b.domainCode}/${b.aspectCode} → ${a.domainCode}/${a.aspectCode}` });
    }
    const changed = FIELDS.filter((f) => (b[f] ?? "").trim() !== (a[f] ?? "").trim());
    if (changed.length) out.push({ code, name: a.name, kind: "REFORMULATED", detail: changed.join(", ") });
    if (rubricKey(b.rubric) !== rubricKey(a.rubric)) out.push({ code, name: a.name, kind: "RUBRIC_CHANGED", detail: "" });
    if (evidenceKey(b.evidence) !== evidenceKey(a.evidence)) out.push({ code, name: a.name, kind: "EVIDENCE_CHANGED", detail: `${b.evidence.length} → ${a.evidence.length}` });
  }
  for (const [code, b] of before) {
    if (!after.has(code)) out.push({ code, name: b.name, kind: "REMOVED", detail: `${b.domainCode}/${b.aspectCode}` });
  }
  return out.sort((x, y) => x.code.localeCompare(y.code, "id", { numeric: true }) || x.kind.localeCompare(y.kind));
}
