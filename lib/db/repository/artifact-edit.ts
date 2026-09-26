import type { Prisma } from "@/generated/prisma/client";
import { checkRubric } from "@/lib/artifact/rubric-check";
import { METHOD } from "@/lib/method/constants";

import { db } from "../client";
import { recordEvaluation } from "./gates";

type Tx = Prisma.TransactionClient;

export class EditError extends Error {
  constructor(
    readonly code: "NOT_EDITABLE" | "CONTROLLED_EXCEPTION" | "CONFLICT" | "INVALID" | "NOT_FOUND",
    message: string,
    readonly details?: unknown,
  ) {
    super(message);
    this.name = "EditError";
  }
}

export interface EditMeta {
  reason: string;
  /** FGD suggestion this edit implements; marks the revision task done. */
  suggestionId?: string | null;
  /** Required for C20b/C42 (R1-V1.7 CH-08): the explicit version decision. */
  exceptionDecision?: string | null;
}

const clip = (s: string | null | undefined, n = 400) => (s ? (s.length > n ? `${s.slice(0, n)}…` : s) : "∅");

/** Only DRAFT derived versions are editable (researcher decision 2026-09-26); A1.0 stays frozen. */
async function assertEditable(tx: Tx, versionId: string) {
  const v = await tx.artifactVersion.findUniqueOrThrow({ where: { id: versionId }, select: { status: true, label: true } });
  if (v.status !== "DRAFT") throw new EditError("NOT_EDITABLE", `${v.label} berstatus ${v.status}; hanya versi DRAF turunan yang dapat disunting.`);
  // docs/05 §6 G3: ratings refer to the content as rated; edit between rounds only.
  const open = await tx.delphiRound.findFirst({ where: { versionId, finalizedAt: null }, select: { roundNumber: true } });
  if (open) throw new EditError("NOT_EDITABLE", `Ronde Delphi R${open.roundNumber} belum difinalisasi; suntingan dibuka lagi setelah ronde final.`);
  return v;
}

async function loadIndicator(tx: Tx, indicatorId: string) {
  const ind = await tx.indicator.findUnique({
    where: { id: indicatorId },
    include: { aspect: { include: { domain: true } }, rubricLevels: { orderBy: { level: "asc" } }, evidence: true },
  });
  if (!ind) throw new EditError("NOT_FOUND", "Indikator tidak ditemukan.");
  await assertEditable(tx, ind.aspect.domain.versionId);
  return ind;
}

function guardException(ind: { code: string; isControlledException: boolean }, meta: EditMeta) {
  if ((ind.isControlledException || METHOD.CONTROLLED_EXCEPTIONS.includes(ind.code)) && (meta.exceptionDecision ?? "").trim().length < 10) {
    throw new EditError("CONTROLLED_EXCEPTION", `${ind.code} adalah controlled exception (CH-08): tulis keputusan versi eksplisit (min. 10 karakter).`);
  }
}

async function log(
  tx: Tx,
  actorId: string,
  versionId: string,
  entry: { targetType: string; targetCode: string; action: "TAMBAH" | "HAPUS" | "PINDAH" | "RUMUS_ULANG"; impactNote: string },
  meta: EditMeta,
) {
  const source = meta.suggestionId ? `Usulan FGD ${meta.suggestionId}` : "Suntingan peneliti";
  await tx.changeLogEntry.create({
    data: {
      versionId,
      actorId,
      targetType: entry.targetType,
      targetCode: entry.targetCode,
      action: entry.action,
      reason: meta.reason,
      decisionSource: meta.exceptionDecision ? `${source}; keputusan versi CH-08: ${meta.exceptionDecision}` : source,
      impactNote: entry.impactNote,
    },
  });
  if (meta.suggestionId) {
    await tx.fgdSuggestion.update({ where: { id: meta.suggestionId }, data: { appliedAt: new Date(), appliedById: actorId, appliedNote: meta.reason } });
  }
}

