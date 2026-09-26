import { z } from "zod";

// docs/04 §5–§6. Votes and suggestions are never parsed from free text.
export const ACTIONS = ["TAMBAH", "HAPUS", "GABUNG", "PECAH", "PINDAH", "RUMUS_ULANG"] as const;

export const VoteSchema = z.object({
  position: z.enum(["TERIMA", "TERIMA_DENGAN_REVISI", "TOLAK"]),
  reason: z.string().min(20).max(600),
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
  reason: z.string().min(10).max(400),
  clarityFlag: z.boolean(),
  clarityNote: z.string().max(300).nullable(),
});
export type Rating = z.infer<typeof RatingSchema>;

// docs/04 §8: one pair at a time; the reciprocal is filled by lib/method.
export const PairwiseSchema = z
  .object({
    preferred: z.enum(["A", "B", "EQUAL"]),
    intensity: z.number().int().min(1).max(9),
    reason: z.string().min(10).max(300),
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
