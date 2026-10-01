import { createHash } from "node:crypto";

import JSZip from "jszip";

import type { Prisma } from "@/generated/prisma/client";
import { withCallSink } from "@/lib/ai/call";
import { narrateChapter } from "@/lib/ai/report";
import { blocksToDocx, renderReportDocx } from "@/lib/export/report-docx";
import { blocksToPdf, renderReport } from "@/lib/export/report-pdf";
import { buildReportBlocks, splitReportBlocks, type ReportPart } from "@/lib/report/blocks";
import { REPORT_CHAPTERS, REPORT_MODEL_ID, type ChapterKey, type ChapterState } from "@/lib/report/chapters";
import { factsText } from "@/lib/report/facts";

import { db } from "../client";
import { createCallSink } from "./model-calls";
import { loadReportData } from "./report-data";

export class ReportError extends Error {
  constructor(readonly code: "NOT_FOUND" | "STATE" | "INVALID", message: string) {
    super(message);
    this.name = "ReportError";
  }
}

const chaptersOf = (j: { chapters: unknown }) => j.chapters as unknown as ChapterState[];

export async function createReportJob(actorId: string, versionId: string, budgetUsd: number | null) {
  const prisma = await db();
  const chapters: ChapterState[] = REPORT_CHAPTERS.map((c) => ({ key: c.key, title: c.title, status: "PENDING", narrative: null, generatedAt: null, edited: false, approvedById: null, approvedAt: null, error: null }));
  const job = await prisma.reportJob.create({ data: { versionId, modelId: REPORT_MODEL_ID, status: "NARRATING", chapters: chapters as unknown as Prisma.InputJsonValue, budgetUsd, createdById: actorId } });
  await prisma.auditEvent.create({ data: { actorId, actorKind: "USER", action: "REPORT_CREATE", targetType: "ReportJob", targetId: job.id, payload: { model: REPORT_MODEL_ID } } });
  return job.id;
}

async function save(jobId: string, chapters: ChapterState[], status?: string) {
  const prisma = await db();
  await prisma.reportJob.update({ where: { id: jobId }, data: { chapters: chapters as unknown as Prisma.InputJsonValue, ...(status ? { status } : {}) } });
}

/** Narrates the next PENDING chapter with the report model; one call per step. */
export async function advanceReportJob(jobId: string): Promise<{ kind: "NARRATED"; key: ChapterKey } | { kind: "REVIEW" } | { kind: "FAILED"; key: ChapterKey; error: string }> {
  const prisma = await db();
  const job = await prisma.reportJob.findUnique({ where: { id: jobId } });
  if (!job) throw new ReportError("NOT_FOUND", "Laporan tidak ditemukan.");
  const chapters = chaptersOf(job);
  const next = chapters.find((c) => c.status === "PENDING");
  if (!next) {
    if (job.status === "NARRATING") await save(jobId, chapters, "REVIEW");
    return { kind: "REVIEW" };
  }
  const data = await loadReportData(job.versionId);
  const sink = await createCallSink({ kind: "REPORT", refType: "ReportJob", refId: jobId, versionId: job.versionId, budgetUsd: job.budgetUsd === null ? null : Number(job.budgetUsd) });
  try {
    const r = await withCallSink(sink, () => narrateChapter(job.modelId, next.title, factsText(data, next.key)));
    Object.assign(next, { status: "DRAFT", narrative: r.text, generatedAt: new Date().toISOString(), edited: false, error: null, approvedById: null, approvedAt: null });
    await save(jobId, chapters, "NARRATING");
    return { kind: "NARRATED", key: next.key };
  } catch (error) {
    next.error = error instanceof Error ? error.message : String(error);
    await save(jobId, chapters);
    return { kind: "FAILED", key: next.key, error: next.error };
  }
}

