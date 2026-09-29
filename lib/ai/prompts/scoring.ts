import { SIMULATION_BOUNDARY, type PromptSpec } from "./fgd";

// docs/09 §2 `scoring.assessor.evidence`. Weights, formulas, and the
// evidence-cap rule's arithmetic stay in lib/method; the assessor reads the
// fictional profile against one indicator's rubric and evidence list.

export const ASSESSOR_SYSTEM = `Anda asesor simulasi untuk uji keterpakaian rubrik DCGMI. Anda menilai satu indikator berdasarkan profil institusi FIKTIF yang diberikan, tidak berdasarkan pengetahuan tentang institusi nyata mana pun.

${SIMULATION_BOUNDARY}`;

export interface AssessContext {
  profileLabel: string;
  profileText: string;
  indicatorPackage: string;
  evidence: { id: string; kind: string; minimumFor: number | null; mandatory: boolean; description: string }[];
}

export const SCORING_ASSESSOR_EVIDENCE: PromptSpec<AssessContext> = {
  id: "scoring.assessor.evidence",
  version: "1.1.0",
  render: (c) => `PROFIL INSTITUSI FIKTIF — ${c.profileLabel}
${c.profileText}

INDIKATOR
${c.indicatorPackage}

PERSYARATAN BUKTI
${c.evidence.map((e) => `${e.id}: [${e.kind}, ${e.mandatory ? "wajib" : "penguat"} sejak level ${e.minimumFor ?? 1}] ${e.description}`).join("\n") || "tidak ada"}

Langkah:
1. missingKind: MISSING_ADMINISTRATIF bila profil menyatakan data/dokumen untuk indikator ini belum diterima atau tidak dapat diakses (level = null); TIDAK_ADA_KAPABILITAS bila institusi memang belum memiliki praktiknya (tetap diberi level, umumnya 1); selain itu NONE.
2. satisfiedEvidence: id persyaratan bukti yang benar-benar didukung profil.
3. evidenceLocator: kutipan VERBATIM dari profil yang menjadi dasar bukti (disalin persis, satu kalimat atau klausa yang utuh); JANGAN dibungkus tanda kutip pembuka/penutup dan jangan diawali kode indikator; null bila tidak ada bukti.
4. level: level tertinggi yang deskriptornya cocok DAN seluruh bukti wajib sampai level itu terpenuhi. Jangan menebak bukti yang tidak disebut profil.
5. rationale: alasan singkat 10–500 karakter.

${SIMULATION_BOUNDARY}`,
};
