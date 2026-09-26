"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { fail, type ActionResult } from "@/lib/action-result";
import { diffVersions, type DiffEntry } from "@/lib/artifact/diff";
import { can } from "@/lib/auth/roles";
import { getCurrentUser } from "@/lib/auth/session";
import { getDiffIndicators } from "@/lib/db/repository/artifact";
import {
  addIndicator,
  EditError,
  moveIndicator,
  saveEvidence,
  saveRubric,
  setIndicatorDeleted,
  updateGroup,
  updateIndicatorContent,
  type EditMeta,
} from "@/lib/db/repository/artifact-edit";
import { METHOD } from "@/lib/method/constants";

type State = ActionResult<unknown> | null;

const optional = z
  .string()
  .trim()
  .max(4000)
  .optional()
  .transform((v) => v || null);

const metaSchema = z.object({
  reason: z.string().trim().min(5, "Alasan perubahan wajib diisi (min. 5 karakter).").max(2000),
  suggestionId: optional,
  exceptionDecision: optional,
});

async function writer() {
  const user = await getCurrentUser();
  return user && can(user.role, "artifact:write") ? user : null;
}

function fromEdit(error: unknown): State {
  if (error instanceof EditError) {
    const code = error.code === "CONTROLLED_EXCEPTION" ? "CONTROLLED_EXCEPTION" : error.code === "CONFLICT" ? "CONFLICT" : error.code === "NOT_EDITABLE" ? "GATE_BLOCKED" : "VALIDATION_ERROR";
    return fail(code, error.message, error.details);
  }
  throw error;
}

/** Shared wrapper: auth → parse → mutate → revalidate. Every mutation logs its own ChangeLogEntry. */
async function edit<T extends z.ZodType>(formData: FormData, schema: T, body: (userId: string, data: z.output<T>, meta: EditMeta) => Promise<unknown>): Promise<State> {
  const user = await writer();
  if (!user) return fail("FORBIDDEN", "artifact:write");
  const raw = Object.fromEntries(formData);
  const meta = metaSchema.safeParse(raw);
  if (!meta.success) return fail("VALIDATION_ERROR", meta.error.issues[0]?.message ?? "meta");
  const parsed = schema.safeParse(raw);
  if (!parsed.success) return fail("VALIDATION_ERROR", parsed.error.issues.map((i) => `${i.path.join(".")}: ${i.message}`).join("; "));
  try {
    const data = await body(user.id, parsed.data, meta.data);
    revalidatePath("/", "layout");
    return { ok: true, data: data ?? null };
  } catch (error) {
    return fromEdit(error);
  }
}

export async function updateContentAction(_s: State, formData: FormData) {
  return edit(
    formData,
    z.object({
      indicatorId: z.string().min(1),
      name: z.string().trim().min(3).max(500),
      operationalDefinition: optional,
      assessmentObject: optional,
      boundaryNote: optional,
      sources: z
        .string()
        .optional()
        .transform((v) => (v ?? "").split("\n").map((s) => s.trim()).filter(Boolean)),
    }),
    (uid, d, meta) => updateIndicatorContent(uid, d, meta),
  );
}

const LEVELS = Array.from({ length: METHOD.LEVEL_MAX - METHOD.LEVEL_MIN + 1 }, (_, i) => METHOD.LEVEL_MIN + i);

export async function saveRubricAction(_s: State, formData: FormData) {
  return edit(formData, z.object({ indicatorId: z.string().min(1) }), (uid, d, meta) =>
    saveRubric(
      uid,
      {
        indicatorId: d.indicatorId,
        levels: LEVELS.map((level) => ({
          level,
          label: String(formData.get(`label-${level}`) ?? "").trim(),
          descriptor: String(formData.get(`descriptor-${level}`) ?? "").trim(),
        })),
      },
      meta,
    ),
  );
}

export async function saveEvidenceAction(_s: State, formData: FormData) {
  return edit(
    formData,
    z.object({
      indicatorId: z.string().min(1),
      evidenceId: optional,
      remove: z.enum(["1"]).optional(),
      kind: z.enum(["NORMATIF", "IMPLEMENTASI", "OPERASIONAL", "HASIL", "PERBAIKAN"]).optional(),
      minimumFor: z
        .string()
        .optional()
        .transform((v) => (v ? Number(v) : null))
        .pipe(z.number().int().min(METHOD.LEVEL_MIN).max(METHOD.LEVEL_MAX).nullable()),
      mandatory: z.enum(["on"]).optional(),
      description: z.string().trim().max(2000).optional(),
    }),
    (uid, d, meta) => {
      if (d.remove) {
        if (!d.evidenceId) throw new EditError("INVALID", "evidenceId");
        return saveEvidence(uid, { indicatorId: d.indicatorId, evidenceId: d.evidenceId, data: null }, meta);
      }
      if (!d.kind || !d.description || d.description.length < 5) throw new EditError("INVALID", "Jenis dan deskripsi bukti wajib diisi.");
      return saveEvidence(
        uid,
        { indicatorId: d.indicatorId, evidenceId: d.evidenceId, data: { kind: d.kind, minimumFor: d.minimumFor, mandatory: d.mandatory === "on", description: d.description } },
        meta,
      );
    },
  );
}

export async function addIndicatorAction(_s: State, formData: FormData) {
  return edit(
    formData,
    z.object({ aspectId: z.string().min(1), code: z.string().trim().min(2).max(8), name: z.string().trim().min(3).max(500), operationalDefinition: optional }),
    (uid, d, meta) => addIndicator(uid, d, meta),
  );
}

export async function setDeletedAction(_s: State, formData: FormData) {
  return edit(formData, z.object({ indicatorId: z.string().min(1), deleted: z.enum(["1", "0"]).transform((v) => v === "1") }), (uid, d, meta) =>
    setIndicatorDeleted(uid, d, meta),
  );
}

export async function moveIndicatorAction(_s: State, formData: FormData) {
  return edit(formData, z.object({ indicatorId: z.string().min(1), targetAspectId: z.string().min(1) }), (uid, d, meta) => moveIndicator(uid, d, meta));
}

export async function updateGroupAction(_s: State, formData: FormData) {
  return edit(
    formData,
    z.object({
      type: z.enum(["Domain", "Aspect"]),
      id: z.string().min(1),
      name: z.string().trim().min(2).max(300),
      rationale: optional,
      sdgTags: z
        .string()
        .optional()
        .transform((v) => (v === undefined ? undefined : v.split(",").map((s) => s.trim()).filter(Boolean))),
    }),
    (uid, d, meta) => updateGroup(uid, d, meta),
  );
}

/** Read-only; `console:read` is enough. */
export async function compareVersionsAction(fromId: string, toId: string): Promise<ActionResult<DiffEntry[]>> {
  const user = await getCurrentUser();
  if (!user || !can(user.role, "console:read")) return fail("FORBIDDEN", "console:read");
  const [from, to] = await Promise.all([getDiffIndicators(fromId), getDiffIndicators(toId)]);
  return { ok: true, data: diffVersions(from, to) };
}
