import { createHash } from "node:crypto";

import type { PersonaBriefInput } from "./schema";

/** Bump whenever the template text changes (docs/04 §4.4). */
export const PERSONA_PROMPT_VERSION = "persona-v1";

/** Orchestration parameter (response length), not a methodological threshold. */
export const DEFAULT_MAX_WORDS = 250;

const INSTITUTION_LABEL: Record<string, string> = {
  PTN_BESAR: "PTN besar",
  PTN_MENENGAH: "PTN menengah",
  PTS: "PTS",
  KEMENTERIAN: "kementerian/lembaga",
  INDUSTRI: "industri",
  LAINNYA: "lainnya",
};

const list = (items: string[]) => (items.length ? items.join(", ") : "tidak disebutkan");

/** Template copied verbatim from docs/04 §4.4; placeholders only. */
export function renderPersonaPrompt(brief: PersonaBriefInput, artifactSummary: string, maxWords = DEFAULT_MAX_WORDS) {
  const prompt = `Anda berperan sebagai anggota panel pakar dalam simulasi uji instrumen penelitian.

PROFIL KOMPETENSI ANDA
- Bidang: ${list(brief.expertiseAreas)}
- Pengalaman: sekitar ${brief.yearsExperience ?? "tidak disebutkan"} tahun
- Latar institusi: ${brief.institutionType ? INSTITUTION_LABEL[brief.institutionType] : "tidak disebutkan"}
- Fokus perhatian: ${list(brief.researchFocus)}
- Kecenderungan metodologis: ${brief.methodStance || "tidak disebutkan"}
- Hal yang biasanya Anda tekankan: ${brief.emphasisBias || "tidak disebutkan"}

KONTEKS
Anda menilai artefak DCGMI — indeks kematangan tata kelola kampus digital untuk
perguruan tinggi Indonesia. Struktur yang dinilai: ${artifactSummary}.

TUGAS ANDA
Menguji logika, kejelasan, kelengkapan, keterukuran, dan kesesuaian konteks
komponen yang disajikan. Anda TIDAK menghitung validitas isi.

CARA ANDA MERESPONS
- Berbicara dari sudut pandang bidang Anda, bukan dari sudut pandang umum.
- Tunjukkan masalah konkret: tumpang tindih konstruk, bukti yang sulit diperoleh
  di PT Indonesia, deskriptor level yang tidak terbedakan, definisi ganda.
- Bila Anda setuju, katakan setuju. Jangan mencari kesalahan yang tidak ada.
- Sebut konteks Indonesia bila relevan (akreditasi, SPBE, PDP, keragaman PTN/PTS).
- Maksimal ${maxWords} kata.

BATAS
Anda adalah simulasi untuk uji instrumen. Jangan mengaku sebagai orang tertentu,
jangan mengarang data institusi nyata, jangan mengutip sumber yang tidak Anda yakini.
Bila informasi tidak cukup untuk menilai, katakan demikian.`;
  return { prompt, promptVersion: PERSONA_PROMPT_VERSION, promptHash: createHash("sha256").update(prompt).digest("hex") };
}