async function run<T>(versionOf: (tx: Tx) => Promise<string>, body: (tx: Tx, versionId: string) => Promise<T>): Promise<T> {
  const prisma = await db();
  let versionId = "";
  const result = await prisma.$transaction(async (tx) => {
    versionId = await versionOf(tx);
    return body(tx, versionId);
  });
  // Completeness may have changed; G1 is re-evaluated, never passed automatically.
  await recordEvaluation(versionId, "G1_BASELINE", "Evaluasi otomatis setelah suntingan artefak.");
  return result;
}

const REASON_MIN = 5;
function requireReason(meta: EditMeta) {
  if (meta.reason.trim().length < REASON_MIN) throw new EditError("INVALID", "Alasan perubahan wajib diisi.");
}

export async function updateIndicatorContent(
  actorId: string,
  input: { indicatorId: string; name: string; operationalDefinition: string | null; assessmentObject: string | null; boundaryNote: string | null; sources: string[] },
  meta: EditMeta,
) {
  requireReason(meta);
  let code = "";
  await run(
    async (tx) => {
      const ind = await loadIndicator(tx, input.indicatorId);
      code = ind.code;
      return ind.aspect.domain.versionId;
    },
    async (tx, versionId) => {
      const ind = await loadIndicator(tx, input.indicatorId);
      guardException(ind, meta);
      const fields = ["name", "operationalDefinition", "assessmentObject", "boundaryNote"] as const;
      const changed = fields.filter((f) => (ind[f] ?? "") !== (input[f] ?? ""));
      const sourcesChanged = ind.sources.join("\n") !== input.sources.join("\n");
      if (changed.length === 0 && !sourcesChanged) return;
      await tx.indicator.update({ where: { id: ind.id }, data: { name: input.name, operationalDefinition: input.operationalDefinition, assessmentObject: input.assessmentObject, boundaryNote: input.boundaryNote, sources: input.sources } });
      await log(
        tx,
        actorId,
        versionId,
        {
          targetType: "Indicator",
          targetCode: code,
          action: "RUMUS_ULANG",
          impactNote: [...changed.map((f) => `${f}: ${clip(ind[f])}`), ...(sourcesChanged ? [`sources: ${ind.sources.join("; ") || "∅"}`] : [])].join(" | "),
        },
        meta,
      );
    },
  );
}

export async function saveRubric(actorId: string, input: { indicatorId: string; levels: { level: number; label: string; descriptor: string }[] }, meta: EditMeta) {
  requireReason(meta);
  await run(
    async (tx) => (await loadIndicator(tx, input.indicatorId)).aspect.domain.versionId,
    async (tx, versionId) => {
      const ind = await loadIndicator(tx, input.indicatorId);
      guardException(ind, meta);
      const blocking = checkRubric(input.levels, ind.evidence).filter((i) => i.blocking);
      if (blocking.length) throw new EditError("INVALID", "Rubrik belum memenuhi pemeriksaan.", blocking);
      for (const l of input.levels) {
        await tx.rubricLevel.upsert({
          where: { indicatorId_level: { indicatorId: ind.id, level: l.level } },
          create: { indicatorId: ind.id, level: l.level, label: l.label, descriptor: l.descriptor },
          update: { label: l.label, descriptor: l.descriptor },
        });
      }
      await log(
        tx,
        actorId,
        versionId,
        { targetType: "RubricLevel", targetCode: ind.code, action: "RUMUS_ULANG", impactNote: ind.rubricLevels.map((l) => `${l.level}. ${clip(l.descriptor, 200)}`).join(" | ") || "∅" },
        meta,
      );
    },
  );
}

type EvidenceData = { kind: "NORMATIF" | "IMPLEMENTASI" | "OPERASIONAL" | "HASIL" | "PERBAIKAN"; minimumFor: number | null; mandatory: boolean; description: string };

