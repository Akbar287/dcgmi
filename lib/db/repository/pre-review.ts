import type { Prisma } from "@/generated/prisma/client";
import { CONSENT_NO } from "@/lib/instruments/pre-review/answers";
import type { ResponseRecord } from "@/lib/instruments/pre-review/normalize";
import { toPages } from "@/lib/instruments/pre-review/pages";
import { productionReadiness } from "@/lib/instruments/pre-review/readiness";
import { isPreReviewSettings, parseSnapshot, toSettings, verifySnapshot } from "@/lib/instruments/pre-review/snapshot";
import type { Answers, PreReviewSnapshot } from "@/lib/instruments/pre-review/types";

import { db } from "../client";
import { assertSingleOrigin } from "../origin";

export class FormStateError extends Error {
  constructor(
    readonly code: "NOT_FOUND" | "NOT_ACTIVE" | "ALREADY_SUBMITTED" | "NOT_READY" | "SIGNATURE_CHANGED",
    message: string,
  ) {
    super(message);
    this.name = "FormStateError";
  }
}

type Tx = Prisma.TransactionClient;

/**
 * Creates the form from a verified snapshot. Like build_() in the Apps Script,
 * an existing form is never overwritten: same signature is a no-op, a
 * different one is refused (a new version needs a new slug).
 */
export async function importPreReviewForm(snapshot: PreReviewSnapshot, slug: string): Promise<"CREATED" | "UNCHANGED"> {
  const prisma = await db();
  return prisma.$transaction(async (tx) => {
    const existing = await tx.form.findUnique({ where: { slug }, select: { settings: true } });
    if (existing) {
      if (isPreReviewSettings(existing.settings) && existing.settings.signature === snapshot.signature) return "UNCHANGED";
      throw new FormStateError("SIGNATURE_CHANGED", `Isi berubah setelah form ${slug} dibuat. Jangan menimpa; gunakan slug baru untuk versi baru.`);
    }
    const pages = toPages(snapshot.plan);
    let planIndex = 0;
    const form = await tx.form.create({
      data: {
        slug,
        title: snapshot.title,
        purpose: snapshot.description.split("\n")[0],
        instructions: snapshot.description,
        versionLabel: snapshot.builderVersion,
        // Not bound to a gate: researcher decision 2026-09-26 (SPECIFICATION §4.2).
        stageTag: null,
        sourceSha256: snapshot.dataSha256,
        settings: toSettings(snapshot) as unknown as Prisma.InputJsonValue,
        sections: {
          create: pages.map((page, order) => {
            if (page.page) planIndex++;
            return {
              order,
              title: page.page?.title ?? snapshot.title,
              description: page.page?.help ?? null,
              fields: {
                create: page.fields.map((f, i) => ({
                  order: i,
                  key: f.key,
                  type: f.type,
                  label: f.title,
                  helpText: f.help,
                  required: f.required,
                  options: f.type === "MC" ? f.choices : undefined,
                  config: {
                    planIndex: planIndex++,
                    ...(f.consent ? { consent: true } : {}),
                    ...(f.canonicalId ? { canonicalId: f.canonicalId, field: f.field, excelColumn: f.excelColumn } : {}),
                  },
                  branching: f.consent ? { Bersedia: "CONTINUE", [CONSENT_NO]: "SUBMIT" } : undefined,
                })),
              },
            };
          }),
        },
      },
    });
    await tx.auditEvent.create({
      data: {
        actorKind: "SYSTEM",
        action: "FORM_IMPORT",
        targetType: "Form",
        targetId: form.id,
        payload: { slug, signature: snapshot.signature, dataSha256: snapshot.dataSha256, source: snapshot.source.questions.file },
      },
    });
    return "CREATED";
  });
}

async function loadForm(tx: Tx, formId: string) {
  return tx.form.findUnique({
    where: { id: formId },
    include: { sections: { orderBy: { order: "asc" }, include: { fields: { orderBy: { order: "asc" } } } } },
  });
}

/** Port of verifyForm_(): stored hashes, then every section and field against the plan. */
function verifyContent(form: NonNullable<Awaited<ReturnType<typeof loadForm>>>): string[] {
  if (!isPreReviewSettings(form.settings)) return ["Form ini bukan form pra-reviu terverifikasi."];
  const issues = verifySnapshot(form.settings, form.sourceSha256);
  if (issues.length > 0) return issues;
  const snapshot = parseSnapshot(form.settings);
  const pages = toPages(snapshot.plan);
  if (form.sections.length !== pages.length) return [`Jumlah bagian ${form.sections.length} ≠ ${pages.length}.`];
  pages.forEach((page, i) => {
    const section = form.sections[i];
    if (page.page && (section.title !== page.page.title || section.description !== page.page.help)) {
      issues.push(`Judul/petunjuk bagian berbeda: ${page.page.key}`);
    }
    if (section.fields.length !== page.fields.length) {
      issues.push(`Jumlah pertanyaan berbeda pada bagian ${i}.`);
      return;
    }
    page.fields.forEach((p, j) => {
      const f = section.fields[j];
      const same =
        f.key === p.key &&
        f.type === p.type &&
        f.label === p.title &&
        f.helpText === p.help &&
        f.required === p.required &&
        JSON.stringify(p.type === "MC" ? p.choices : null) === JSON.stringify(f.options ?? null);
      if (!same) issues.push(`Pertanyaan berbeda: ${p.key}`);
    });
  });
  return issues;
}

