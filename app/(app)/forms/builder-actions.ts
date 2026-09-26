"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";

import { fail, type ActionResult } from "@/lib/action-result";
import { can, type Permission } from "@/lib/auth/roles";
import { getCurrentUser } from "@/lib/auth/session";
import {
  BuilderError,
  createForm,
  deleteField,
  deleteSection,
  moveField,
  moveSection,
  saveField,
  saveGenericDraft,
  saveSection,
  setFormStatus,
  submitGeneric,
  updateFormMeta,
} from "@/lib/db/repository/form-builder";
import { FIELD_TYPES, type Answers, type FieldDef, type FieldType } from "@/lib/forms/types";
import type { AnswerIssue } from "@/lib/forms/validate";

import { getActiveVersionId } from "../_lib/active-version";

async function actor(permission: Permission) {
  const user = await getCurrentUser();
  return user && can(user.role, permission) ? user : null;
}

function fromBuilder(error: unknown): ActionResult<never> {
  if (error instanceof BuilderError) {
    const code = error.code === "GATE" ? "GATE_BLOCKED" : error.code === "CONFLICT" ? "CONFLICT" : error.code === "NOT_ACTIVE" ? "NOT_ACTIVE" : error.code === "ALREADY_SUBMITTED" ? "ALREADY_SUBMITTED" : error.code === "NOT_ALLOWED" ? "FORBIDDEN" : "VALIDATION_ERROR";
    return fail(code, error.message, error.details);
  }
  throw error;
}

const refresh = (formId?: string) => {
  revalidatePath("/forms", "layout");
  if (formId) revalidatePath(`/forms/sunting/${formId}`);
};

const STAGES = ["BASELINE", "FGD", "DELPHI_CVI", "CONTENT_LOCK", "AHP", "SCORING", "PILOT"] as const;
const optional = z
  .string()
  .trim()
  .max(10_000)
  .optional()
  .transform((v) => v || null);

export async function createFormAction(_s: ActionResult | null, formData: FormData): Promise<ActionResult | null> {
  const user = await actor("artifact:write");
  if (!user) return fail("FORBIDDEN", "artifact:write");
  const parsed = z
    .object({
      slug: z.string().trim().regex(/^[a-z0-9][a-z0-9-]{2,60}$/, "Slug: huruf kecil, angka, strip; 3–61 karakter."),
      title: z.string().trim().min(3).max(200),
      purpose: z.string().trim().min(3).max(1000),
      stageTag: z.enum([...STAGES, ""]).transform((v) => v || null),
    })
    .safeParse(Object.fromEntries(formData));
  if (!parsed.success) return fail("VALIDATION_ERROR", parsed.error.issues[0]?.message ?? "form");
  let id: string;
  try {
    id = await createForm(user.id, { ...parsed.data, versionId: await getActiveVersionId() });
  } catch (error) {
    return fromBuilder(error);
  }
  refresh();
  redirect(`/forms/sunting/${id}`);
}

export async function updateFormMetaAction(_s: ActionResult | null, formData: FormData): Promise<ActionResult | null> {
  const user = await actor("artifact:write");
  if (!user) return fail("FORBIDDEN", "artifact:write");
  const parsed = z
    .object({ formId: z.string().min(1), title: z.string().trim().min(3).max(200), purpose: z.string().trim().min(3).max(1000), instructions: optional, stageTag: z.enum([...STAGES, ""]).transform((v) => v || null), respondents: z.string().max(5000).default("") })
    .safeParse(Object.fromEntries(formData));
  if (!parsed.success) return fail("VALIDATION_ERROR", parsed.error.issues[0]?.message ?? "meta");
  const respondents = parsed.data.respondents.split(/[\s,]+/).map((c) => c.trim()).filter(Boolean);
  try {
    await updateFormMeta(user.id, parsed.data.formId, { ...parsed.data, respondents });
  } catch (error) {
    return fromBuilder(error);
  }
  refresh(parsed.data.formId);
  return { ok: true, data: null };
}

const nextSchema = z.string().transform((v): "NEXT" | "SUBMIT" | number => (v === "SUBMIT" ? "SUBMIT" : v === "NEXT" || v === "" ? "NEXT" : Number(v)));

export async function saveSectionAction(_s: ActionResult | null, formData: FormData): Promise<ActionResult | null> {
  const user = await actor("artifact:write");
  if (!user) return fail("FORBIDDEN", "artifact:write");
  const parsed = z
    .object({ formId: z.string().min(1), sectionId: optional, title: z.string().trim().min(1).max(200), description: optional, next: nextSchema })
    .safeParse(Object.fromEntries(formData));
  if (!parsed.success) return fail("VALIDATION_ERROR", parsed.error.issues[0]?.message ?? "section");
  try {
    await saveSection(user.id, parsed.data.formId, { id: parsed.data.sectionId, title: parsed.data.title, description: parsed.data.description, next: parsed.data.next });
  } catch (error) {
    return fromBuilder(error);
  }
  refresh(parsed.data.formId);
  return { ok: true, data: null };
}

export async function sectionOpAction(formId: string, sectionId: string, op: "UP" | "DOWN" | "DELETE"): Promise<ActionResult> {
  const user = await actor("artifact:write");
  if (!user) return fail("FORBIDDEN", "artifact:write");
  try {
    if (op === "DELETE") await deleteSection(user.id, formId, sectionId);
    else await moveSection(user.id, formId, sectionId, op === "UP" ? -1 : 1);
  } catch (error) {
    return fromBuilder(error);
  }
  refresh(formId);
  return { ok: true, data: null };
}

