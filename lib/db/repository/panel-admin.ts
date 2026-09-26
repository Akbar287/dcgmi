import type { Prisma } from "@/generated/prisma/client";
import { validatePanel, type SeatForCheck } from "@/lib/panel/composition";
import type { ExpertField } from "@/lib/panel/presets";
import { findIdentifiers } from "@/lib/persona/deidentify";
import { renderPersonaPrompt } from "@/lib/persona/prompt";
import type { PersonaBriefInput } from "@/lib/persona/schema";

import { db } from "../client";

type Tx = Prisma.TransactionClient;

export class PanelStateError extends Error {
  constructor(
    readonly code: "CONFLICT" | "NOT_FOUND" | "INVALID_TRANSITION" | "DEID_FAILED" | "FIELD_MISMATCH",
    message: string,
    readonly details?: unknown,
  ) {
    super(message);
    this.name = "PanelStateError";
  }
}

function audit(tx: Tx, actorId: string, action: string, targetType: string, targetId: string, payload: Prisma.InputJsonValue) {
  return tx.auditEvent.create({ data: { actorId, actorKind: "USER", action, targetType, targetId, payload } });
}

// ── Experts ──────────────────────────────────────────────────────────

export async function listExpertsForAdmin() {
  const prisma = await db();
  const rows = await prisma.expert.findMany({
    orderBy: { panelCode: "asc" },
    include: { persona: { select: { status: true } }, _count: { select: { seats: true } } },
  });
  return rows.map((e) => ({
    id: e.id,
    panelCode: e.panelCode,
    displayName: e.displayName,
    field: e.field as ExpertField,
    affiliation: e.affiliation,
    coiDeclared: e.coiDeclared,
    coiNote: e.coiNote,
    inFgd: e.inFgd,
    inDelphi: e.inDelphi,
    inAhp: e.inAhp,
    personaStatus: e.persona?.status ?? null,
    seats: e._count.seats,
  }));
}

export async function saveExpert(
  actorId: string,
  input: {
    id?: string;
    panelCode: string;
    displayName: string | null;
    field: ExpertField;
    affiliation: string | null;
    coiDeclared: boolean;
    coiNote: string | null;
    inFgd: boolean;
    inDelphi: boolean;
    inAhp: boolean;
  },
) {
  const prisma = await db();
  return prisma.$transaction(async (tx) => {
    const holder = await tx.expert.findUnique({ where: { panelCode: input.panelCode }, select: { id: true } });
    if (holder && holder.id !== input.id) throw new PanelStateError("CONFLICT", `Kode ${input.panelCode} sudah dipakai.`);
    const { id, ...data } = input;
    if (id) {
      const current = await tx.expert.findUniqueOrThrow({ where: { id }, include: { seats: { select: { field: true } } } });
      // A field change would silently break seats that require the old field.
      if (current.field !== data.field && current.seats.some((s) => s.field !== data.field)) {
        throw new PanelStateError("FIELD_MISMATCH", "Pakar masih menempati kursi dengan bidang lama; lepaskan dari kursi dulu.");
      }
      await tx.expert.update({ where: { id }, data });
      await audit(tx, actorId, "EXPERT_UPDATE", "Expert", id, { panelCode: data.panelCode, field: data.field, coiDeclared: data.coiDeclared });
      return id;
    }
    const created = await tx.expert.create({ data });
    await audit(tx, actorId, "EXPERT_CREATE", "Expert", created.id, { panelCode: data.panelCode, field: data.field });
    return created.id;
  });
}

// ── Panelist identity (Admin only; never joins analysis) ─────────────

export async function saveIdentity(
  actorId: string,
  input: { id?: string; panelCode: string; fullName: string; email: string | null; institution: string | null; note: string | null },
) {
  const prisma = await db();
  return prisma.$transaction(async (tx) => {
    const holder = await tx.panelistIdentity.findUnique({ where: { panelCode: input.panelCode }, select: { id: true } });
    if (holder && holder.id !== input.id) throw new PanelStateError("CONFLICT", `Kode ${input.panelCode} sudah punya identitas.`);
    const { id, ...data } = input;
    const saved = id ? await tx.panelistIdentity.update({ where: { id }, data }) : await tx.panelistIdentity.create({ data });
    // Audit payload carries the code only; the identity itself stays in its table.
    await audit(tx, actorId, id ? "IDENTITY_UPDATE" : "IDENTITY_CREATE", "PanelistIdentity", saved.id, { panelCode: data.panelCode });
    return saved.id;
  });
}

