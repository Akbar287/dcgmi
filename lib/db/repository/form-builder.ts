import type { Prisma } from "@/generated/prisma/client";
import { checkStructure, visitedPath } from "@/lib/forms/branching";
import { FIELD_TYPES, type Answers, type FieldDef, type FieldType, type FormDef, type SectionDef } from "@/lib/forms/types";
import { validateDraft, validateSection, type AnswerIssue } from "@/lib/forms/validate";

import { db } from "../client";

type Tx = Prisma.TransactionClient;

export class BuilderError extends Error {
  constructor(
    readonly code: "NOT_EDITABLE" | "NOT_FOUND" | "CONFLICT" | "INVALID" | "GATE" | "NOT_ACTIVE" | "ALREADY_SUBMITTED" | "NOT_ALLOWED",
    message: string,
    readonly details?: unknown,
  ) {
    super(message);
    this.name = "BuilderError";
  }
}

/** Settings of builder-made forms; PRE_REVIEW forms keep their own snapshot shape. */
export interface GenericSettings {
  kind: "GENERIC" | "DELPHI";
  /** Artifact version the form belongs to (its stage gate is checked on it). */
  versionId: string | null;
  /** Panel codes allowed to answer (PAKAR accounts bound by an Admin). */
  respondents: string[];
  delphi?: { roundId: string; roundNumber: number };
}

export const isGeneric = (s: unknown): s is GenericSettings => typeof s === "object" && s !== null && ["GENERIC", "DELPHI"].includes((s as { kind?: string }).kind ?? "");

/** SPECIFICATION §4.2: a form for a stage opens only when the gate before that stage has passed. */
export const STAGE_GATE: Record<string, string | null> = {
  BASELINE: null,
  FGD: "G1_BASELINE",
  DELPHI_CVI: "G2_FGD",
  CONTENT_LOCK: "G3_DELPHI",
  AHP: "G4_CONTENT_LOCK",
  SCORING: "G5_AHP",
  PILOT: "G6_SCORING",
};

const audit = (tx: Tx, actorId: string, action: string, targetId: string, payload: Prisma.InputJsonValue = {}) =>
  tx.auditEvent.create({ data: { actorId, actorKind: "USER", action, targetType: "Form", targetId, payload } });

type FormRow = Prisma.FormGetPayload<{ include: { sections: { include: { fields: true } } } }>;

export function toFormDef(f: FormRow): FormDef {
  return {
    id: f.id,
    slug: f.slug,
    title: f.title,
    purpose: f.purpose,
    instructions: f.instructions,
    sections: [...f.sections]
      .sort((a, b) => a.order - b.order)
      .map(
        (s): SectionDef => ({
          id: s.id,
          order: s.order,
          title: s.title,
          description: s.description,
          next: ((s.nextRule as { next?: SectionDef["next"] } | null)?.next ?? "NEXT") as SectionDef["next"],
          fields: [...s.fields]
            .sort((a, b) => a.order - b.order)
            .map(
              (x): FieldDef => ({
                id: x.id,
                key: x.key,
                type: x.type as FieldType,
                label: x.label,
                helpText: x.helpText,
                required: x.required,
                options: (x.options as string[] | null) ?? [],
                config: (x.config as FieldDef["config"]) ?? null,
                branching: (x.branching as FieldDef["branching"]) ?? null,
              }),
            ),
        }),
      ),
  };
}

export async function loadForm(formId: string) {
  const prisma = await db();
  const f = await prisma.form.findUnique({ where: { id: formId }, include: { sections: { include: { fields: true } } } });
  if (!f || !isGeneric(f.settings)) return null;
  return { row: f, def: toFormDef(f), settings: f.settings as unknown as GenericSettings };
}

export async function loadFormBySlug(slug: string) {
  const prisma = await db();
  const f = await prisma.form.findUnique({ where: { slug }, select: { id: true } });
  return f ? loadForm(f.id) : null;
}

