import type { Prisma } from "@/generated/prisma/client";
import { buildDelphiForm, ratingFrom, type DelphiFormItem } from "@/lib/forms/delphi-form";
import { METHOD } from "@/lib/method/constants";
import { buildRoundFeedback } from "@/lib/method/cvi";
import type { Relevance } from "@/lib/method/types";

import { db } from "../client";
import { DelphiError, planNextRound, saveDelphiItem, type SeatRatingRow } from "./delphi-rounds";
import type { GenericSettings } from "./form-builder";
import { listPanelsForEditor } from "./panel-admin";

export interface RealRoundSettings {
  /** Panel code per seat: seatCodes[i] answers as seat i + 1, in every round. */
  seatCodes: string[];
  formId: string;
}

const slugify = (s: string) => s.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");

/**
 * Human Delphi round (SPECIFICATION §4.6, researcher decision 2026-09-26):
 * a REAL DelphiRound on a version with no simulated rounds, plus a generated
 * DELPHI form (HOLD) for exactly the panel codes of the eight seats.
 */
export async function createRealRound(input: { actorId: string; versionId: string; configId: string; seatCodes: string[] }) {
  const prisma = await db();
  const plan = await planNextRound(input.versionId, "REAL");
  if (plan.blocked.length) throw new DelphiError("GATE", "Ronde pakar belum dapat dibuat.", plan.blocked);
  const codes = input.seatCodes.map((c) => c.trim()).filter(Boolean);
  if (codes.length !== METHOD.DELPHI_PANEL_SIZE || new Set(codes).size !== codes.length) throw new DelphiError("INVALID", `Tepat ${METHOD.DELPHI_PANEL_SIZE} kode panel berbeda diperlukan (§3.8.1).`);
  const bound = new Set((await prisma.user.findMany({ where: { panelCode: { in: codes }, role: "PAKAR", active: true }, select: { panelCode: true } })).map((u) => u.panelCode));
  const unbound = codes.filter((c) => !bound.has(c));
  if (unbound.length) throw new DelphiError("INVALID", "Kode belum diikat ke akun Pakar aktif.", unbound.map((c) => `RESPONDENT_NOT_BOUND: ${c}`));
  if (plan.roundNumber > 1) {
    const prev = await prisma.delphiRound.findUniqueOrThrow({ where: { versionId_roundNumber: { versionId: input.versionId, roundNumber: plan.roundNumber - 1 } } });
    const prevCodes = (prev.settings as unknown as RealRoundSettings | null)?.seatCodes ?? [];
    // Feedback and anonymity rely on the same seat → code mapping in every round.
    if (prevCodes.join("|") !== codes.join("|")) throw new DelphiError("INVALID", "Kode dan urutan kursi harus sama dengan ronde sebelumnya.", ["SEAT_CODES_CHANGED"]);
  }
  const panel = (await listPanelsForEditor()).find((p) => p.id === input.configId);
  if (!panel || panel.preset !== "DELPHI_8") throw new DelphiError("PANEL", "Pilih konfigurasi kursi DELPHI_8.");

  const version = await prisma.artifactVersion.findUniqueOrThrow({ where: { id: input.versionId }, select: { label: true } });
  const indicators = await prisma.indicator.findMany({
    where: { aspect: { domain: { versionId: input.versionId } }, code: { in: plan.scopeCodes }, deletedAt: null },
    orderBy: [{ aspect: { domain: { order: "asc" } } }, { aspect: { order: "asc" } }, { order: "asc" }],
    include: { aspect: { include: { domain: true } }, rubricLevels: true, evidence: true },
  });
  const items: DelphiFormItem[] = indicators.map((i) => ({
    code: i.code,
    name: i.name,
    isControlledException: i.isControlledException,
    operationalDefinition: i.operationalDefinition,
    assessmentObject: i.assessmentObject,
    boundaryNote: i.boundaryNote,
    rubric: i.rubricLevels.map((r) => ({ level: r.level, label: r.label, descriptor: r.descriptor })),
    evidence: i.evidence.map((e) => ({ kind: e.kind, minimumFor: e.minimumFor, mandatory: e.mandatory, description: e.description })),
    domainCode: i.aspect.domain.code,
    domainName: i.aspect.domain.name,
    aspectCode: i.aspect.code,
    aspectName: i.aspect.name,
  }));
  const built = buildDelphiForm({ versionLabel: version.label, roundNumber: plan.roundNumber, items, feedback: plan.roundNumber > 1 });
  let slug = `delphi-${slugify(version.label)}-r${plan.roundNumber}`;
  for (let n = 2; await prisma.form.findUnique({ where: { slug }, select: { id: true } }); n++) slug = `delphi-${slugify(version.label)}-r${plan.roundNumber}-${n}`;

  return prisma.$transaction(
    async (tx) => {
      const round = await tx.delphiRound.create({
        data: { versionId: input.versionId, configId: panel.id, dataOrigin: "REAL", roundNumber: plan.roundNumber, status: "QUEUED", panelSize: METHOD.DELPHI_PANEL_SIZE, scopeCodes: plan.scopeCodes, createdById: input.actorId },
      });
      const settings: GenericSettings = { kind: "DELPHI", versionId: input.versionId, respondents: codes, delphi: { roundId: round.id, roundNumber: plan.roundNumber } };
      const form = await tx.form.create({
        data: {
          slug,
          title: built.title,
          purpose: built.purpose,
          instructions: built.instructions,
          versionLabel: version.label,
          status: "HOLD",
          stageTag: "DELPHI_CVI",
          settings: settings as unknown as Prisma.InputJsonValue,
          sections: {
            create: built.sections.map((s) => ({
              order: s.order,
              title: s.title,
              description: s.description,
              nextRule: { next: s.next },
              fields: {
                create: s.fields.map((f, i) => ({
                  order: i,
                  key: f.key,
                  type: f.type,
                  label: f.label,
                  helpText: f.helpText,
                  required: f.required,
                  options: f.options as Prisma.InputJsonValue,
                  config: (f.config ?? undefined) as Prisma.InputJsonValue | undefined,
                  branching: (f.branching ?? undefined) as Prisma.InputJsonValue | undefined,
                })),
              },
            })),
          },
        },
      });
      await tx.delphiRound.update({ where: { id: round.id }, data: { settings: { seatCodes: codes, formId: form.id } satisfies RealRoundSettings as unknown as Prisma.InputJsonValue } });
      await tx.auditEvent.create({ data: { actorId: input.actorId, actorKind: "USER", action: "DELPHI_REAL_ROUND_CREATE", targetType: "DelphiRound", targetId: round.id, payload: { round: plan.roundNumber, items: plan.scopeCodes.length, form: slug } } });
      return { roundId: round.id, formId: form.id };
    },
    { timeout: 60_000 },
  );
}

