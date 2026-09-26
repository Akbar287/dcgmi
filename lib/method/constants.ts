/**
 * Konstanta metodologis DCGMI.
 *
 * SUMBER TUNGGAL. Nilai di berkas ini tidak boleh ditulis ulang secara literal
 * di tempat lain. Setiap perubahan wajib punya entri di CHANGELOG-METHOD.md
 * beserta rujukan pasal R1-V1.7 dan persetujuan peneliti utama.
 */

export const METHOD = {
  // ── Delphi / CVI — R1-V1.7 §3.8.2, Tabel 3.6 ──────────────────────────
  /**
   * Batas validitas isi per butir. Dengan panel 8, nilai yang mungkin melompat
   * dari 0,75 (6 setuju) ke 0,875 (7 setuju); batas operasional yang memenuhi
   * >= 0,78 karena itu adalah 7 dari 8.
   *
   * JANGAN mengembalikan ini ke 0,75. R1-V1.7 §3.8.2 menurunkan status 0,75
   * menjadi statistik kesepakatan deskriptif, bukan keputusan validitas isi.
   */
  I_CVI_MIN: 0.78,
  I_CVI_REVISE_MIN: 0.5,
  S_CVI_AVE_MIN: 0.9,
  MEDIAN_MIN: 3,
  IQR_MAX: 1,
  RELEVANCE_MIN: 1,
  RELEVANCE_MAX: 4,
  /** Skor yang dihitung sebagai "relevan" untuk I-CVI. */
  RELEVANT_SCORES: [3, 4] as readonly number[],
  MAX_ROUNDS: 3,
  DELPHI_PANEL_SIZE: 8,

  // ── FGD — R1-V1.7 §3.7.1, Tabel 3.5 ───────────────────────────────────
  FGD_PANEL_SIZE: 6,
  /** >= 4 dari 6 memilih selain "terima" → revisi komponen. */
  FGD_REVISE_NON_ACCEPT_MIN: 4,
  /** >= 2 dari 6 memilih "tolak" → pembahasan khusus. */
  FGD_SPECIAL_REJECT_MIN: 2,

  // ── AHP — R1-V1.7 §3.9.2, Tabel 3.7 ───────────────────────────────────
  CR_MAX: 0.1,
  SAATY_MIN: 1,
  SAATY_MAX: 9,
  AGGREGATION: 'GEOMETRIC_MEAN' as const,
  /** Random Index Saaty, indeks 0 = n 1. */
  RANDOM_INDEX: [0, 0, 0.58, 0.9, 1.12, 1.24, 1.32, 1.41, 1.45, 1.49] as readonly number[],
  POWER_ITERATION_TOLERANCE: 1e-12,
  POWER_ITERATION_MAX: 1000,

  // ── Penskoran — R1-V1.7 §3.10.2 ───────────────────────────────────────
  LEVEL_MIN: 1,
  LEVEL_MAX: 5,
  /** Toleransi pemeriksaan jumlah bobot = 1. */
  WEIGHT_SUM_TOLERANCE: 1e-9,

  // ── Pilot bersyarat — R1-V1.7 Tabel 3.8 ───────────────────────────────
  PILOT_COMPLETENESS_MIN: 0.9,
  PILOT_KAPPA_MIN: 0.6,
  PILOT_AGREEMENT_MIN: 0.8,
  PILOT_TRACEABILITY: 1.0,

  // ── Baseline provisional DCGMI-A1.0 — R1-V1.7 §3.5 ────────────────────
  BASELINE_DOMAIN_COUNT: 8,
  BASELINE_ASPECT_COUNT: 15,
  BASELINE_INDICATOR_COUNT: 43,
  BASELINE_DISTRIBUTION: [7, 5, 6, 6, 4, 5, 4, 6] as readonly number[],
  /** Controlled exceptions — R1-V1.7 CH-08. Tidak boleh dihapus/dinomori ulang. */
  CONTROLLED_EXCEPTIONS: ['C20b', 'C42'] as readonly string[],
} as const;

export type MethodConstants = typeof METHOD;