export async function listBuilderForms() {
  const prisma = await db();
  const rows = await prisma.form.findMany({ orderBy: { createdAt: "desc" }, include: { _count: { select: { sections: true, responses: true } }, responses: { select: { dataOrigin: true, completed: true } } } });
  return rows
    .filter((f) => isGeneric(f.settings))
    .map((f) => ({
      id: f.id,
      slug: f.slug,
      title: f.title,
      status: f.status,
      kind: (f.settings as unknown as GenericSettings).kind,
      stageTag: f.stageTag,
      sections: f._count.sections,
      real: f.responses.filter((r) => r.dataOrigin === "REAL" && r.completed).length,
      dryRun: f.responses.filter((r) => r.dataOrigin === "SIMULATED").length,
      createdAt: f.createdAt,
    }));
}

/** Structure can change only before any REAL response exists, and never on DELPHI forms (generated). */
async function editable(tx: Tx, formId: string) {
  const f = await tx.form.findUnique({ where: { id: formId }, include: { _count: { select: { responses: { where: { dataOrigin: "REAL" } } } } } });
  if (!f || !isGeneric(f.settings)) throw new BuilderError("NOT_FOUND", "Formulir tidak ditemukan.");
  if ((f.settings as unknown as GenericSettings).kind === "DELPHI") throw new BuilderError("NOT_EDITABLE", "Formulir Delphi dibuat dari artefak dan tidak disunting manual.");
  if (!["DRAFT", "DRY_RUN", "HOLD"].includes(f.status)) throw new BuilderError("NOT_EDITABLE", `Formulir berstatus ${f.status}; tutup atau tahan dulu.`);
  if (f._count.responses > 0) throw new BuilderError("NOT_EDITABLE", "Sudah ada respons REAL; buat formulir versi baru.");
  return f;
}

export async function createForm(actorId: string, input: { slug: string; title: string; purpose: string; stageTag: string | null; versionId: string | null }) {
  const prisma = await db();
  if (await prisma.form.findUnique({ where: { slug: input.slug }, select: { id: true } })) throw new BuilderError("CONFLICT", `Slug ${input.slug} sudah dipakai.`);
  const version = input.versionId ? await prisma.artifactVersion.findUnique({ where: { id: input.versionId }, select: { label: true } }) : null;
  return prisma.$transaction(async (tx) => {
    const settings: GenericSettings = { kind: "GENERIC", versionId: input.versionId, respondents: [] };
    const f = await tx.form.create({
      data: {
        slug: input.slug,
        title: input.title,
        purpose: input.purpose,
        versionLabel: version?.label ?? "—",
        status: "DRAFT",
        stageTag: (input.stageTag as never) ?? null,
        settings: settings as unknown as Prisma.InputJsonValue,
        sections: { create: [{ order: 0, title: input.title, fields: { create: [] } }] },
      },
    });
    await audit(tx, actorId, "FORM_CREATE", f.id, { slug: input.slug });
    return f.id;
  });
}

export async function updateFormMeta(actorId: string, formId: string, input: { title: string; purpose: string; instructions: string | null; stageTag: string | null; respondents: string[] }) {
  const prisma = await db();
  await prisma.$transaction(async (tx) => {
    const f = await editable(tx, formId);
    const settings = { ...(f.settings as unknown as GenericSettings), respondents: [...new Set(input.respondents)] };
    await tx.form.update({ where: { id: formId }, data: { title: input.title, purpose: input.purpose, instructions: input.instructions, stageTag: (input.stageTag as never) ?? null, settings: settings as unknown as Prisma.InputJsonValue } });
    await audit(tx, actorId, "FORM_UPDATE", formId, { respondents: settings.respondents.length });
  });
}

export async function saveSection(actorId: string, formId: string, input: { id: string | null; title: string; description: string | null; next: SectionDef["next"] }) {
  const prisma = await db();
  await prisma.$transaction(async (tx) => {
    await editable(tx, formId);
    if (input.id) await tx.formSection.update({ where: { id: input.id }, data: { title: input.title, description: input.description, nextRule: { next: input.next } } });
    else {
      const max = await tx.formSection.aggregate({ where: { formId }, _max: { order: true } });
      await tx.formSection.create({ data: { formId, order: (max._max.order ?? -1) + 1, title: input.title, description: input.description, nextRule: { next: input.next } } });
    }
    await audit(tx, actorId, input.id ? "FORM_SECTION_UPDATE" : "FORM_SECTION_ADD", formId, { title: input.title });
  });
}

