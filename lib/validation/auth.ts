import { z } from "zod";

import { ROLES } from "@/lib/auth/roles";

export const PASSWORD_MIN_LENGTH = 12;

const email = z.string().trim().toLowerCase().pipe(z.email());
const password = z.string().min(PASSWORD_MIN_LENGTH).max(256);

export const credentialsSchema = z.object({
  email,
  password: z.string().min(1).max(256),
});

export const createUserSchema = z.object({
  email,
  name: z.string().trim().max(120).optional().transform((v) => v || undefined),
  role: z.enum(ROLES),
  // Optional: Google-only accounts have no password.
  password: z
    .string()
    .optional()
    .transform((v) => v || undefined)
    .pipe(password.optional()),
});

export const updateUserRoleSchema = z.object({ userId: z.string().min(1), role: z.enum(ROLES) });
export const setUserActiveSchema = z.object({ userId: z.string().min(1), active: z.enum(["true", "false"]).transform((v) => v === "true") });
export const setUserPanelCodeSchema = z.object({
  userId: z.string().min(1),
  panelCode: z
    .string()
    .trim()
    .transform((v) => v || null),
});
export const setUserPasswordSchema = z.object({ userId: z.string().min(1), password });
