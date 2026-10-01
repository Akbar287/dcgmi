// Chapters of the full G1–G7 report, in print order.
export const REPORT_CHAPTERS = [
  { key: "intro", title: "Pendahuluan, lingkup, dan garis versi", file: "Pendahuluan" },
  { key: "g1", title: "G1 — Baseline artefak", file: "G1-Baseline" },
  { key: "g2", title: "G2 — FGD simulasi", file: "G2-FGD" },
  { key: "derive", title: "Versi turunan dan revisi pasca-FGD", file: "Versi-turunan" },
  { key: "g3", title: "G3 — Delphi / CVI", file: "G3-Delphi" },
  { key: "g4", title: "G4 — Content lock", file: "G4-Content-lock" },
  { key: "g5", title: "G5 — AHP", file: "G5-AHP" },
  { key: "g6", title: "G6 — Penskoran", file: "G6-Penskoran" },
  { key: "g7", title: "G7 — Pilot bersyarat", file: "G7-Pilot" },
  { key: "closing", title: "Keterbatasan dan integritas", file: "Penutup" },
] as const;

export type ChapterKey = (typeof REPORT_CHAPTERS)[number]["key"];

export interface ChapterState {
  key: ChapterKey;
  title: string;
  status: "PENDING" | "DRAFT" | "APPROVED";
  narrative: string | null;
  generatedAt: string | null;
  edited: boolean;
  approvedById: string | null;
  approvedAt: string | null;
  error: string | null;
}

export const REPORT_MODEL_ID = "anthropic/claude-sonnet-5";
