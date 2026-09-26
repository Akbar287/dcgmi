"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { fail, type ActionResult } from "@/lib/action-result";
import { can } from "@/lib/auth/roles";
import { getCurrentUser } from "@/lib/auth/session";
import { BuilderError, loadFormBySlug, saveGenericDraft, submitGeneric } from "@/lib/db/repository/form-builder";
import { findPanelCode } from "@/lib/db/repository/users";
import type { Answers } from "@/lib/forms/types";
import type { AnswerIssue } from "@/lib/forms/validate";

const answersSchema = z.record(z.string().max(200), z.string().max(10_000));

// The respondent code always comes from the account, never from the browser (docs/07 P3).
async function context(slug: string) {
  const user = await getCurrentUser();
  if (!user || !can(user.role, "instrument:fill")) return null;
  const code = await findPanelCode(user.id);
  const form = await loadFormBySlug(slug);
  return code && form ? { user, code, formId: form.def.id } : null;
}

export async function genericSaveAction(slug: string, answers: Answers, sectionOrder: number): Promise<ActionResult<{ savedAt: string }>> {
  const c = await context(slug);
  if (!c) return fail("FORBIDDEN", "instrument:fill");
  const parsed = answersSchema.safeParse(answers);
  if (!parsed.success) return fail("VALIDATION_ERROR", "answers");
  try {
    return { ok: true, data: { savedAt: await saveGenericDraft(c.formId, { code: c.code }, parsed.data, sectionOrder) } };
  } catch (error) {
    if (error instanceof BuilderError) return fail(error.code === "ALREADY_SUBMITTED" ? "ALREADY_SUBMITTED" : error.code === "NOT_ACTIVE" ? "NOT_ACTIVE" : "VALIDATION_ERROR", error.message);
    throw error;
  }
}

export async function genericSubmitAction(slug: string, answers: Answers): Promise<ActionResult<{ issues: AnswerIssue[] } | null>> {
  const c = await context(slug);
  if (!c) return fail("FORBIDDEN", "instrument:fill");
  const parsed = answersSchema.safeParse(answers);
  if (!parsed.success) return fail("VALIDATION_ERROR", "answers");
  try {
    const issues = await submitGeneric(c.formId, { code: c.code }, c.user.id, parsed.data);
    if (!issues.length) revalidatePath(`/pakar/${slug}`);
    return { ok: true, data: issues.length ? { issues } : null };
  } catch (error) {
    if (error instanceof BuilderError) return fail(error.code === "ALREADY_SUBMITTED" ? "ALREADY_SUBMITTED" : error.code === "NOT_ACTIVE" ? "NOT_ACTIVE" : "VALIDATION_ERROR", error.message);
    throw error;
  }
}