export async function deleteSection(actorId: string, formId: string, sectionId: string) {
  const prisma = await db();
  await prisma.$transaction(async (tx) => {
    await editable(tx, formId);
    if ((await tx.formSection.count({ where: { formId } })) <= 1) throw new BuilderError("INVALID", "Formulir minimal punya satu seksi.");
    await tx.formSection.delete({ where: { id: sectionId } });
    await audit(tx, actorId, "FORM_SECTION_DELETE", formId, { sectionId });
  });
}

/** Swaps order with the neighbour; jump targets refer to orders, so they are remapped too. */
export async function moveSection(actorId: string, formId: string, sectionId: string, dir: -1 | 1) {
  const prisma = await db();
  await prisma.$transaction(async (tx) => {
    await editable(tx, formId);
    const all = await tx.formSection.findMany({ where: { formId }, orderBy: { order: "asc" }, include: { fields: true } });
    const i = all.findIndex((s) => s.id === sectionId);
    const j = i + dir;
    if (i < 0 || j < 0 || j >= all.length) return;
    const [a, b] = [all[i], all[j]];
    const swap = (t: unknown) => (t === a.order ? b.order : t === b.order ? a.order : t);
    await tx.formSection.update({ where: { id: a.id }, data: { order: -1 } });
    await tx.formSection.update({ where: { id: b.id }, data: { order: a.order } });
    await tx.formSection.update({ where: { id: a.id }, data: { order: b.order } });
    for (const s of all) {
      const next = (s.nextRule as { next?: unknown } | null)?.next;
      if (typeof next === "number") await tx.formSection.update({ where: { id: s.id }, data: { nextRule: { next: swap(next) as number } } });
      for (const f of s.fields) {
        if (!f.branching) continue;
        const br = Object.fromEntries(Object.entries(f.branching as Record<string, unknown>).map(([k, v]) => [k, swap(v)]));
        await tx.formField.update({ where: { id: f.id }, data: { branching: br as Prisma.InputJsonValue } });
      }
    }
    await audit(tx, actorId, "FORM_SECTION_MOVE", formId, { sectionId, dir });
  });
}

export interface FieldInput {
  id: string | null;
  sectionId: string;
  key: string;
  type: FieldType;
  label: string;
  helpText: string | null;
  required: boolean;
  options: string[];
  config: FieldDef["config"];
  branching: FieldDef["branching"];
}

const KEY = /^[a-z][a-z0-9_]{0,39}$/;

export async function saveField(actorId: string, formId: string, input: FieldInput) {
  if (!FIELD_TYPES.includes(input.type)) throw new BuilderError("INVALID", "Tipe field tidak dikenal.");
  if (!KEY.test(input.key)) throw new BuilderError("INVALID", "Kunci field: huruf kecil, angka, garis bawah; diawali huruf; ≤ 40 karakter.");
  const prisma = await db();
  await prisma.$transaction(async (tx) => {
    await editable(tx, formId);
    const clash = await tx.formField.findFirst({ where: { key: input.key, section: { formId }, NOT: input.id ? { id: input.id } : undefined } });
    if (clash) throw new BuilderError("CONFLICT", `Kunci ${input.key} sudah dipakai di formulir ini.`);
    const data = {
      sectionId: input.sectionId,
      key: input.key,
      type: input.type,
      label: input.label,
      helpText: input.helpText,
      required: input.type === "INFO" ? false : input.required,
      options: input.options as Prisma.InputJsonValue,
      config: (input.config ?? undefined) as Prisma.InputJsonValue | undefined,
      branching: (input.branching ?? undefined) as Prisma.InputJsonValue | undefined,
    };
    if (input.id) await tx.formField.update({ where: { id: input.id }, data });
    else {
      const max = await tx.formField.aggregate({ where: { sectionId: input.sectionId }, _max: { order: true } });
      await tx.formField.create({ data: { ...data, order: (max._max.order ?? -1) + 1 } });
    }
    await audit(tx, actorId, input.id ? "FORM_FIELD_UPDATE" : "FORM_FIELD_ADD", formId, { key: input.key, type: input.type });
  });
}

export async function deleteField(actorId: string, formId: string, fieldId: string) {
  const prisma = await db();
  await prisma.$transaction(async (tx) => {
    await editable(tx, formId);
    const f = await tx.formField.delete({ where: { id: fieldId } });
    await audit(tx, actorId, "FORM_FIELD_DELETE", formId, { key: f.key });
  });
}

