"use server";

import { randomInt } from "node:crypto";

import { cookies } from "next/headers";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";

import { fail, type ActionResult } from "@/lib/action-result";
import { can, type Permission } from "@/lib/auth/roles";
import { getCurrentUser } from "@/lib/auth/session";
import { lockContent, LockError } from "@/lib/db/repository/content-lock";
import { computeRealRound, createRealRound } from "@/lib/db/repository/delphi-real";
import { createDelphiRound, DelphiError, finalizeDelphiRound, reviewDelphiItem, setDelphiRoundStatus } from "@/lib/db/repository/delphi-rounds";
import { parseBudget } from "@/lib/validation/budget";
import { DELPHI_PROMPT_VERSIONS, runNextDelphiItem, type DelphiRunOutcome } from "@/lib/delphi/run-round";

import { getActiveVersionId, VERSION_COOKIE } from "../_lib/active-version";

async function actor(permission: Permission) {
  const user = await getCurrentUser();
  return user && can(user.role, permission) ? user : null;
}

function fromDelphi(error: unknown): ActionResult<never> {
  if (error instanceof DelphiError) return fail(error.code === "GATE" ? "GATE_BLOCKED" : error.code === "PANEL" ? "NOT_READY" : "VALIDATION_ERROR", error.message, error.details);
  throw error;
}

const createSchema = z.object({
  configId: z.string().min(1),
  seed: z
    .string()
    .optional()
    .transform((v) => (v ? Number(v) : null))
    .pipe(z.number().int().min(0).max(2_147_483_647).nullable()),
});

// SPECIFICATION §4.6: rounds run on the derived DRAFT version once G1 and G2 are PASSED.
export async function createDelphiRoundAction(_s: ActionResult | null, formData: FormData): Promise<ActionResult | null> {
  const user = await actor("simulation:run");
  if (!user) return fail("FORBIDDEN", "simulation:run");
  const parsed = createSchema.safeParse({ configId: formData.get("configId"), seed: formData.get("seed") ?? undefined });
  if (!parsed.success) return fail("VALIDATION_ERROR", parsed.error.issues.map((i) => i.message).join("; "));
  const versionId = await getActiveVersionId();
  if (!versionId) return fail("VALIDATION_ERROR", "Tidak ada versi artefak aktif.");
  const budget = parseBudget(formData.get("budget"));
  if (!budget.ok) return fail("VALIDATION_ERROR", "Anggaran harus angka USD positif.");
  let roundId: string;
  try {
    roundId = await createDelphiRound({ actorId: user.id, versionId, configId: parsed.data.configId, seed: parsed.data.seed ?? randomInt(0, 2_147_483_647), promptVersions: DELPHI_PROMPT_VERSIONS, budgetUsd: budget.value });
  } catch (error) {
    return fromDelphi(error);
  }
  revalidatePath("/delphi", "layout");
  redirect(`/delphi/ronde/${roundId}`);
}

export async function runNextDelphiItemAction(roundId: string): Promise<ActionResult<DelphiRunOutcome>> {
  const user = await actor("simulation:run");
  if (!user) return fail("FORBIDDEN", "simulation:run");
  const outcome = await runNextDelphiItem(roundId);
  revalidatePath(`/delphi/ronde/${roundId}`);
  return { ok: true, data: outcome };
}

export async function delphiRoundControlAction(roundId: string, action: "PAUSE" | "RETRY"): Promise<ActionResult> {
  const user = await actor("simulation:run");
  if (!user) return fail("FORBIDDEN", "simulation:run");
  await setDelphiRoundStatus(user.id, roundId, action);
  revalidatePath(`/delphi/ronde/${roundId}`);
  return { ok: true, data: null };
}

const reviewSchema = z.object({
  resultId: z.string().min(1),
  clarityCritical: z.enum(["yes", "no", ""]).transform((v) => (v === "yes" ? true : v === "no" ? false : null)),
  constructConflict: z
    .enum(["on"])
    .optional()
    .transform((v) => v === "on"),
  note: z
    .string()
    .trim()
    .max(2000)
    .optional()
    .transform((v) => v || null),
});

