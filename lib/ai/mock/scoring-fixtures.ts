import { hash32 } from "@/lib/fgd/agenda";

import type { AssessContext } from "../prompts/scoring";
import type { AssessorOutput } from "../schemas";

// Deterministic MOCK_AI=1 assessor, steered by the fictional profile itself:
// a line "C05: dokumen belum diterima" → MISSING_ADMINISTRATIF,
// "C07: tidak ada praktik …" → TIDAK_ADA_KAPABILITAS at level 1,
// "C09: … level 4" → level 4. Other indicators get level 2–4 from a hash.

export function mockAssessment(code: string, c: AssessContext, seed: number): AssessorOutput {
  const lines = c.profileText.split("\n").map((l) => l.trim()).filter(Boolean);
  const line = lines.find((l) => l.toUpperCase().startsWith(`${code.toUpperCase()}:`));
  const text = line?.toLowerCase() ?? "";
  if (/belum diterima|tidak dapat diakses/.test(text)) {
    return { missingKind: "MISSING_ADMINISTRATIF", level: null, satisfiedEvidence: [], evidenceLocator: null, rationale: `[MOCK] Data ${code} belum tersedia menurut profil.` };
  }
  if (/tidak ada/.test(text)) {
    return { missingKind: "TIDAK_ADA_KAPABILITAS", level: 1, satisfiedEvidence: [], evidenceLocator: line ?? null, rationale: `[MOCK] Profil menyatakan praktik ${code} belum ada.` };
  }
  const target = Number(/level\s+([1-5])/.exec(text)?.[1] ?? 2 + (hash32(`${seed}|${code}`) % 3));
  const satisfied = c.evidence.filter((e) => e.mandatory && (e.minimumFor ?? 1) <= target).map((e) => e.id);
  return {
    missingKind: "NONE",
    level: target,
    satisfiedEvidence: satisfied,
    evidenceLocator: satisfied.length ? (line ?? lines[0] ?? null) : null,
    rationale: `[MOCK] Bukti sampai level ${target} tersedia di profil untuk ${code}.`,
  };
}