/** R2/R3: this expert's own previous score + anonymous group statistics per item (§3.13.2). */
export async function delphiFeedbackForCode(settings: GenericSettings, code: string) {
  if (!settings.delphi || settings.delphi.roundNumber < 2 || !settings.versionId) return undefined;
  const prisma = await db();
  const prev = await prisma.delphiRound.findUnique({
    where: { versionId_roundNumber: { versionId: settings.versionId, roundNumber: settings.delphi.roundNumber - 1 } },
    include: { ratings: { select: { indicatorId: true, seatIndex: true, relevance: true } } },
  });
  if (!prev) return undefined;
  const seat = ((prev.settings as unknown as RealRoundSettings | null)?.seatCodes ?? []).indexOf(code) + 1;
  if (seat < 1) return undefined;
  const indicators = await prisma.indicator.findMany({ where: { aspect: { domain: { versionId: settings.versionId } } }, select: { id: true, code: true } });
  const out: Record<string, { own: number | null; median: number; iqr: number; distribution: number[]; revised: boolean }> = {};
  for (const ind of indicators) {
    const rows = prev.ratings.filter((r) => r.indicatorId === ind.id);
    if (rows.length === 0) continue;
    const ratings = Array.from({ length: prev.panelSize }, (_, i) => (rows.find((r) => r.seatIndex === i + 1)?.relevance ?? null) as Relevance);
    const revised = prev.finalizedAt ? (await prisma.changeLogEntry.count({ where: { versionId: settings.versionId, targetCode: ind.code, createdAt: { gt: prev.finalizedAt } } })) > 0 : false;
    out[ind.code] = { ...buildRoundFeedback(ratings, seat), revised };
  }
  return out;
}

