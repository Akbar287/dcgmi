import { SIMULATION_BOUNDARY, type PromptSpec } from "./fgd";

// docs/09 §2 `delphi.seat.rate`. Thresholds and decision rules (Tabel 3.6)
// never appear in the prompt: the seat rates, lib/method decides.

export interface RoundFeedback {
  own: number | null;
  median: number;
  iqr: number;
  /** Counts for scores 1..4. */
  distribution: number[];
}

export interface RateContext {
  round: number;
  itemPackage: string;
  /** FULL seats only: the FGD outcome for this item. Never set for ARTIFACT_ONLY seats (docs/04 §7). */
  fgdSummary: string | null;
  /** R2/R3: the anonymous group feedback of the previous round. */
  feedback: RoundFeedback | null;
  revisedSincePrevious: boolean;
}

export const DELPHI_SEAT_RATE: PromptSpec<RateContext> = {
  id: "delphi.seat.rate",
  version: "1.0.0",
  render: (c) => {
    const parts = [`Delphi ronde ${c.round}. Nilai satu butir instrumen DCGMI.`, "", "BUTIR", c.itemPackage];
    if (c.fgdSummary) parts.push("", "CATATAN DISKUSI PANEL SEBELUMNYA", c.fgdSummary);
    if (c.feedback) {
      const d = c.feedback.distribution;
      parts.push(
        "",
        "UMPAN BALIK ANONIM RONDE SEBELUMNYA",
        `Skor Anda: ${c.feedback.own ?? "tidak ada"}`,
        `Median kelompok: ${c.feedback.median}; IQR: ${c.feedback.iqr}`,
        `Sebaran skor kelompok — 1: ${d[0]}, 2: ${d[1]}, 3: ${d[2]}, 4: ${d[3]}`,
        c.revisedSincePrevious ? "Butir ini telah direvisi setelah ronde sebelumnya; nilai versi di atas." : "Butir ini tidak berubah sejak ronde sebelumnya.",
        "Anda boleh mempertahankan atau mengubah skor; jangan menyesuaikan diri dengan kelompok tanpa alasan substantif.",
      );
    }
    parts.push(
      "",
      "Beri skor RELEVANSI butir terhadap konstruk kematangan tata kelola kampus digital:",
      "1 = tidak relevan, 2 = kurang relevan, 3 = relevan, 4 = sangat relevan.",
      "Beri alasan singkat (10–400 karakter).",
      "Nilai KEJELASAN secara terpisah: clarityFlag = true bila redaksi, definisi, rubrik, atau bukti membingungkan, dengan catatan singkat; bila jelas, clarityFlag = false dan clarityNote = null.",
      "Jangan biarkan mutu redaksi memengaruhi skor relevansi.",
      "",
      SIMULATION_BOUNDARY,
    );
    return parts.join("\n");
  },
};