async function mutate(actorId: string, jobId: string, key: ChapterKey, action: string, fn: (c: ChapterState) => void) {
  const prisma = await db();
  const job = await prisma.reportJob.findUnique({ where: { id: jobId } });
  if (!job) throw new ReportError("NOT_FOUND", "Laporan tidak ditemukan.");
  if (job.status === "BUILDING") throw new ReportError("STATE", "Laporan sedang dibuat.");
  const chapters = chaptersOf(job);
  const c = chapters.find((x) => x.key === key);
  if (!c) throw new ReportError("NOT_FOUND", "Bab tidak ditemukan.");
  fn(c);
  const anyPending = chapters.some((x) => x.status === "PENDING");
  // Any change after a PDF was built reopens the review; the old PDF is dropped.
  await prisma.reportJob.update({
    where: { id: jobId },
    data: { chapters: chapters as unknown as Prisma.InputJsonValue, status: anyPending ? "NARRATING" : "REVIEW", ...(job.status === "COMPLETED" ? { pdf: null, pdfSha256: null, pages: null, completedAt: null } : {}) },
  });
  await prisma.auditEvent.create({ data: { actorId, actorKind: "USER", action, targetType: "ReportJob", targetId: jobId, payload: { chapter: key } } });
}

export const editChapter = (actorId: string, jobId: string, key: ChapterKey, narrative: string) =>
  mutate(actorId, jobId, key, "REPORT_CHAPTER_EDIT", (c) => {
    if (!c.narrative) throw new ReportError("STATE", "Bab belum dinarasikan.");
    Object.assign(c, { narrative, edited: true, status: "DRAFT", approvedById: null, approvedAt: null });
  });

export const approveChapter = (actorId: string, jobId: string, key: ChapterKey) =>
  mutate(actorId, jobId, key, "REPORT_CHAPTER_APPROVE", (c) => {
    if (!c.narrative?.trim()) throw new ReportError("STATE", "Narasi kosong tidak dapat disetujui.");
    Object.assign(c, { status: "APPROVED", approvedById: actorId, approvedAt: new Date().toISOString() });
  });

export const regenerateChapter = (actorId: string, jobId: string, key: ChapterKey) =>
  mutate(actorId, jobId, key, "REPORT_CHAPTER_REGENERATE", (c) => Object.assign(c, { status: "PENDING", error: null, approvedById: null, approvedAt: null }));

/** Builds the PDF once every chapter is approved; the file is stored with its SHA-256. */
export async function buildReportPdf(actorId: string, jobId: string) {
  const prisma = await db();
  const job = await prisma.reportJob.findUnique({ where: { id: jobId } });
  if (!job) throw new ReportError("NOT_FOUND", "Laporan tidak ditemukan.");
  const chapters = chaptersOf(job);
  const open = chapters.filter((c) => c.status !== "APPROVED");
  if (open.length) throw new ReportError("STATE", `Bab belum disetujui: ${open.map((c) => c.title).join(", ")}`);
  await prisma.reportJob.update({ where: { id: jobId }, data: { status: "BUILDING", error: null } });
  try {
    const [data, actor, approvers] = await Promise.all([
      loadReportData(job.versionId),
      prisma.user.findUnique({ where: { id: actorId }, select: { name: true, email: true } }),
      prisma.user.findMany({ where: { id: { in: chapters.map((c) => c.approvedById).filter((x): x is string => !!x) } }, select: { id: true, name: true, email: true } }),
    ]);
    const pdf = await renderReport(data, chapters, { generatedAt: new Date(), generatedBy: actor?.name ?? actor?.email ?? "peneliti", modelId: job.modelId, users: new Map(approvers.map((u) => [u.id, u.name ?? u.email ?? u.id])) });
    const sha = createHash("sha256").update(pdf.bytes).digest("hex");
    await prisma.$transaction([
      prisma.reportJob.update({ where: { id: jobId }, data: { status: "COMPLETED", pdf: Buffer.from(pdf.bytes), pdfSha256: sha, pages: pdf.pages, completedAt: new Date() } }),
      prisma.auditEvent.create({ data: { actorId, actorKind: "USER", action: "REPORT_BUILD", targetType: "ReportJob", targetId: jobId, payload: { pages: pdf.pages, sha256: sha, bytes: pdf.bytes.length } } }),
    ]);
    return { pages: pdf.pages, sha256: sha };
  } catch (error) {
    await prisma.reportJob.update({ where: { id: jobId }, data: { status: "REVIEW", error: error instanceof Error ? error.message : String(error) } });
    throw error;
  }
}

