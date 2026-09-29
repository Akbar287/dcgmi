"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { fail, type ActionResult } from "@/lib/action-result";
import { can, type Permission } from "@/lib/auth/roles";
import { getCurrentUser } from "@/lib/auth/session";
import { advanceReportJob, approveChapter, buildReportPdf, createReportJob, editChapter, regenerateChapter, ReportError } from "@/lib/db/repository/report-jobs";
import type { ChapterKey } from "@/lib/report/chapters";
import { parseBudget } from "@/lib/validation/budget";

import { getActiveVersionId } from "../_lib/active-version";

async function actor(permission: Permission) {
  const user = await getCurrentUser();
  return user && can(user.role, permission) ? user : null;
}

const fromReport = (error: unknown): ActionResult<never> => {
  if (error instanceof ReportError) return fail(error.code === "STATE" ? "NOT_READY" : "VALIDATION_ERROR", error.message);
  throw error;
};

// Narration calls a model (cost), so creation and narration need simulation:run.
export async function createReportAction(_s: ActionResult | null, formData: FormData): Promise<ActionResult | null> {
  const user = await actor("simulation:run");
  if (!user) return fail("FORBIDDEN", "simulation:run");
  const versionId = await getActiveVersionId();
  if (!versionId) return fail("VALIDATION_ERROR", "Tidak ada versi artefak aktif.");
  const budget = parseBudget(formData.get("budget"));
  if (!budget.ok) return fail("VALIDATION_ERROR", "Anggaran harus angka USD positif.");
  const id = await createReportJob(user.id, versionId, budget.value);
  revalidatePath("/audit", "layout");
  redirect(`/audit/laporan/${id}`);
}

export async function advanceReportAction(jobId: string): Promise<ActionResult<Awaited<ReturnType<typeof advanceReportJob>>>> {
  const user = await actor("simulation:run");
  if (!user) return fail("FORBIDDEN", "simulation:run");
  try {
    const r = await advanceReportJob(jobId);
    revalidatePath(`/audit/laporan/${jobId}`);
    return { ok: true, data: r };
  } catch (error) {
    return fromReport(error);
  }
}

export async function editChapterAction(_s: ActionResult | null, formData: FormData): Promise<ActionResult | null> {
  const user = await actor("artifact:write");
  if (!user) return fail("FORBIDDEN", "artifact:write");
  const narrative = String(formData.get("narrative") ?? "").trim();
  if (narrative.length < 20) return fail("VALIDATION_ERROR", "Narasi minimal 20 karakter.");
  const jobId = String(formData.get("jobId"));
  try {
    await editChapter(user.id, jobId, String(formData.get("key")) as ChapterKey, narrative);
  } catch (error) {
    return fromReport(error);
  }
  revalidatePath(`/audit/laporan/${jobId}`);
  return { ok: true, data: null };
}

// Approval is the researcher's statement that the narrative matches the data (Admin).
export async function chapterOpAction(jobId: string, key: ChapterKey, op: "APPROVE" | "REGENERATE"): Promise<ActionResult> {
  const user = await actor(op === "APPROVE" ? "gate:pass" : "simulation:run");
  if (!user) return fail("FORBIDDEN", op === "APPROVE" ? "gate:pass" : "simulation:run");
  try {
    if (op === "APPROVE") await approveChapter(user.id, jobId, key);
    else await regenerateChapter(user.id, jobId, key);
  } catch (error) {
    return fromReport(error);
  }
  revalidatePath(`/audit/laporan/${jobId}`);
  return { ok: true, data: null };
}

export async function buildReportAction(_s: ActionResult<{ pages: number; sha256: string }> | null, formData: FormData): Promise<ActionResult<{ pages: number; sha256: string }> | null> {
  const user = await actor("simulation:run");
  if (!user) return fail("FORBIDDEN", "simulation:run");
  const jobId = String(formData.get("jobId"));
  try {
    const r = await buildReportPdf(user.id, jobId);
    revalidatePath(`/audit/laporan/${jobId}`);
    return { ok: true, data: r };
  } catch (error) {
    return fromReport(error);
  }
}