export async function deleteIdentity(actorId: string, id: string) {
  const prisma = await db();
  await prisma.$transaction(async (tx) => {
    const row = await tx.panelistIdentity.delete({ where: { id } });
    await audit(tx, actorId, "IDENTITY_DELETE", "PanelistIdentity", id, { panelCode: row.panelCode });
  });
}

// ── Persona briefs ───────────────────────────────────────────────────

/** Real names and affiliations to refuse. Read server-side only; never sent to the browser. */
async function identityTerms(tx: Tx, expertId: string): Promise<string[]> {
  const expert = await tx.expert.findUniqueOrThrow({ where: { id: expertId } });
  const identity = await tx.panelistIdentity.findUnique({ where: { panelCode: expert.panelCode } });
  return [expert.displayName, expert.affiliation, identity?.fullName, identity?.email, identity?.institution].filter((x): x is string => Boolean(x));
}

function briefOf(p: {
  expertiseAreas: string[];
  yearsExperience: number | null;
  institutionType: string | null;
  researchFocus: string[];
  methodStance: string | null;
  vocabularyHints: string[];
  emphasisBias: string | null;
}): PersonaBriefInput {
  return {
    expertiseAreas: p.expertiseAreas,
    yearsExperience: p.yearsExperience,
    institutionType: (p.institutionType as PersonaBriefInput["institutionType"]) ?? null,
    researchFocus: p.researchFocus,
    methodStance: p.methodStance ?? "",
    vocabularyHints: p.vocabularyHints,
    emphasisBias: p.emphasisBias ?? "",
  };
}

export async function getPersonaEditor(expertId: string) {
  const prisma = await db();
  const expert = await prisma.expert.findUnique({ where: { id: expertId }, include: { persona: true } });
  if (!expert) return null;
  const p = expert.persona;
  return {
    expert: { id: expert.id, panelCode: expert.panelCode, field: expert.field as ExpertField },
    persona: p
      ? {
          ...briefOf(p),
          status: p.status,
          findings: Array.isArray(p.deidFindings) ? (p.deidFindings as unknown as ReturnType<typeof findIdentifiers>) : [],
          systemPrompt: p.systemPrompt,
          promptVersion: p.promptVersion,
          approvedAt: p.approvedAt?.toISOString() ?? null,
        }
      : null,
  };
}

/**
 * Saves a manually written brief (researcher decision 2026-09-26: no CV is
 * processed). The de-identification filter runs on every save; any edit of an
 * approved brief sends it back to DRAFT so it must be approved again.
 */
export async function savePersona(actorId: string, expertId: string, brief: PersonaBriefInput, artifactSummary: string) {
  const prisma = await db();
  return prisma.$transaction(async (tx) => {
    const findings = findIdentifiers(brief, await identityTerms(tx, expertId));
    const { prompt, promptVersion } = renderPersonaPrompt(brief, artifactSummary);
    const prior = await tx.personaBrief.findUnique({ where: { expertId }, select: { status: true } });
    const data = {
      ...brief,
      deidFindings: findings as unknown as Prisma.InputJsonValue,
      status: "DRAFT" as const,
      approved: false,
      approvedById: null,
      approvedAt: null,
      systemPrompt: prompt,
      promptVersion,
    };
    await tx.personaBrief.upsert({ where: { expertId }, create: { expertId, ...data }, update: data });
    await audit(tx, actorId, prior?.status === "APPROVED" ? "PERSONA_REOPENED" : "PERSONA_SAVE", "PersonaBrief", expertId, {
      findings: findings.length,
      promptVersion,
    });
    return findings;
  });
}