export interface PreReviewReadiness {
  contentIssues: string[];
  readinessIssues: string[];
  ready: boolean;
}

export async function getReadiness(formId: string): Promise<PreReviewReadiness> {
  const prisma = await db();
  const form = await loadForm(prisma, formId);
  if (!form) throw new FormStateError("NOT_FOUND", "Form tidak ditemukan.");
  const contentIssues = verifyContent(form);
  const readinessIssues = isPreReviewSettings(form.settings) ? productionReadiness(parseSnapshot(form.settings).config) : [];
  return { contentIssues, readinessIssues, ready: contentIssues.length === 0 && readinessIssues.length === 0 };
}

export async function listPreReviewForms() {
  const prisma = await db();
  const forms = await prisma.form.findMany({
    orderBy: { createdAt: "desc" },
    include: { responses: { select: { completed: true, respondentRef: true, answers: true } } },
  });
  return forms
    .filter((f) => isPreReviewSettings(f.settings))
    .map((f) => {
      const snapshot = parseSnapshot(f.settings as never);
      const submitted = f.responses.filter((r) => r.completed && r.respondentRef);
      return {
        id: f.id,
        slug: f.slug,
        title: f.title,
        status: f.status,
        versionLabel: f.versionLabel,
        sourceSha256: f.sourceSha256,
        signature: snapshot.signature,
        sourceFile: snapshot.source.questions.file,
        testEvidence: snapshot.config.TEST_EVIDENCE_NOTE,
        openedAt: f.openedAt?.toISOString() ?? null,
        closedAt: f.closedAt?.toISOString() ?? null,
        codes: snapshot.data.experts.map((code) => {
          const r = f.responses.find((x) => x.respondentRef === code);
          return { code, state: r ? (r.completed ? "SUBMITTED" : "DRAFT") : "NONE" } as const;
        }),
        submitted: submitted.length,
        declined: f.responses.filter((r) => !r.respondentRef).length,
      };
    });
}

/** Only an Admin opens a form, and only when content and readiness both pass. */
export async function setFormOpen(actorId: string, formId: string, open: boolean) {
  const prisma = await db();
  await prisma.$transaction(async (tx) => {
    const form = await loadForm(tx, formId);
    if (!form) throw new FormStateError("NOT_FOUND", "Form tidak ditemukan.");
    if (open) {
      const issues = [...verifyContent(form), ...(isPreReviewSettings(form.settings) ? productionReadiness(parseSnapshot(form.settings).config) : [])];
      if (issues.length > 0) throw new FormStateError("NOT_READY", issues.join("\n"));
    }
    await tx.form.update({
      where: { id: formId },
      data: open ? { status: "ACTIVE", openedAt: new Date(), closedAt: null } : { status: "CLOSED", closedAt: new Date() },
    });
    await tx.auditEvent.create({
      data: { actorId, actorKind: "USER", action: open ? "FORM_OPEN" : "FORM_CLOSE", targetType: "Form", targetId: formId, payload: { slug: form.slug } },
    });
  });
}

// ── Runner ────────────────────────────────────────────────────────────

export async function getRunnerForm(slug: string) {
  const prisma = await db();
  const form = await prisma.form.findUnique({ where: { slug } });
  if (!form || !isPreReviewSettings(form.settings)) return null;
  // Hash check on every load: a form whose stored text drifted is not served.
  if (verifySnapshot(form.settings, form.sourceSha256).length > 0) return null;
  return { id: form.id, slug: form.slug, status: form.status, snapshot: parseSnapshot(form.settings) };
}

export async function getResponseForCode(formId: string, code: string) {
  const prisma = await db();
  return prisma.formResponse.findUnique({ where: { formId_respondentRef: { formId, respondentRef: code } } });
}

async function assertActive(tx: Tx, formId: string) {
  const form = await tx.form.findUnique({ where: { id: formId }, select: { status: true } });
  if (!form) throw new FormStateError("NOT_FOUND", "Form tidak ditemukan.");
  if (form.status !== "ACTIVE") throw new FormStateError("NOT_ACTIVE", "Form tidak sedang menerima respons.");
}

function metaOf(value: Prisma.JsonValue | null | undefined): Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value) ? (value as Record<string, unknown>) : {};
}

