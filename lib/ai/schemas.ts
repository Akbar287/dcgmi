import { z } from "zod";

// docs/04 §5–§6. Votes and suggestions are never parsed from free text.
export const ACTIONS = ["TAMBAH", "HAPUS", "GABUNG", "PECAH", "PINDAH", "RUMUS_ULANG"] as const;

export const VoteSchema = z.object({
  position: z.enum(["TERIMA", "TERIMA_DENGAN_REVISI", "TOLAK"]),
  // Some models argue at length; 1200 keeps the vote readable without failing the whole component.
  reason: z.string().min(20).max(1200),
  proposedAction: z.enum(ACTIONS).nullable(),
});
export type Vote = z.infer<typeof VoteSchema>;

export const NoteExtractionSchema = z.object({
  suggestions: z.array(
    z.object({
      seatIndex: z.number().int(),
      action: z.enum(ACTIONS),
      quote: z.string().min(1),
      rationale: z.string().min(1),
    }),
  ),
});
export type NoteExtraction = z.infer<typeof NoteExtractionSchema>;

// docs/04 §7: relevance and clarity are rated separately so redaction quality
// does not leak into the relevance score.
export const RatingSchema = z.object({
  relevance: z.number().int().min(1).max(4),
  // Relaxed 2026-09-29 (400/300): some models write longer reasons; the 1–4 score is unchanged.
  reason: z.string().min(10).max(1000),
  clarityFlag: z.boolean(),
  clarityNote: z.string().max(600).nullable(),
});
export type Rating = z.infer<typeof RatingSchema>;

// docs/04 §8: one pair at a time; the reciprocal is filled by lib/method.
export const PairwiseSchema = z
  .object({
    preferred: z.enum(["A", "B", "EQUAL"]),
    intensity: z.number().int().min(1).max(9),
    // Relaxed 2026-09-29 (300): longer reasons failed whole matrices; preference and intensity are unchanged.
    reason: z.string().min(10).max(800),
  })
  .refine((p) => (p.preferred === "EQUAL") === (p.intensity === 1), { message: "EQUAL harus berintensitas 1, dan intensitas 1 berarti EQUAL" });
export type Pairwise = z.infer<typeof PairwiseSchema>;

// docs/09 `scoring.assessor.evidence`: level + locator + reason, per indicator.
export const AssessmentSchema = z.object({
  missingKind: z.enum(["NONE", "TIDAK_ADA_KAPABILITAS", "MISSING_ADMINISTRATIF"]),
  level: z.number().int().min(1).max(5).nullable(),
  satisfiedEvidence: z.array(z.string()),
  evidenceLocator: z.string().max(600).nullable(),
  rationale: z.string().min(10).max(500),
});
export type AssessorOutput = z.infer<typeof AssessmentSchema>;