const TRANSITIONS: Record<"REVIEWED" | "APPROVED" | "RETIRED", string[]> = {
  REVIEWED: ["DRAFT"],
  APPROVED: ["REVIEWED"],
  RETIRED: ["DRAFT", "REVIEWED", "APPROVED"],
};

/** DRAFT → REVIEWED → APPROVED (Admin; de-identification re-checked) → RETIRED. */
export async function setPersonaStatus(actorId: string, expertId: string, to: "REVIEWED" | "APPROVED" | "RETIRED", artifactSummary: string) {
  const prisma = await db();
  await prisma.$transaction(async (tx) => {
    const p = await tx.personaBrief.findUnique({ where: { expertId } });
    if (!p) throw new PanelStateError("NOT_FOUND", "Persona belum dibuat.");
    if (!TRANSITIONS[to].includes(p.status)) throw new PanelStateError("INVALID_TRANSITION", `${p.status} → ${to}`);
    const data: Prisma.PersonaBriefUpdateInput = { status: to };
    if (to === "APPROVED") {
      // docs/04 §4.3: a brief that fails the filter cannot be approved.
      const brief = briefOf(p);
      const findings = findIdentifiers(brief, await identityTerms(tx, expertId));
      if (findings.length > 0) throw new PanelStateError("DEID_FAILED", "Persona masih memuat penanda identitas.", findings);
      const { prompt, promptVersion } = renderPersonaPrompt(brief, artifactSummary);
      Object.assign(data, { approved: true, approvedById: actorId, approvedAt: new Date(), systemPrompt: prompt, promptVersion, deidFindings: [] });
    }
    if (to === "RETIRED") Object.assign(data, { approved: false });
    await tx.personaBrief.update({ where: { expertId }, data });
    await audit(tx, actorId, `PERSONA_${to}`, "PersonaBrief", expertId, { from: p.status });
  });
}

// ── Seats ────────────────────────────────────────────────────────────

export async function listPanelsForEditor() {
  const prisma = await db();
  const configs = await prisma.panelConfig.findMany({
    orderBy: { createdAt: "asc" },
    include: {
      seats: {
        orderBy: { seatIndex: "asc" },
        include: {
          expert: { select: { id: true, panelCode: true, field: true, persona: { select: { status: true } } } },
          modelProfile: { select: { id: true, label: true, provider: { select: { key: true, approved: true, enabled: true, label: true } } } },
        },
      },
    },
  });
  return configs.map((c) => {
    const seats: (SeatForCheck & { id: string; temperature: number; seed: number | null })[] = c.seats.map((s) => ({
      id: s.id,
      seatIndex: s.seatIndex,
      label: s.label,
      field: s.field as ExpertField,
      isNewMember: s.isNewMember,
      contextScope: s.contextScope,
      temperature: s.temperature,
      seed: s.seed,
      expert: s.expert
        ? { id: s.expert.id, panelCode: s.expert.panelCode, field: s.expert.field as ExpertField, personaStatus: s.expert.persona?.status ?? null }
        : null,
      model: {
        id: s.modelProfile.id,
        label: `${s.modelProfile.provider.label} · ${s.modelProfile.label}`,
        providerKey: s.modelProfile.provider.key,
        providerApproved: s.modelProfile.provider.approved,
        providerEnabled: s.modelProfile.provider.enabled,
      },
    }));
    return {
      id: c.id,
      name: c.name,
      preset: c.preset,
      panelSize: c.panelSize,
      facilitatorModelId: c.facilitatorModelId,
      notetakerModelId: c.notetakerModelId,
      seats,
      validation: validatePanel(c.preset, seats),
    };
  });
}

export async function listModelOptions() {
  const prisma = await db();
  const rows = await prisma.modelProfile.findMany({ orderBy: [{ provider: { label: "asc" } }, { label: "asc" }], include: { provider: true } });
  return rows.map((m) => ({
    id: m.id,
    label: `${m.provider.label} · ${m.label}`,
    modelId: m.modelId,
    providerKey: m.provider.key,
    providerLabel: m.provider.label,
    envKeyName: m.provider.envKeyName,
    baseUrl: m.provider.baseUrl,
    approved: m.provider.approved,
    enabled: m.provider.enabled,
  }));
}