export async function moveField(actorId: string, formId: string, fieldId: string, dir: -1 | 1) {
  const prisma = await db();
  await prisma.$transaction(async (tx) => {
    await editable(tx, formId);
    const f = await tx.formField.findUniqueOrThrow({ where: { id: fieldId } });
    const siblings = await tx.formField.findMany({ where: { sectionId: f.sectionId }, orderBy: { order: "asc" } });
    const i = siblings.findIndex((s) => s.id === fieldId);
    const j = i + dir;
    if (j < 0 || j >= siblings.length) return;
    await tx.formField.update({ where: { id: siblings[i].id }, data: { order: siblings[j].order } });
    await tx.formField.update({ where: { id: siblings[j].id }, data: { order: siblings[i].order } });
    await audit(tx, actorId, "FORM_FIELD_MOVE", formId, { key: f.key, dir });
  });
}

/** What blocks activation: structure issues, no respondents, or the stage gate. */
export async function activationIssues(formId: string): Promise<string[]> {
  const loaded = await loadForm(formId);
  if (!loaded) return ["NOT_FOUND"];
  const issues = checkStructure(loaded.def).map((i) => `${i.code}: ${i.detail}`);
  if (loaded.settings.respondents.length === 0) issues.push("NO_RESPONDENTS");
  const gate = loaded.row.stageTag ? STAGE_GATE[loaded.row.stageTag] : null;
  if (gate) {
    if (!loaded.settings.versionId) issues.push(`NO_VERSION_FOR_GATE: ${gate}`);
    else {
      const prisma = await db();
      const g = await prisma.gateRecord.findUnique({ where: { versionId_gate: { versionId: loaded.settings.versionId, gate } } });
      if (g?.status !== "PASSED") issues.push(`GATE_NOT_PASSED: ${gate}`);
    }
  }
  return issues;
}

const TRANSITIONS: Record<string, string[]> = {
  DRAFT: ["DRY_RUN", "HOLD"],
  DRY_RUN: ["DRAFT", "HOLD"],
  HOLD: ["DRAFT", "DRY_RUN", "ACTIVE"],
  ACTIVE: ["CLOSED", "HOLD"],
  CLOSED: ["ACTIVE"],
};

/** SPECIFICATION §4.2: DRAFT | DRY_RUN | HOLD | ACTIVE | CLOSED; ACTIVE only with no issue (Admin checked by the action). */
export async function setFormStatus(actorId: string, formId: string, to: "DRAFT" | "DRY_RUN" | "HOLD" | "ACTIVE" | "CLOSED") {
  const prisma = await db();
  const f = await prisma.form.findUniqueOrThrow({ where: { id: formId } });
  if (!isGeneric(f.settings)) throw new BuilderError("NOT_FOUND", "Formulir tidak ditemukan.");
  if (!TRANSITIONS[f.status]?.includes(to)) throw new BuilderError("INVALID", `${f.status} → ${to} tidak diizinkan.`);
  if (to === "ACTIVE") {
    const issues = await activationIssues(formId);
    if (issues.length) throw new BuilderError("GATE", "Formulir belum dapat diaktifkan.", issues);
  }
  await prisma.$transaction(async (tx) => {
    await tx.form.update({ where: { id: formId }, data: { status: to, ...(to === "ACTIVE" ? { openedAt: new Date(), closedAt: null } : to === "CLOSED" ? { closedAt: new Date() } : {}) } });
    await audit(tx, actorId, `FORM_STATUS_${to}`, formId, { from: f.status });
  });
}

// ── Responses ────────────────────────────────────────────────────────

/** A dry-run respondent never collides with a panel code and is never counted. */
export const dryRunRef = (userId: string) => `UJI:${userId}`;

async function responseContext(formId: string, respondent: { code: string } | { dryRunUserId: string }) {
  const loaded = await loadForm(formId);
  if (!loaded) throw new BuilderError("NOT_FOUND", "Formulir tidak ditemukan.");
  if ("code" in respondent) {
    if (loaded.row.status !== "ACTIVE") throw new BuilderError("NOT_ACTIVE", "Formulir tidak aktif.");
    if (!loaded.settings.respondents.includes(respondent.code)) throw new BuilderError("NOT_ALLOWED", "Kode Anda tidak terdaftar untuk formulir ini.");
    return { loaded, ref: respondent.code, origin: "REAL" as const };
  }
  if (loaded.row.status !== "DRY_RUN") throw new BuilderError("NOT_ACTIVE", "Uji coba hanya saat status DRY_RUN.");
  return { loaded, ref: dryRunRef(respondent.dryRunUserId), origin: "SIMULATED" as const };
}