/**
 * Word version, built on demand from the approved chapters (no model call).
 * No watermark or SIM_ prefix at the researcher's request (CHANGELOG-METHOD 2026-09-29).
 */
export async function buildReportDocx(actorId: string, jobId: string, opts: { withIdentities?: boolean } = {}) {
  const prisma = await db();
  const job = await prisma.reportJob.findUnique({ where: { id: jobId } });
  if (!job) throw new ReportError("NOT_FOUND", "Laporan tidak ditemukan.");
  const chapters = chaptersOf(job);
  const open = chapters.filter((c) => c.status !== "APPROVED");
  if (open.length) throw new ReportError("STATE", `Bab belum disetujui: ${open.map((c) => c.title).join(", ")}`);
  const [data, actor, approvers, version] = await Promise.all([
    loadReportData(job.versionId),
    prisma.user.findUnique({ where: { id: actorId }, select: { name: true, email: true } }),
    prisma.user.findMany({ where: { id: { in: chapters.map((c) => c.approvedById).filter((x): x is string => !!x) } }, select: { id: true, name: true, email: true } }),
    prisma.artifactVersion.findUniqueOrThrow({ where: { id: job.versionId }, select: { label: true } }),
  ]);
  // Panelist names only for an Admin request (docs/07 P6); the table states the content is model output.
  const identities = opts.withIdentities
    ? new Map((await prisma.panelistIdentity.findMany({ select: { panelCode: true, fullName: true } })).map((i) => [i.panelCode, { fullName: i.fullName, field: "" }]))
    : undefined;
  const bytes = await renderReportDocx(data, chapters, { generatedAt: new Date(), generatedBy: actor?.name ?? actor?.email ?? "peneliti", modelId: job.modelId, users: new Map(approvers.map((u) => [u.id, u.name ?? u.email ?? u.id])), identities });
  const sha256 = createHash("sha256").update(bytes).digest("hex");
  const filename = `Laporan_G1-G7_${version.label.replace(/[^A-Za-z0-9._-]+/g, "_")}.docx`;
  await prisma.auditEvent.create({ data: { actorId, actorKind: "USER", action: "EXPORT_REPORT_DOCX", targetType: "ReportJob", targetId: jobId, payload: { filename, sha256, bytes: bytes.length, watermark: false, identities: !!identities } } });
  return { bytes, sha256, filename };
}

/** Approved chapters, report data, and meta for the per-part documents (no model call). */
async function partsContext(actorId: string, jobId: string, opts: { withIdentities?: boolean }) {
  const prisma = await db();
  const job = await prisma.reportJob.findUnique({ where: { id: jobId } });
  if (!job) throw new ReportError("NOT_FOUND", "Laporan tidak ditemukan.");
  const chapters = chaptersOf(job);
  const open = chapters.filter((c) => c.status !== "APPROVED");
  if (open.length) throw new ReportError("STATE", `Bab belum disetujui: ${open.map((c) => c.title).join(", ")}`);
  const [data, actor, approvers, version] = await Promise.all([
    loadReportData(job.versionId),
    prisma.user.findUnique({ where: { id: actorId }, select: { name: true, email: true } }),
    prisma.user.findMany({ where: { id: { in: chapters.map((c) => c.approvedById).filter((x): x is string => !!x) } }, select: { id: true, name: true, email: true } }),
    prisma.artifactVersion.findUniqueOrThrow({ where: { id: job.versionId }, select: { label: true } }),
  ]);
  const identities = opts.withIdentities
    ? new Map((await prisma.panelistIdentity.findMany({ select: { panelCode: true, fullName: true } })).map((i) => [i.panelCode, { fullName: i.fullName, field: "" }]))
    : undefined;
  const generatedAt = new Date();
  const meta = { generatedAt, generatedBy: actor?.name ?? actor?.email ?? "peneliti", modelId: job.modelId, users: new Map(approvers.map((u) => [u.id, u.name ?? u.email ?? u.id])) };
  // Panelist names go into the Word files only (PDF parts keep codes, as the stored PDF does).
  const pdfParts = splitReportBlocks(buildReportBlocks(data, chapters, meta));
  const docxParts = identities ? splitReportBlocks(buildReportBlocks(data, chapters, { ...meta, identities })) : pdfParts;
  const label = version.label.replace(/[^A-Za-z0-9._-]+/g, "_");
  const stamp = generatedAt.toISOString().replace("T", " ").slice(0, 16);
  return { pdfParts, docxParts, label, stamp, versionLabel: version.label, identities: !!identities };
}