// Human expert input is REAL from the first write (docs/07 P3); there is no
// path that converts it, and SIMULATED rows never enter this table via here.
export async function saveDraft(formId: string, code: string, answers: Answers, pageIndex: number) {
  const prisma = await db();
  return prisma.$transaction(async (tx) => {
    await assertActive(tx, formId);
    const existing = await tx.formResponse.findUnique({ where: { formId_respondentRef: { formId, respondentRef: code } } });
    if (existing?.completed) throw new FormStateError("ALREADY_SUBMITTED", "Respons sudah dikirim.");
    const meta = { ...metaOf(existing?.meta), startedAt: metaOf(existing?.meta).startedAt ?? new Date().toISOString(), pageIndex };
    const saved = await tx.formResponse.upsert({
      where: { formId_respondentRef: { formId, respondentRef: code } },
      create: { formId, respondentRef: code, dataOrigin: "REAL", answers, meta },
      update: { answers, meta },
    });
    return saved.updatedAt.toISOString();
  });
}

export async function submitResponse(formId: string, code: string, userId: string, answers: Answers, signature: string) {
  const prisma = await db();
  await prisma.$transaction(async (tx) => {
    await assertActive(tx, formId);
    const existing = await tx.formResponse.findUnique({ where: { formId_respondentRef: { formId, respondentRef: code } } });
    if (existing?.completed) throw new FormStateError("ALREADY_SUBMITTED", "Respons sudah dikirim.");
    const now = new Date();
    const prior = metaOf(existing?.meta);
    const startedAt = typeof prior.startedAt === "string" ? prior.startedAt : now.toISOString();
    const meta = {
      startedAt,
      submittedAt: now.toISOString(),
      // Fill time is measured, not estimated (R1–V2.1.2B description).
      durationMs: now.getTime() - new Date(startedAt).getTime(),
      signature,
    };
    const saved = await tx.formResponse.upsert({
      where: { formId_respondentRef: { formId, respondentRef: code } },
      create: { formId, respondentRef: code, dataOrigin: "REAL", answers, meta, completed: true, submittedAt: now },
      update: { answers, meta, completed: true, submittedAt: now },
    });
    await tx.auditEvent.create({
      data: { actorId: userId, actorKind: "USER", action: "FORM_SUBMIT", targetType: "FormResponse", targetId: saved.id, payload: { formId, code } },
    });
  });
}

/**
 * "Tidak bersedia": only the choice and time are kept, as the consent text
 * promises. Any draft is removed and the record carries no code or account.
 */
export async function declineConsent(formId: string, code: string) {
  const prisma = await db();
  await prisma.$transaction(async (tx) => {
    await assertActive(tx, formId);
    const existing = await tx.formResponse.findUnique({ where: { formId_respondentRef: { formId, respondentRef: code } } });
    if (existing?.completed) throw new FormStateError("ALREADY_SUBMITTED", "Respons sudah dikirim.");
    if (existing) await tx.formResponse.delete({ where: { id: existing.id } });
    const saved = await tx.formResponse.create({
      data: { formId, respondentRef: null, dataOrigin: "REAL", answers: { consent: CONSENT_NO }, completed: true, submittedAt: new Date() },
    });
    await tx.auditEvent.create({
      data: { actorKind: "RESPONDENT", action: "FORM_CONSENT_DECLINED", targetType: "FormResponse", targetId: saved.id, payload: { formId } },
    });
  });
}

export async function listFormsForCode(code: string) {
  const prisma = await db();
  const forms = await prisma.form.findMany({
    where: { status: "ACTIVE" },
    include: { responses: { where: { respondentRef: code }, select: { completed: true, submittedAt: true } } },
  });
  return forms
    .filter((f) => isPreReviewSettings(f.settings) && parseSnapshot(f.settings).data.experts.includes(code))
    .map((f) => ({
      slug: f.slug,
      title: f.title,
      state: f.responses[0] ? (f.responses[0].completed ? "SUBMITTED" : "DRAFT") : "NONE",
      submittedAt: f.responses[0]?.submittedAt?.toISOString() ?? null,
    }));
}

/** Submitted records in the shape normalize_() expects. */
export async function getExportRecords(formId: string): Promise<{ snapshot: PreReviewSnapshot; records: ResponseRecord[] }> {
  const prisma = await db();
  const form = await prisma.form.findUnique({ where: { id: formId }, include: { responses: { where: { completed: true } } } });
  if (!form || !isPreReviewSettings(form.settings)) throw new FormStateError("NOT_FOUND", "Form tidak ditemukan.");
  assertSingleOrigin(form.responses);
  return {
    snapshot: parseSnapshot(form.settings),
    records: form.responses
      .slice()
      .sort((a, b) => (a.submittedAt?.getTime() ?? 0) - (b.submittedAt?.getTime() ?? 0))
      .map((r) => ({ id: r.id, timestamp: r.submittedAt?.toISOString() ?? "", values: r.answers as Answers })),
  };
}

export async function listKnownExpertCodes(): Promise<string[]> {
  const prisma = await db();
  const forms = await prisma.form.findMany({ select: { settings: true } });
  const codes = new Set<string>();
  for (const f of forms) if (isPreReviewSettings(f.settings)) parseSnapshot(f.settings).data.experts.forEach((c) => codes.add(c));
  return [...codes].sort();
}