/**
 * Turns the CLOSED form's submitted REAL responses into DelphiRating rows
 * (seat i ↔ seatCodes[i]). A code without a submitted consenting response
 * rates null — never imputed — so the round stops at the first item with
 * valid raters ≠ 8 (§3.8.3). Re-run after reopening and closing the form.
 */
export async function computeRealRound(actorId: string, roundId: string) {
  const prisma = await db();
  const round = await prisma.delphiRound.findUniqueOrThrow({ where: { id: roundId } });
  if (round.dataOrigin !== "REAL") throw new DelphiError("STATE", "Bukan ronde pakar manusia.");
  if (round.finalizedAt) throw new DelphiError("STATE", "Ronde sudah final.");
  const s = round.settings as unknown as RealRoundSettings;
  const form = await prisma.form.findUniqueOrThrow({ where: { id: s.formId }, include: { responses: { where: { dataOrigin: "REAL", completed: true } } } });
  if (form.status !== "CLOSED") throw new DelphiError("STATE", "Tutup formulir dulu sebelum menghitung.");
  const byCode = new Map(form.responses.map((r) => [r.respondentRef, r.answers as Record<string, string>]));
  const indicators = await prisma.indicator.findMany({ where: { aspect: { domain: { versionId: round.versionId } }, code: { in: round.scopeCodes } }, select: { id: true, code: true } });
  await prisma.delphiRound.update({ where: { id: roundId }, data: { status: "RUNNING", error: null, startedAt: round.startedAt ?? new Date() } });
  let done = 0;
  for (const code of round.scopeCodes) {
    const ind = indicators.find((i) => i.code === code);
    if (!ind) continue;
    const rows: SeatRatingRow[] = s.seatCodes.map((panelCode, i) => {
      const answers = byCode.get(panelCode);
      const r = answers ? ratingFrom(answers, code) : { relevance: null, clarityFlag: false, clarityNote: null };
      return { seatIndex: i + 1, ...r, reason: null, error: r.relevance === null ? (answers ? "tidak menilai butir ini" : "tidak mengirim respons") : null, log: null };
    });
    const saved = await saveDelphiItem(roundId, ind.id, code, rows);
    if (saved.deviation) {
      await prisma.auditEvent.create({ data: { actorId, actorKind: "USER", action: "DELPHI_REAL_COMPUTE", targetType: "DelphiRound", targetId: roundId, payload: { done, stoppedAt: code, error: saved.error } } });
      return { done, deviation: saved.error };
    }
    done++;
  }
  await prisma.auditEvent.create({ data: { actorId, actorKind: "USER", action: "DELPHI_REAL_COMPUTE", targetType: "DelphiRound", targetId: roundId, payload: { done } } });
  return { done, deviation: null };
}

export async function realRoundStatus(roundId: string) {
  const prisma = await db();
  const round = await prisma.delphiRound.findUnique({ where: { id: roundId } });
  if (!round || round.dataOrigin !== "REAL") return null;
  const s = round.settings as unknown as RealRoundSettings | null;
  if (!s) return null;
  const form = await prisma.form.findUnique({ where: { id: s.formId }, include: { responses: { where: { dataOrigin: "REAL" }, select: { respondentRef: true, completed: true } } } });
  return {
    form: form ? { id: form.id, slug: form.slug, status: form.status } : null,
    seats: s.seatCodes.map((code, i) => ({ seatIndex: i + 1, code, state: form?.responses.find((r) => r.respondentRef === code)?.completed ? "SUBMITTED" : form?.responses.some((r) => r.respondentRef === code) ? "DRAFT" : "NONE" })),
  };
}
