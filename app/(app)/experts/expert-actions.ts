"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { fail, type ActionResult } from "@/lib/action-result";
import { can, type Permission } from "@/lib/auth/roles";
import { getCurrentUser } from "@/lib/auth/session";
import { db } from "@/lib/db/client";
import { deleteIdentity, PanelStateError, saveExpert, saveIdentity, savePersona, setPersonaStatus } from "@/lib/db/repository/panel-admin";
import { personaBriefSchema } from "@/lib/persona/schema";
import { expertSchema, identitySchema } from "@/lib/validation/panel";

import { getActiveVersionId } from "../_lib/active-version";

type State = ActionResult<unknown> | null;

async function actor(permission: Permission) {
  const user = await getCurrentUser();
  return user && can(user.role, permission) ? user : null;
}

function failure(error: unknown): ActionResult<never> {
  if (error instanceof PanelStateError) {
    return fail(error.code === "CONFLICT" ? "CONFLICT" : "VALIDATION_ERROR", error.message, error.details);
  }
  throw error;
}

/** Structure summary injected into the persona prompt (docs/04 §4.4 {artifactSummary}). */
async function artifactSummary(): Promise<string> {
  const versionId = await getActiveVersionId();
  if (!versionId) return "belum ada versi artefak";
  const prisma = await db();
  const [version, domains, aspects, indicators] = await Promise.all([
    prisma.artifactVersion.findUniqueOrThrow({ where: { id: versionId }, select: { label: true } }),
    prisma.domain.count({ where: { versionId } }),
    prisma.aspect.count({ where: { domain: { versionId } } }),
    prisma.indicator.count({ where: { aspect: { domain: { versionId } }, deletedAt: null } }),
  ]);
  return `${domains} domain, ${aspects} aspek, ${indicators} indikator (${version.label})`;
}

export async function saveExpertAction(_state: State, formData: FormData): Promise<State> {
  const user = await actor("panel:manage");
  if (!user) return fail("FORBIDDEN", "panel:manage");
  const parsed = expertSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return fail("VALIDATION_ERROR", parsed.error.issues.map((i) => i.message).join("; "));
  try {
    const id = await saveExpert(user.id, parsed.data);
    revalidatePath("/experts", "layout");
    return { ok: true, data: { id } };
  } catch (error) {
    return failure(error);
  }
}

// PanelistIdentity is Admin-only (R1-V1.7 §3.13.2).
export async function saveIdentityAction(_state: State, formData: FormData): Promise<State> {
  const user = await actor("identity:read");
  if (!user) return fail("FORBIDDEN", "identity:read");
  const parsed = identitySchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return fail("VALIDATION_ERROR", parsed.error.issues.map((i) => i.message).join("; "));
  try {
    const id = await saveIdentity(user.id, parsed.data);
    revalidatePath("/experts/identitas");
    return { ok: true, data: { id } };
  } catch (error) {
    return failure(error);
  }
}

export async function deleteIdentityAction(_state: State, formData: FormData): Promise<State> {
  const user = await actor("identity:read");
  if (!user) return fail("FORBIDDEN", "identity:read");
  const id = formData.get("id");
  if (typeof id !== "string" || !id) return fail("VALIDATION_ERROR", "id");
  await deleteIdentity(user.id, id);
  revalidatePath("/experts/identitas");
  return { ok: true, data: null };
}

const lines = (v: FormDataEntryValue | null) =>
  typeof v === "string"
    ? v
        .split("\n")
        .map((s) => s.trim())
        .filter(Boolean)
    : [];

export async function savePersonaAction(_state: State, formData: FormData): Promise<State> {
  const user = await actor("panel:manage");
  if (!user) return fail("FORBIDDEN", "panel:manage");
  const expertId = formData.get("expertId");
  if (typeof expertId !== "string" || !expertId) return fail("VALIDATION_ERROR", "expertId");
  const years = formData.get("yearsExperience");
  const parsed = personaBriefSchema.safeParse({
    expertiseAreas: lines(formData.get("expertiseAreas")),
    yearsExperience: typeof years === "string" && years.trim() ? Number(years) : null,
    institutionType: formData.get("institutionType") || null,
    researchFocus: lines(formData.get("researchFocus")),
    methodStance: formData.get("methodStance") ?? "",
    vocabularyHints: lines(formData.get("vocabularyHints")),
    emphasisBias: formData.get("emphasisBias") ?? "",
  });
  if (!parsed.success) return fail("VALIDATION_ERROR", parsed.error.issues.map((i) => `${i.path.join(".")}: ${i.message}`).join("; "));
  try {
    const findings = await savePersona(user.id, expertId, parsed.data, await artifactSummary());
    revalidatePath(`/experts/persona/${expertId}`);
    revalidatePath("/experts", "layout");
    return { ok: true, data: { findings: findings.length } };
  } catch (error) {
    return failure(error);
  }
}

const statusSchema = z.object({ expertId: z.string().min(1), to: z.enum(["REVIEWED", "APPROVED", "RETIRED"]) });

export async function setPersonaStatusAction(_state: State, formData: FormData): Promise<State> {
  const parsed = statusSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return fail("VALIDATION_ERROR", "status");
  // Review is team work; approval and retirement are the Admin's decision (docs/03 approvePersona).
  const user = await actor(parsed.data.to === "REVIEWED" ? "panel:manage" : "persona:approve");
  if (!user) return fail("FORBIDDEN", parsed.data.to);
  try {
    await setPersonaStatus(user.id, parsed.data.expertId, parsed.data.to, await artifactSummary());
    revalidatePath(`/experts/persona/${parsed.data.expertId}`);
    revalidatePath("/", "layout");
    return { ok: true, data: null };
  } catch (error) {
    return failure(error);
  }
}