const partTitle = (p: ReportPart, versionLabel: string) => `Laporan G1–G7 ${versionLabel} — Bagian ${p.index + 1}: ${p.title}`;

async function renderPart(p: ReportPart, format: "pdf" | "docx", versionLabel: string, stamp: string) {
  if (format === "docx") return blocksToDocx(p.blocks, partTitle(p, versionLabel));
  return (await blocksToPdf(p.blocks, partTitle(p, versionLabel), `${versionLabel} · bagian ${p.index + 1} · ${stamp}`)).bytes;
}

/** One chapter of the report as Word or PDF (researcher request 1 Oct 2026). */
export async function buildReportPart(actorId: string, jobId: string, key: ChapterKey, format: "pdf" | "docx", opts: { withIdentities?: boolean } = {}) {
  const ctx = await partsContext(actorId, jobId, opts);
  const part = (format === "docx" ? ctx.docxParts : ctx.pdfParts).find((p) => p.key === key);
  if (!part) throw new ReportError("NOT_FOUND", "Bagian laporan tidak ditemukan.");
  const bytes = await renderPart(part, format, ctx.versionLabel, ctx.stamp);
  const filename = `Laporan_${ctx.label}_${part.slug}.${format}`;
  const prisma = await db();
  await prisma.auditEvent.create({ data: { actorId, actorKind: "USER", action: "EXPORT_REPORT_PART", targetType: "ReportJob", targetId: jobId, payload: { part: key, format, filename, bytes: bytes.length, watermark: false, identities: format === "docx" && ctx.identities } } });
  return { bytes, filename };
}

/** Every chapter in both formats, zipped. */
export async function buildReportPartsZip(actorId: string, jobId: string, opts: { withIdentities?: boolean } = {}) {
  const ctx = await partsContext(actorId, jobId, opts);
  const zip = new JSZip();
  for (const p of ctx.pdfParts) zip.file(`pdf/Laporan_${ctx.label}_${p.slug}.pdf`, await renderPart(p, "pdf", ctx.versionLabel, ctx.stamp));
  for (const p of ctx.docxParts) zip.file(`word/Laporan_${ctx.label}_${p.slug}.docx`, await renderPart(p, "docx", ctx.versionLabel, ctx.stamp));
  const bytes = await zip.generateAsync({ type: "uint8array", compression: "DEFLATE" });
  const filename = `Laporan_${ctx.label}_per-bagian.zip`;
  const prisma = await db();
  await prisma.auditEvent.create({ data: { actorId, actorKind: "USER", action: "EXPORT_REPORT_PARTS", targetType: "ReportJob", targetId: jobId, payload: { filename, parts: ctx.pdfParts.length, bytes: bytes.length, watermark: false, identities: ctx.identities } } });
  return { bytes, filename };
}

export async function getReportJob(jobId: string) {
  const prisma = await db();
  const job = await prisma.reportJob.findUnique({ where: { id: jobId }, select: { id: true, versionId: true, status: true, modelId: true, chapters: true, pdfSha256: true, pages: true, error: true, createdAt: true, completedAt: true } });
  if (!job) return null;
  const version = await prisma.artifactVersion.findUnique({ where: { id: job.versionId }, select: { label: true } });
  return { ...job, chapters: chaptersOf(job), versionLabel: version?.label ?? "" };
}

export async function listReportJobs(versionId: string) {
  const prisma = await db();
  return prisma.reportJob.findMany({ where: { versionId }, orderBy: { createdAt: "desc" }, select: { id: true, status: true, pages: true, createdAt: true, completedAt: true } });
}
