"use server";

import { randomInt } from "node:crypto";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";

import { fail, type ActionResult } from "@/lib/action-result";
import { can } from "@/lib/auth/roles";
import { getCurrentUser } from "@/lib/auth/session";
import { createPilotRun, declarePilot, nextPilotAssessment } from "@/lib/db/repository/pilot";
import { createAssessment, saveInstitutionProfile, saveRecomputeReport, ScoringError, setAssessmentStatus } from "@/lib/db/repository/scoring-runs";
import { parseBudget } from "@/lib/validation/budget";
import { runNextScore, SCORING_PROMPT_VERSIONS, type ScoringRunOutcome } from "@/lib/scoring/run-item";

import { getActiveVersionId } from "../_lib/active-version";

async function runner() {
  const user = await getCurrentUser();
  return user && can(user.role, "simulation:run") ? user : null;
}

function fromScoring(error: unknown): ActionResult<never> {
  if (error instanceof ScoringError) return fail(error.code === "GATE" ? "GATE_BLOCKED" : error.code === "CONFLICT" ? "CONFLICT" : "VALIDATION_ERROR", error.message, error.details);
  throw error;
}

const profileSchema = z.object({
  id: z
    .string()
    .optional()
    .transform((v) => v || null),
  label: z.string().trim().min(3).max(120),
  description: z.string().trim().min(40, "Deskripsi profil fiktif minimal 40 karakter.").max(20_000),
});

// docs/07: profiles are fictional; the label always carries [FIKTIF].
export async function saveProfileAction(_s: ActionResult | null, formData: FormData): Promise<ActionResult | null> {
  const user = await runner();
  if (!user) return fail("FORBIDDEN", "simulation:run");
  const parsed = profileSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return fail("VALIDATION_ERROR", parsed.error.issues[0]?.message ?? "profil");
  try {
    await saveInstitutionProfile(user.id, parsed.data);
  } catch (error) {
    return fromScoring(error);
  }
  revalidatePath("/scoring", "layout");
  return { ok: true, data: null };
}

const createSchema = z.object({
  profileId: z.string().min(1),
  modelProfileId: z.string().min(1),
  seed: z
    .string()
    .optional()
    .transform((v) => (v ? Number(v) : null))
    .pipe(z.number().int().min(0).max(2_147_483_647).nullable()),
});

export async function createAssessmentAction(_s: ActionResult | null, formData: FormData): Promise<ActionResult | null> {
  const user = await runner();
  if (!user) return fail("FORBIDDEN", "simulation:run");
  const parsed = createSchema.safeParse({ profileId: formData.get("profileId"), modelProfileId: formData.get("modelProfileId"), seed: formData.get("seed") ?? undefined });
  if (!parsed.success) return fail("VALIDATION_ERROR", "asesmen");
  const budget = parseBudget(formData.get("budget"));
  if (!budget.ok) return fail("VALIDATION_ERROR", "Anggaran harus angka USD positif.");
  const versionId = await getActiveVersionId();
  if (!versionId) return fail("VALIDATION_ERROR", "Tidak ada versi artefak aktif.");
  let id: string;
  try {
    id = await createAssessment({ actorId: user.id, versionId, profileId: parsed.data.profileId, modelProfileId: parsed.data.modelProfileId, seed: parsed.data.seed ?? randomInt(0, 2_147_483_647), promptVersions: SCORING_PROMPT_VERSIONS, budgetUsd: budget.value });
  } catch (error) {
    return fromScoring(error);
  }
  revalidatePath("/scoring", "layout");
  redirect(`/scoring/asesmen/${id}`);
}

export async function runNextScoreAction(assessmentId: string): Promise<ActionResult<ScoringRunOutcome>> {
  const user = await runner();
  if (!user) return fail("FORBIDDEN", "simulation:run");
  const outcome = await runNextScore(assessmentId);
  revalidatePath(`/scoring/asesmen/${assessmentId}`);
  return { ok: true, data: outcome };
}