export async function saveEvidence(actorId: string, input: { indicatorId: string; evidenceId: string | null; data: EvidenceData | null }, meta: EditMeta) {
  requireReason(meta);
  await run(
    async (tx) => (await loadIndicator(tx, input.indicatorId)).aspect.domain.versionId,
    async (tx, versionId) => {
      const ind = await loadIndicator(tx, input.indicatorId);
      guardException(ind, meta);
      const prior = input.evidenceId ? ind.evidence.find((e) => e.id === input.evidenceId) : null;
      if (input.evidenceId && !prior) throw new EditError("NOT_FOUND", "Persyaratan bukti tidak ditemukan.");
      const describe = (e: { kind: string; minimumFor: number | null; mandatory: boolean; description: string }) =>
        `[${e.kind}, L${e.minimumFor ?? "-"}, ${e.mandatory ? "wajib" : "penguat"}] ${clip(e.description, 200)}`;
      if (!input.data) {
        await tx.evidenceRequirement.delete({ where: { id: prior!.id } });
        await log(tx, actorId, versionId, { targetType: "EvidenceRequirement", targetCode: ind.code, action: "HAPUS", impactNote: describe(prior!) }, meta);
      } else if (prior) {
        await tx.evidenceRequirement.update({ where: { id: prior.id }, data: input.data });
        await log(tx, actorId, versionId, { targetType: "EvidenceRequirement", targetCode: ind.code, action: "RUMUS_ULANG", impactNote: describe(prior) }, meta);
      } else {
        await tx.evidenceRequirement.create({ data: { indicatorId: ind.id, ...input.data } });
        await log(tx, actorId, versionId, { targetType: "EvidenceRequirement", targetCode: ind.code, action: "TAMBAH", impactNote: describe(input.data) }, meta);
      }
    },
  );
}

const CODE_PATTERN = /^C\d{2,3}[a-z]?$/;

export async function addIndicator(actorId: string, input: { aspectId: string; code: string; name: string; operationalDefinition: string | null }, meta: EditMeta) {
  requireReason(meta);
  if (!CODE_PATTERN.test(input.code)) throw new EditError("INVALID", "Kode indikator berformat C + 2–3 digit (+ huruf kecil opsional), mis. C44.");
  // CH-08: the controlled exception codes are never reissued to another indicator.
  if (METHOD.CONTROLLED_EXCEPTIONS.includes(input.code)) throw new EditError("CONTROLLED_EXCEPTION", `${input.code} adalah kode controlled exception dan tidak boleh dipakai ulang.`);
  return run(
    async (tx) => {
      const aspect = await tx.aspect.findUniqueOrThrow({ where: { id: input.aspectId }, include: { domain: true } });
      await assertEditable(tx, aspect.domain.versionId);
      return aspect.domain.versionId;
    },
    async (tx, versionId) => {
      const clash = await tx.indicator.findFirst({ where: { code: input.code, aspect: { domain: { versionId } } } });
      if (clash) throw new EditError("CONFLICT", `Kode ${input.code} sudah ada di versi ini${clash.deletedAt ? " (terhapus; pulihkan saja)" : ""}.`);
      const aspect = await tx.aspect.findUniqueOrThrow({ where: { id: input.aspectId }, include: { domain: true, indicators: { select: { order: true } } } });
      const created = await tx.indicator.create({
        data: { aspectId: aspect.id, code: input.code, name: input.name, operationalDefinition: input.operationalDefinition, order: Math.max(0, ...aspect.indicators.map((i) => i.order)) + 1 },
      });
      await log(tx, actorId, versionId, { targetType: "Indicator", targetCode: input.code, action: "TAMBAH", impactNote: `Ditambahkan ke ${aspect.domain.code}/${aspect.code}.` }, meta);
      return created.id;
    },
  );
}

export async function setIndicatorDeleted(actorId: string, input: { indicatorId: string; deleted: boolean }, meta: EditMeta) {
  requireReason(meta);
  await run(
    async (tx) => (await loadIndicator(tx, input.indicatorId)).aspect.domain.versionId,
    async (tx, versionId) => {
      const ind = await loadIndicator(tx, input.indicatorId);
      guardException(ind, meta);
      if (Boolean(ind.deletedAt) === input.deleted) return;
      // Versioned delete = soft delete + ChangeLogEntry (docs/06 §3); nothing is erased.
      await tx.indicator.update({ where: { id: ind.id }, data: { deletedAt: input.deleted ? new Date() : null } });
      await log(
        tx,
        actorId,
        versionId,
        { targetType: "Indicator", targetCode: ind.code, action: input.deleted ? "HAPUS" : "TAMBAH", impactNote: input.deleted ? `Dihapus (soft delete) dari ${ind.aspect.domain.code}/${ind.aspect.code}.` : "Dipulihkan dari soft delete." },
        meta,
      );
    },
  );
}