export async function updateSeat(
  actorId: string,
  input: { seatId: string; expertId: string | null; modelProfileId: string; temperature: number; seed: number | null },
) {
  const prisma = await db();
  await prisma.$transaction(async (tx) => {
    const seat = await tx.panelSeat.findUniqueOrThrow({ where: { id: input.seatId } });
    if (input.expertId) {
      const expert = await tx.expert.findUniqueOrThrow({ where: { id: input.expertId } });
      if (expert.field !== seat.field) throw new PanelStateError("FIELD_MISMATCH", `${expert.panelCode} (${expert.field}) tidak sesuai bidang kursi (${seat.field}).`);
      const clash = await tx.panelSeat.findFirst({ where: { configId: seat.configId, expertId: input.expertId, id: { not: seat.id } } });
      if (clash) throw new PanelStateError("CONFLICT", `${expert.panelCode} sudah menempati ${clash.label}.`);
    }
    await tx.panelSeat.update({
      where: { id: seat.id },
      data: { expertId: input.expertId, modelProfileId: input.modelProfileId, temperature: input.temperature, seed: input.seed },
    });
    await audit(tx, actorId, "SEAT_UPDATE", "PanelSeat", seat.id, {
      configId: seat.configId,
      seatIndex: seat.seatIndex,
      expertId: input.expertId,
      modelProfileId: input.modelProfileId,
      temperature: input.temperature,
      seed: input.seed,
    });
  });
}

export async function recordModelPing(actorId: string, modelProfileId: string, payload: Prisma.InputJsonValue) {
  const prisma = await db();
  await prisma.auditEvent.create({
    data: { actorId, actorKind: "USER", action: "MODEL_PING", targetType: "ModelProfile", targetId: modelProfileId, payload },
  });
}

export async function listIdentitiesForAdmin() {
  const prisma = await db();
  return prisma.panelistIdentity.findMany({
    orderBy: { panelCode: "asc" },
    select: { id: true, panelCode: true, fullName: true, email: true, institution: true, note: true },
  });
}

// ── Vercel AI Gateway (researcher decision 2026-09-26, docs/07 §5) ──

export async function ensureGatewayProvider(actorId: string) {
  const prisma = await db();
  const existing = await prisma.provider.findUnique({ where: { key: "gateway" } });
  if (existing) return existing.id;
  const created = await prisma.provider.create({
    data: { key: "gateway", label: "Vercel AI Gateway", envKeyName: "AI_GATEWAY_API_KEY", approved: true, enabled: true },
  });
  await prisma.auditEvent.create({ data: { actorId, actorKind: "USER", action: "PROVIDER_CREATE", targetType: "Provider", targetId: created.id, payload: { key: "gateway" } } });
  return created.id;
}

export async function addGatewayModel(actorId: string, modelId: string, label: string) {
  const prisma = await db();
  const providerId = await ensureGatewayProvider(actorId);
  const exists = await prisma.modelProfile.findUnique({ where: { providerId_modelId: { providerId, modelId } } });
  if (exists) throw new PanelStateError("CONFLICT", `Model ${modelId} sudah terdaftar.`);
  const created = await prisma.modelProfile.create({ data: { providerId, modelId, label } });
  await prisma.auditEvent.create({ data: { actorId, actorKind: "USER", action: "MODEL_PROFILE_CREATE", targetType: "ModelProfile", targetId: created.id, payload: { modelId } } });
  return created.id;
}

export async function setPanelRoles(actorId: string, configId: string, facilitatorModelId: string, notetakerModelId: string) {
  const prisma = await db();
  await prisma.$transaction([
    prisma.panelConfig.update({ where: { id: configId }, data: { facilitatorModelId, notetakerModelId } }),
    prisma.auditEvent.create({ data: { actorId, actorKind: "USER", action: "PANEL_ROLES_UPDATE", targetType: "PanelConfig", targetId: configId, payload: { facilitatorModelId, notetakerModelId } } }),
  ]);
}