// docs/05 §6 G3: clarity criticality and construct conflict are the researcher's call.
export async function reviewDelphiItemAction(_s: ActionResult<string> | null, formData: FormData): Promise<ActionResult<string> | null> {
  const user = await actor("artifact:write");
  if (!user) return fail("FORBIDDEN", "artifact:write");
  const parsed = reviewSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return fail("VALIDATION_ERROR", "review");
  try {
    const decision = await reviewDelphiItem(user.id, parsed.data.resultId, parsed.data);
    revalidatePath("/delphi", "layout");
    return { ok: true, data: decision };
  } catch (error) {
    return fromDelphi(error);
  }
}

export async function finalizeDelphiRoundAction(_s: ActionResult | null, formData: FormData): Promise<ActionResult | null> {
  const user = await actor("artifact:write");
  if (!user) return fail("FORBIDDEN", "artifact:write");
  const roundId = String(formData.get("roundId") ?? "");
  try {
    await finalizeDelphiRound(user.id, roundId);
  } catch (error) {
    return fromDelphi(error);
  }
  revalidatePath("/", "layout");
  return { ok: true, data: null };
}

const lockSchema = z.object({
  label: z.string().trim().min(2).max(60).regex(/^[A-Za-z0-9._-]+$/),
  note: z.string().trim().min(10).max(2000),
});

// docs/05 §6 G4: the Admin's explicit lock decision creates the CONTENT_LOCKED version.
export async function lockContentAction(_s: ActionResult | null, formData: FormData): Promise<ActionResult | null> {
  const user = await actor("gate:pass");
  if (!user) return fail("FORBIDDEN", "gate:pass");
  const parsed = lockSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return fail("VALIDATION_ERROR", "Label (huruf, angka, titik, strip) dan catatan keputusan ≥ 10 karakter wajib diisi.");
  const sourceId = await getActiveVersionId();
  if (!sourceId) return fail("VALIDATION_ERROR", "Tidak ada versi artefak aktif.");
  try {
    const lockedId = await lockContent(user.id, sourceId, parsed.data.label, parsed.data.note);
    (await cookies()).set(VERSION_COOKIE, lockedId, { path: "/", maxAge: 60 * 60 * 24 * 365, sameSite: "lax" });
  } catch (error) {
    if (error instanceof LockError) return fail(error.code === "GATE" ? "GATE_BLOCKED" : "CONFLICT", error.message, error.details);
    throw error;
  }
  revalidatePath("/", "layout");
  return { ok: true, data: null };
}

// Human Delphi (REAL): the round and its form are an Admin decision (instrument:manage).
export async function createRealRoundAction(_s: ActionResult | null, formData: FormData): Promise<ActionResult | null> {
  const user = await actor("instrument:manage");
  if (!user) return fail("FORBIDDEN", "instrument:manage");
  const versionId = await getActiveVersionId();
  if (!versionId) return fail("VALIDATION_ERROR", "Tidak ada versi artefak aktif.");
  const seatCodes = String(formData.get("seatCodes") ?? "").split(/[\s,]+/).filter(Boolean);
  let roundId: string;
  try {
    ({ roundId } = await createRealRound({ actorId: user.id, versionId, configId: String(formData.get("configId") ?? ""), seatCodes }));
  } catch (error) {
    return fromDelphi(error);
  }
  revalidatePath("/delphi", "layout");
  redirect(`/delphi/ronde/${roundId}`);
}

export async function computeRealRoundAction(_s: ActionResult<{ done: number; deviation: string | null }> | null, formData: FormData): Promise<ActionResult<{ done: number; deviation: string | null }> | null> {
  const user = await actor("artifact:write");
  if (!user) return fail("FORBIDDEN", "artifact:write");
  try {
    const r = await computeRealRound(user.id, String(formData.get("roundId") ?? ""));
    revalidatePath("/delphi", "layout");
    return { ok: true, data: r };
  } catch (error) {
    return fromDelphi(error);
  }
}