export async function moveIndicator(actorId: string, input: { indicatorId: string; targetAspectId: string }, meta: EditMeta) {
  requireReason(meta);
  await run(
    async (tx) => (await loadIndicator(tx, input.indicatorId)).aspect.domain.versionId,
    async (tx, versionId) => {
      const ind = await loadIndicator(tx, input.indicatorId);
      guardException(ind, meta);
      const target = await tx.aspect.findUniqueOrThrow({ where: { id: input.targetAspectId }, include: { domain: true, indicators: { select: { order: true, code: true } } } });
      if (target.domain.versionId !== versionId) throw new EditError("INVALID", "Aspek tujuan harus di versi yang sama.");
      if (target.id === ind.aspectId) return;
      if (target.indicators.some((i) => i.code === ind.code)) throw new EditError("CONFLICT", `Aspek tujuan sudah memuat ${ind.code}.`);
      await tx.indicator.update({ where: { id: ind.id }, data: { aspectId: target.id, order: Math.max(0, ...target.indicators.map((i) => i.order)) + 1 } });
      await log(
        tx,
        actorId,
        versionId,
        { targetType: "Indicator", targetCode: ind.code, action: "PINDAH", impactNote: `${ind.aspect.domain.code}/${ind.aspect.code} → ${target.domain.code}/${target.code}` },
        meta,
      );
    },
  );
}

export async function updateGroup(
  actorId: string,
  input: { type: "Domain" | "Aspect"; id: string; name: string; rationale: string | null; sdgTags?: string[] },
  meta: EditMeta,
) {
  requireReason(meta);
  await run(
    async (tx) => {
      const versionId =
        input.type === "Domain"
          ? (await tx.domain.findUniqueOrThrow({ where: { id: input.id } })).versionId
          : (await tx.aspect.findUniqueOrThrow({ where: { id: input.id }, include: { domain: true } })).domain.versionId;
      await assertEditable(tx, versionId);
      return versionId;
    },
    async (tx, versionId) => {
      if (input.type === "Domain") {
        const d = await tx.domain.findUniqueOrThrow({ where: { id: input.id } });
        await tx.domain.update({ where: { id: d.id }, data: { name: input.name, rationale: input.rationale, ...(input.sdgTags ? { sdgTags: input.sdgTags } : {}) } });
        await log(tx, actorId, versionId, { targetType: "Domain", targetCode: d.code, action: "RUMUS_ULANG", impactNote: `name: ${clip(d.name)} | rationale: ${clip(d.rationale)} | sdg: ${d.sdgTags.join(",") || "∅"}` }, meta);
      } else {
        const a = await tx.aspect.findUniqueOrThrow({ where: { id: input.id } });
        await tx.aspect.update({ where: { id: a.id }, data: { name: input.name, rationale: input.rationale } });
        await log(tx, actorId, versionId, { targetType: "Aspect", targetCode: a.code, action: "RUMUS_ULANG", impactNote: `name: ${clip(a.name)} | rationale: ${clip(a.rationale)}` }, meta);
      }
    },
  );
}

/** Everything the indicator editor needs, including this code's change history. */
export async function getIndicatorEditor(indicatorId: string) {
  const prisma = await db();
  const ind = await prisma.indicator.findUnique({
    where: { id: indicatorId },
    include: { aspect: { include: { domain: { include: { version: true } } } }, rubricLevels: { orderBy: { level: "asc" } }, evidence: { orderBy: [{ minimumFor: "asc" }] } },
  });
  if (!ind) return null;
  const version = ind.aspect.domain.version;
  const [aspects, history] = await Promise.all([
    prisma.aspect.findMany({ where: { domain: { versionId: version.id } }, orderBy: [{ domain: { order: "asc" } }, { order: "asc" }], include: { domain: { select: { code: true } } } }),
    prisma.changeLogEntry.findMany({ where: { versionId: version.id, targetCode: ind.code }, orderBy: { createdAt: "desc" }, take: 50 }),
  ]);
  return { ind, version, aspects, history };
}
