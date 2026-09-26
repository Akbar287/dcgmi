import { z } from "zod";

import { EXPERT_FIELDS } from "@/lib/panel/presets";

const flag = z.enum(["on", "true", "false", ""]).optional().transform((v) => v === "on" || v === "true");
const optionalText = (max: number) =>
  z
    .string()
    .trim()
    .max(max)
    .optional()
    .transform((v) => v || null);

export const expertSchema = z.object({
  id: z.string().optional().transform((v) => v || undefined),
  panelCode: z.string().trim().toUpperCase().regex(/^[A-Z0-9-]{2,12}$/, "Kode 2–12 karakter: huruf besar, angka, tanda hubung."),
  // Pseudonym allowed (SPECIFICATION §4.3); real identity belongs in PanelistIdentity.
  displayName: optionalText(120),
  field: z.enum(EXPERT_FIELDS),
  affiliation: optionalText(200),
  coiDeclared: flag,
  coiNote: optionalText(1000),
  inFgd: flag,
  inDelphi: flag,
  inAhp: flag,
});

export const identitySchema = z.object({
  id: z.string().optional().transform((v) => v || undefined),
  panelCode: z.string().trim().toUpperCase().regex(/^[A-Z0-9-]{2,12}$/),
  fullName: z.string().trim().min(2).max(200),
  email: z
    .string()
    .trim()
    .optional()
    .transform((v) => v || null)
    .pipe(z.email().nullable()),
  institution: optionalText(200),
  note: optionalText(1000),
});

export const seatSchema = z.object({
  seatId: z.string().min(1),
  expertId: z.string().optional().transform((v) => v || null),
  modelProfileId: z.string().min(1),
  temperature: z.coerce.number().min(0).max(2),
  seed: z
    .string()
    .optional()
    .transform((v) => (v ? Number(v) : null))
    .pipe(z.number().int().min(0).max(2_147_483_647).nullable()),
});