export async function assessmentControlAction(assessmentId: string, action: "PAUSE" | "RETRY" | "CANCEL"): Promise<ActionResult> {
  const user = await runner();
  if (!user) return fail("FORBIDDEN", "simulation:run");
  await setAssessmentStatus(user.id, assessmentId, action);
  revalidatePath("/scoring", "layout");
  return { ok: true, data: null };
}

// SPECIFICATION §3.14: the report is accepted only for the current export (same SHA-256).
export async function uploadRecomputeReportAction(_s: ActionResult | null, formData: FormData): Promise<ActionResult | null> {
  const user = await runner();
  if (!user) return fail("FORBIDDEN", "simulation:run");
  const file = formData.get("report");
  if (!(file instanceof File) || file.size === 0 || file.size > 2_000_000) return fail("VALIDATION_ERROR", "Unggah berkas laporan JSON (≤ 2 MB).");
  const versionId = await getActiveVersionId();
  if (!versionId) return fail("VALIDATION_ERROR", "Tidak ada versi artefak aktif.");
  try {
    await saveRecomputeReport(user.id, versionId, await file.text());
  } catch (error) {
    return fromScoring(error);
  }
  revalidatePath("/", "layout");
  return { ok: true, data: null };
}

// ── Pilot (G7) ───────────────────────────────────────────────────────

export async function createPilotAction(_s: ActionResult | null, formData: FormData): Promise<ActionResult | null> {
  const user = await runner();
  if (!user) return fail("FORBIDDEN", "simulation:run");
  const versionId = await getActiveVersionId();
  if (!versionId) return fail("VALIDATION_ERROR", "Tidak ada versi artefak aktif.");
  const seed = Number(formData.get("seed") || randomInt(0, 2_147_483_647));
  try {
    await createPilotRun({
      actorId: user.id,
      versionId,
      profileIds: formData.getAll("profileIds").map(String),
      assessorA: String(formData.get("assessorA") ?? ""),
      assessorB: String(formData.get("assessorB") ?? ""),
      seed: Number.isInteger(seed) ? seed : 0,
      promptVersions: SCORING_PROMPT_VERSIONS,
    });
  } catch (error) {
    return fromScoring(error);
  }
  revalidatePath("/scoring", "layout");
  return { ok: true, data: null };
}

export async function runPilotStepAction(runId: string): Promise<ActionResult<ScoringRunOutcome | { kind: "PILOT_DONE" }>> {
  const user = await runner();
  if (!user) return fail("FORBIDDEN", "simulation:run");
  const next = await nextPilotAssessment(runId);
  if (!next) return { ok: true, data: { kind: "PILOT_DONE" } };
  const outcome = await runNextScore(next.id);
  revalidatePath("/scoring/pilot");
  return { ok: true, data: outcome };
}

const declSchema = z.object({
  kind: z.enum(["ETHICS", "ACCESS"]),
  reference: z.string().trim().max(200).optional().transform((v) => v || null),
  date: z.string().trim().max(20).optional().transform((v) => v || null),
  note: z.string().trim().max(2000).optional().transform((v) => v || null),
});

// G7 declarations are the researcher's statement of record (Admin).
export async function declarePilotAction(_s: ActionResult | null, formData: FormData): Promise<ActionResult | null> {
  const user = await getCurrentUser();
  if (!user || !can(user.role, "gate:pass")) return fail("FORBIDDEN", "gate:pass");
  const parsed = declSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return fail("VALIDATION_ERROR", "deklarasi");
  const d = parsed.data;
  if (d.kind === "ETHICS" && (!d.reference || !d.date)) return fail("VALIDATION_ERROR", "Nomor dan tanggal izin etik wajib diisi.");
  if (d.kind === "ACCESS" && (!d.note || d.note.length < 10)) return fail("VALIDATION_ERROR", "Uraikan akses institusi (min. 10 karakter).");
  const versionId = await getActiveVersionId();
  if (!versionId) return fail("VALIDATION_ERROR", "Tidak ada versi artefak aktif.");
  await declarePilot(user.id, versionId, d);
  revalidatePath("/scoring/pilot");
  return { ok: true, data: null };
}
