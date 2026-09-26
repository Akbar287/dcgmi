"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { fail, type ActionResult } from "@/lib/action-result";
import { can } from "@/lib/auth/roles";
import { getCurrentUser } from "@/lib/auth/session";
import {
  declineConsent,
  FormStateError,
  getRunnerForm,
  saveDraft,
  submitResponse,
} from "@/lib/db/repository/pre-review";
import {
  EXPERT_KEY,
  PARAGRAPH_MAX,
  validateDraft,
  validateSubmission,
  type AnswerIssue,
} from "@/lib/instruments/pre-review/answers";
import { findPanelCode } from "@/lib/db/repository/users";
import type { Answers } from "@/lib/instruments/pre-review/types";

const answersSchema = z.record(z.string().max(200), z.string().max(PARAGRAPH_MAX));

/** The respondent, their bound code, and a form they are allowed to fill. */
async function context(slug: string) {
  const user = await getCurrentUser();
  if (!user || !can(user.role, "instrument:fill")) return { ok: false, result: fail("FORBIDDEN", "instrument:fill") } as const;
  const panelCode = await findPanelCode(user.id);
  if (!panelCode) return { ok: false, result: fail("FORBIDDEN", "no panel code") } as const;
  const form = await getRunnerForm(slug);
  if (!form || form.status !== "ACTIVE") return { ok: false, result: fail("NOT_ACTIVE", slug) } as const;
  if (!form.snapshot.data.experts.includes(panelCode)) return { ok: false, result: fail("FORBIDDEN", "code not in panel") } as const;
  return { ok: true, user, panelCode, form } as const;
}

function stateFailure(error: unknown): ActionResult<never> {
  if (error instanceof FormStateError) {
    return fail(error.code === "ALREADY_SUBMITTED" ? "ALREADY_SUBMITTED" : "NOT_ACTIVE", error.message);
  }
  throw error;
}

function parse(raw: unknown, code: string): Answers | null {
  const parsed = answersSchema.safeParse(raw);
  // The code always comes from the account, never from the browser.
  return parsed.success ? { ...parsed.data, [EXPERT_KEY]: code } : null;
}

export async function saveDraftAction(slug: string, raw: unknown, pageIndex: number): Promise<ActionResult<{ savedAt: string }>> {
  const ctx = await context(slug);
  if (!ctx.ok) return ctx.result;
  const answers = parse(raw, ctx.panelCode);
  if (!answers) return fail("VALIDATION_ERROR", "answers");
  const issues = validateDraft(ctx.form.snapshot.plan, answers);
  if (issues.length > 0) return fail("VALIDATION_ERROR", "draft", issues);
  try {
    const savedAt = await saveDraft(ctx.form.id, ctx.panelCode, answers, Number.isInteger(pageIndex) ? pageIndex : 0);
    return { ok: true, data: { savedAt } };
  } catch (error) {
    return stateFailure(error);
  }
}

export async function submitAction(slug: string, raw: unknown): Promise<ActionResult<{ issues?: AnswerIssue[] } | null>> {
  const ctx = await context(slug);
  if (!ctx.ok) return ctx.result;
  const answers = parse(raw, ctx.panelCode);
  if (!answers) return fail("VALIDATION_ERROR", "answers");
  const { plan, data, signature } = ctx.form.snapshot;
  const issues = validateSubmission(plan, answers, data.options, ctx.panelCode);
  if (issues.length > 0) return fail("VALIDATION_ERROR", "submission", issues);
  try {
    await submitResponse(ctx.form.id, ctx.panelCode, ctx.user.id, answers, signature);
  } catch (error) {
    return stateFailure(error);
  }
  revalidatePath(`/pakar/${slug}`);
  revalidatePath("/pakar");
  return { ok: true, data: null };
}

export async function declineAction(slug: string): Promise<ActionResult> {
  const ctx = await context(slug);
  if (!ctx.ok) return ctx.result;
  try {
    await declineConsent(ctx.form.id, ctx.panelCode);
  } catch (error) {
    return stateFailure(error);
  }
  revalidatePath("/pakar");
  return { ok: true, data: null };
}