export async function fieldOpAction(formId: string, fieldId: string, op: "UP" | "DOWN" | "DELETE"): Promise<ActionResult> {
  const user = await actor("artifact:write");
  if (!user) return fail("FORBIDDEN", "artifact:write");
  try {
    if (op === "DELETE") await deleteField(user.id, formId, fieldId);
    else await moveField(user.id, formId, fieldId, op === "UP" ? -1 : 1);
  } catch (error) {
    return fromBuilder(error);
  }
  refresh(formId);
  return { ok: true, data: null };
}

const lines = (v: FormDataEntryValue | null) => String(v ?? "").split("\n").map((l) => l.trim()).filter(Boolean);

export async function saveFieldAction(_s: ActionResult | null, formData: FormData): Promise<ActionResult | null> {
  const user = await actor("artifact:write");
  if (!user) return fail("FORBIDDEN", "artifact:write");
  const type = String(formData.get("type")) as FieldType;
  if (!FIELD_TYPES.includes(type)) return fail("VALIDATION_ERROR", "Tipe field tidak dikenal.");
  const formId = String(formData.get("formId") ?? "");
  const options = ["SINGLE_CHOICE", "MULTI_CHOICE", "DROPDOWN"].includes(type) ? [...new Set(lines(formData.get("options")))] : [];
  let config: FieldDef["config"] = null;
  if (type === "LINEAR_SCALE") {
    const min = Number(formData.get("min") ?? 1);
    const max = Number(formData.get("max") ?? 5);
    if (!Number.isInteger(min) || !Number.isInteger(max) || min >= max || max - min > 10) return fail("VALIDATION_ERROR", "Skala: min < maks, bilangan bulat, rentang ≤ 10.");
    config = { min, max, minLabel: String(formData.get("minLabel") ?? "") || undefined, maxLabel: String(formData.get("maxLabel") ?? "") || undefined };
  }
  if (type === "PAIRWISE") {
    const elements = lines(formData.get("elements")).map((l) => {
      const [code, ...rest] = l.split(/\s+/);
      return { code, label: rest.join(" ") || code };
    });
    if (elements.length < 2 || elements.length > 10) return fail("VALIDATION_ERROR", "Pairwise memerlukan 2–10 elemen (Random Index Saaty sampai n = 10).");
    config = { elements };
  }
  if (type === "RELEVANCE_4") config = { clarity: formData.get("clarity") === "on" };
  let branching: FieldDef["branching"] = null;
  if (type === "SINGLE_CHOICE" || type === "DROPDOWN") {
    const entries = options.map((o, i) => [o, String(formData.get(`branch-${i}`) ?? "")] as const).filter(([, v]) => v !== "");
    if (entries.length) branching = Object.fromEntries(entries.map(([o, v]) => [o, v === "SUBMIT" ? "SUBMIT" : Number(v)]));
  }
  try {
    await saveField(user.id, formId, {
      id: String(formData.get("fieldId") ?? "") || null,
      sectionId: String(formData.get("sectionId") ?? ""),
      key: String(formData.get("key") ?? "").trim(),
      type,
      label: String(formData.get("label") ?? "").trim() || "(tanpa judul)",
      helpText: String(formData.get("helpText") ?? "").trim() || null,
      required: formData.get("required") === "on",
      options,
      config,
      branching,
    });
  } catch (error) {
    return fromBuilder(error);
  }
  refresh(formId);
  return { ok: true, data: null };
}

// SPECIFICATION §4.2: only an Admin sets ACTIVE (and CLOSED); drafts and dry runs belong to editors.
export async function setFormStatusAction(formId: string, to: "DRAFT" | "DRY_RUN" | "HOLD" | "ACTIVE" | "CLOSED"): Promise<ActionResult> {
  const user = await actor(to === "ACTIVE" || to === "CLOSED" ? "instrument:manage" : "artifact:write");
  if (!user) return fail("FORBIDDEN", to === "ACTIVE" || to === "CLOSED" ? "instrument:manage" : "artifact:write");
  try {
    await setFormStatus(user.id, formId, to);
  } catch (error) {
    return fromBuilder(error);
  }
  refresh(formId);
  return { ok: true, data: null };
}

const answersSchema = z.record(z.string().max(200), z.string().max(10_000));

// Dry run (DRY_RUN status): console users try the form; stored SIMULATED, never counted.
export async function dryRunSaveAction(formId: string, answers: Answers, sectionOrder: number): Promise<ActionResult<{ savedAt: string }>> {
  const user = await actor("artifact:write");
  if (!user) return fail("FORBIDDEN", "artifact:write");
  const parsed = answersSchema.safeParse(answers);
  if (!parsed.success) return fail("VALIDATION_ERROR", "answers");
  try {
    return { ok: true, data: { savedAt: await saveGenericDraft(formId, { dryRunUserId: user.id }, parsed.data, sectionOrder) } };
  } catch (error) {
    return fromBuilder(error);
  }
}

export async function dryRunSubmitAction(formId: string, answers: Answers): Promise<ActionResult<{ issues: AnswerIssue[] } | null>> {
  const user = await actor("artifact:write");
  if (!user) return fail("FORBIDDEN", "artifact:write");
  const parsed = answersSchema.safeParse(answers);
  if (!parsed.success) return fail("VALIDATION_ERROR", "answers");
  try {
    const issues = await submitGeneric(formId, { dryRunUserId: user.id }, user.id, parsed.data);
    if (!issues.length) revalidatePath(`/forms/uji/${formId}`);
    return { ok: true, data: issues.length ? { issues } : null };
  } catch (error) {
    return fromBuilder(error);
  }
}
