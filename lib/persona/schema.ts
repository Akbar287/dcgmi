import { z } from "zod";

// docs/04 §4.2 PersonaExtractionSchema — used here for manual entry.
export const INSTITUTION_TYPES = ["PTN_BESAR", "PTN_MENENGAH", "PTS", "KEMENTERIAN", "INDUSTRI", "LAINNYA"] as const;

const item = z.string().trim().min(1).max(120);

export const personaBriefSchema = z.object({
  expertiseAreas: z.array(item).min(1).max(8),
  yearsExperience: z.number().int().min(0).max(60).nullable(),
  institutionType: z.enum(INSTITUTION_TYPES).nullable(),
  researchFocus: z.array(item).max(8),
  methodStance: z.string().trim().max(400),
  vocabularyHints: z.array(item).max(15),
  emphasisBias: z.string().trim().max(300),
});

export type PersonaBriefInput = z.infer<typeof personaBriefSchema>;
