import { SIMULATION_BOUNDARY, type PromptSpec } from "./fgd";

// docs/09 §2 `ahp.seat.pairwise` / `ahp.seat.review`. The CR threshold and
// the implied "correct" value are never given: the seat reconsiders its own
// judgement, the system never corrects it (§3.9.2).

export interface AhpElement {
  code: string;
  name: string;
  rationale: string | null;
}

export interface PairContext {
  levelLabel: string;
  elements: AhpElement[];
  a: AhpElement;
  b: AhpElement;
}

const describe = (e: AhpElement) => `${e.code} — ${e.name}${e.rationale ? `: ${e.rationale}` : ""}`;

const SCALE = `Skala Saaty: 1 = sama penting, 3 = sedikit lebih penting, 5 = lebih penting, 7 = sangat lebih penting, 9 = mutlak lebih penting; 2, 4, 6, 8 = nilai antara.`;

export const AHP_SEAT_PAIRWISE: PromptSpec<PairContext> = {
  id: "ahp.seat.pairwise",
  version: "1.0.0",
  render: (c) => `Pembobotan AHP instrumen DCGMI (hierarki content-locked).
Tingkat: ${c.levelLabel}

SELURUH ELEMEN PADA TINGKAT INI
${c.elements.map(describe).join("\n")}

PASANGAN YANG DINILAI
A: ${describe(c.a)}
B: ${describe(c.b)}

Untuk kematangan tata kelola kampus digital di perguruan tinggi Indonesia, mana yang lebih penting, A atau B, dan seberapa besar?
${SCALE}
Jawab preferred = A, B, atau EQUAL; intensity 1–9 (EQUAL selalu 1); dan alasan singkat 10–300 karakter.

${SIMULATION_BOUNDARY}`,
};

export interface ReviewContext extends PairContext {
  previous: { preferred: "A" | "B" | "EQUAL"; intensity: number; reason: string };
  /** The seat's own other judgements imply this ratio A:B. */
  impliedFromOthers: string;
}

export const AHP_SEAT_REVIEW: PromptSpec<ReviewContext> = {
  id: "ahp.seat.review",
  version: "1.0.0",
  render: (c) => `${AHP_SEAT_PAIRWISE.render(c).split("\n\n" + SIMULATION_BOUNDARY)[0]}

PENINJAUAN KONSISTENSI
Penilaian Anda sebelumnya untuk pasangan ini: ${c.previous.preferred === "EQUAL" ? "sama penting" : `${c.previous.preferred} lebih penting, intensitas ${c.previous.intensity}`} — "${c.previous.reason}".
Penilaian Anda pada pasangan lain secara tidak langsung menyiratkan A:B sekitar ${c.impliedFromOthers}.
Tinjau kembali pasangan ini. Anda boleh mempertahankan penilaian bila yakin; jangan mengubah hanya untuk menyesuaikan angka.

${SIMULATION_BOUNDARY}`,
};
