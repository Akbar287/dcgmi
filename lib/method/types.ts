// ── FGD ────────────────────────────────────────────────────────────────
export type FgdPositionType = 'TERIMA' | 'TERIMA_DENGAN_REVISI' | 'TOLAK';

export type FgdDecisionType =
  | 'TERIMA'
  | 'PERTAHANKAN_SEMENTARA'
  | 'TIDAK_SEPAKAT'
  | 'REVISI'
  | 'PEMBAHASAN_KHUSUS';

export type FgdRuleId =
  | 'ALL_ACCEPT'
  | 'NOTES_1_2'
  | 'SPLIT_3_3'
  | 'GE4_NON_TERIMA'
  | 'GE2_TOLAK';

export interface FgdTally {
  TERIMA: number;
  TERIMA_DENGAN_REVISI: number;
  TOLAK: number;
  total: number;
  nonAccept: number;
}

export interface FgdDecision {
  decision: FgdDecisionType;
  ruleFired: FgdRuleId;
  tally: FgdTally;
  /** Aturan lain yang juga terpenuhi tetapi kalah urutan evaluasi. */
  alsoTriggered: FgdRuleId[];
}

// ── Delphi / CVI ───────────────────────────────────────────────────────
/** null = penilai tidak mengisi. TIDAK BOLEH diimputasi (R1-V1.7 §3.8.3). */
export type Relevance = 1 | 2 | 3 | 4 | null;

export type DelphiDecision =
  | 'PERTAHANKAN'
  | 'REVISI_NILAI_ULANG'
  | 'HAPUS_DARI_INTI'
  | 'TIDAK_SELESAI';

export interface ItemCviInput {
  indicatorCode: string;
  ratings: Relevance[];
  /** Isu kejelasan kritis dari komentar pakar; dinilai terpisah dari relevansi. */
  clarityCritical?: boolean;
  /** Konflik konstruk mendasar yang dicatat peneliti. */
  constructConflict?: boolean;
  round?: number;
}

export interface ItemCviResult {
  indicatorCode: string;
  iCvi: number;
  median: number;
  iqr: number;
  /** Penyebut aktual. WAJIB ditampilkan bersama iCvi. */
  validRaters: number;
  plannedPanelSize: number;
  panelDeviation: boolean;
  decision: DelphiDecision;
  reasons: string[];
}

export interface ScaleCviResult {
  sCviAve: number;
  itemCount: number;
  passes: boolean;
}

// ── AHP ────────────────────────────────────────────────────────────────
export type Matrix = number[][];

export interface PriorityResult {
  weights: number[];
  lambdaMax: number;
  ci: number;
  cr: number;
  accepted: boolean;
  size: number;
}

export interface SeatMatrix {
  seatIndex: number;
  matrix: Matrix;
}

export interface AggregateResult extends PriorityResult {
  aggregatedMatrix: Matrix;
  includedSeats: number[];
  excludedSeats: { seatIndex: number; cr: number }[];
}

// ── Penskoran ──────────────────────────────────────────────────────────
export type MissingKind = 'NONE' | 'TIDAK_ADA_KAPABILITAS' | 'MISSING_ADMINISTRATIF';

export interface IndicatorScoreInput {
  indicatorCode: string;
  level: number | null;
  missingKind: MissingKind;
}

export interface AspectScoreInput {
  aspectCode: string;
  localWeight: number;
  indicators: IndicatorScoreInput[];
}

export interface DomainScoreInput {
  domainCode: string;
  weight: number;
  aspects: AspectScoreInput[];
}

export interface MissingEntry {
  indicatorCode: string;
  kind: MissingKind;
  blocks: string;
}

export interface ScoringResult {
  aspectScores: Record<string, number | null>;
  domainProfile: Record<string, number | null>;
  composite: number | null;
  compositeStatus: 'PROVISIONAL';
  missingReport: MissingEntry[];
}