export async function getResponse(formId: string, ref: string) {
  const prisma = await db();
  return prisma.formResponse.findUnique({ where: { formId_respondentRef: { formId, respondentRef: ref } } });
}

export async function saveGenericDraft(formId: string, respondent: { code: string } | { dryRunUserId: string }, answers: Answers, sectionOrder: number) {
  const { loaded, ref, origin } = await responseContext(formId, respondent);
  const issues = validateDraft(loaded.def, answers);
  if (issues.length) throw new BuilderError("INVALID", "Jawaban tidak sah.", issues);
  const prisma = await db();
  const existing = await getResponse(formId, ref);
  if (existing?.completed) throw new BuilderError("ALREADY_SUBMITTED", "Respons sudah dikirim.");
  const meta = { ...((existing?.meta as object | null) ?? {}), sectionOrder, ...(existing ? {} : { startedAt: new Date().toISOString() }), ...(origin === "SIMULATED" ? { dryRun: true } : {}) };
  await prisma.formResponse.upsert({
    where: { formId_respondentRef: { formId, respondentRef: ref } },
    // docs/07 P1/P3: panel answers are REAL from the first write; dry runs are SIMULATED.
    create: { formId, respondentRef: ref, dataOrigin: origin, answers, meta },
    update: { answers, meta },
  });
  return new Date().toISOString();
}

/** Submit: every VISITED section must validate (skipped sections are not required). */
export async function submitGeneric(formId: string, respondent: { code: string } | { dryRunUserId: string }, actorId: string, answers: Answers): Promise<AnswerIssue[]> {
  const { loaded, ref, origin } = await responseContext(formId, respondent);
  const draft = validateDraft(loaded.def, answers);
  if (draft.length) return draft;
  const path = visitedPath(loaded.def, answers);
  const issues = loaded.def.sections.filter((s) => path.includes(s.order)).flatMap((s) => validateSection(s, answers));
  if (issues.length) return issues;
  const prisma = await db();
  const existing = await getResponse(formId, ref);
  if (existing?.completed) throw new BuilderError("ALREADY_SUBMITTED", "Respons sudah dikirim.");
  const now = new Date();
  const startedAt = (existing?.meta as { startedAt?: string } | null)?.startedAt;
  const meta = { ...((existing?.meta as object | null) ?? {}), submittedAt: now.toISOString(), durationMs: startedAt ? now.getTime() - Date.parse(startedAt) : null, path, ...(origin === "SIMULATED" ? { dryRun: true } : {}) };
  await prisma.$transaction([
    prisma.formResponse.upsert({
      where: { formId_respondentRef: { formId, respondentRef: ref } },
      create: { formId, respondentRef: ref, dataOrigin: origin, answers, meta, completed: true, submittedAt: now },
      update: { answers, meta, completed: true, submittedAt: now },
    }),
    prisma.auditEvent.create({ data: { actorId, actorKind: "USER", action: origin === "REAL" ? "FORM_SUBMIT" : "FORM_DRY_RUN_SUBMIT", targetType: "Form", targetId: formId, payload: { respondent: origin === "REAL" ? ref : "UJI" } } }),
  ]);
  return [];
}

export async function listGenericFormsForCode(code: string) {
  const prisma = await db();
  const forms = await prisma.form.findMany({ where: { status: "ACTIVE" }, include: { responses: { where: { respondentRef: code }, select: { completed: true, submittedAt: true } } } });
  return forms
    .filter((f) => isGeneric(f.settings) && (f.settings as unknown as GenericSettings).respondents.includes(code))
    .map((f) => ({ slug: f.slug, title: f.title, state: f.responses[0] ? (f.responses[0].completed ? "SUBMITTED" : "DRAFT") : "NONE", submittedAt: f.responses[0]?.submittedAt?.toISOString() ?? null }));
}
