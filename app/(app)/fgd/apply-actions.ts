"use server";

import { cookies } from "next/headers";
import { revalidatePath } from "next/cache";
import { z } from "zod";

import { fail, type ActionResult } from "@/lib/action-result";
import { can, type Permission } from "@/lib/auth/roles";
import { getCurrentUser } from "@/lib/auth/session";
import { db } from "@/lib/db/client";
import { resolveSpecialDiscussion } from "@/lib/db/repository/fgd-gate";
import { createDerivedVersion, DeriveError, markRevisionTask } from "@/lib/db/repository/version-derive";

import { getActiveVersionId, VERSION_COOKIE } from "../_lib/active-version";

async function actor(permission: Permission) {
  const user = await getCurrentUser();
  return user && can(user.role, permission) ? user : null;
}

const resolveSchema = z.object({ decisionId: z.string().min(1), note: z.string().trim().min(10).max(4000) });

// docs/05 §6 G2_FGD: PEMBAHASAN_KHUSUS counts only with the researcher's resolution note.
export async function resolveSpecialAction(_s: ActionResult | null, formData: FormData): Promise<ActionResult | null> {
  const user = await actor("artifact:write");
  if (!user) return fail("FORBIDDEN", "artifact:write");
  const parsed = resolveSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return fail("VALIDATION_ERROR", "Catatan resolusi minimal 10 karakter.");
  await resolveSpecialDiscussion(user.id, parsed.data.decisionId, parsed.data.note);
  revalidatePath("/fgd/terapkan");
  return { ok: true, data: null };
}

const deriveSchema = z.object({
  label: z.string().trim().min(2).max(60).regex(/^[A-Za-z0-9._-]+$/),
  note: z
    .string()
    .trim()
    .max(2000)
    .optional()
    .transform((v) => v || null),
});

// SPECIFICATION §4.5: the DRAFT child is created only after G2_FGD is PASSED on the parent.
export async function deriveVersionAction(_s: ActionResult | null, formData: FormData): Promise<ActionResult | null> {
  const user = await actor("artifact:write");
  if (!user) return fail("FORBIDDEN", "artifact:write");
  const parsed = deriveSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return fail("VALIDATION_ERROR", "Label: huruf, angka, titik, strip; 2–60 karakter.");
  const parentId = await getActiveVersionId();
  if (!parentId) return fail("VALIDATION_ERROR", "Tidak ada versi artefak aktif.");
  try {
    const childId = await createDerivedVersion(user.id, parentId, parsed.data.label, parsed.data.note);
    (await cookies()).set(VERSION_COOKIE, childId, { path: "/", maxAge: 60 * 60 * 24 * 365, sameSite: "lax" });
  } catch (error) {
    if (error instanceof DeriveError) return fail(error.code === "GATE" ? "GATE_BLOCKED" : "CONFLICT", error.message, error.code === "GATE" ? ["G2_FGD"] : undefined);
    throw error;
  }
  revalidatePath("/", "layout");
  return { ok: true, data: null };
}

const taskSchema = z.object({
  suggestionId: z.string().min(1),
  done: z.enum(["1", "0"]).transform((v) => v === "1"),
  note: z
    .string()
    .trim()
    .max(1000)
    .optional()
    .transform((v) => v || null),
});

export async function markRevisionTaskAction(_s: ActionResult | null, formData: FormData): Promise<ActionResult | null> {
  const user = await actor("artifact:write");
  if (!user) return fail("FORBIDDEN", "artifact:write");
  const parsed = taskSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return fail("VALIDATION_ERROR", "task");
  const versionId = await getActiveVersionId();
  const prisma = await db();
  const version = versionId ? await prisma.artifactVersion.findUnique({ where: { id: versionId }, select: { status: true, parentId: true } }) : null;
  if (version?.status !== "DRAFT" || !version.parentId) return fail("GATE_BLOCKED", "Tugas revisi hanya dapat ditandai pada versi DRAF turunan.");
  await markRevisionTask(user.id, parsed.data.suggestionId, parsed.data.note, parsed.data.done);
  revalidatePath("/fgd/terapkan");
  return { ok: true, data: null };
}
