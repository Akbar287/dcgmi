import { db } from "../client";
import { decimal, type FlatRecord } from "../types";

export async function listProviders(): Promise<FlatRecord[]> {
  const prisma = await db();
  const rows = await prisma.provider.findMany({
    orderBy: { label: "asc" },
    include: { _count: { select: { models: true } } },
  });
  return rows.map((p) => ({
    id: p.id,
    key: p.key,
    name: p.label,
    envKey: p.envKeyName,
    // Presence only; the key value never leaves the server.
    envStatus: process.env[p.envKeyName] ? "CONFIGURED" : "NOT_CONFIGURED",
    approved: p.approved,
    enabled: p.enabled,
    models: p._count.models,
  }));
}

export async function listModelProfiles(): Promise<FlatRecord[]> {
  const prisma = await db();
  const rows = await prisma.modelProfile.findMany({
    orderBy: [{ provider: { label: "asc" } }, { label: "asc" }],
    include: { provider: { select: { label: true } } },
  });
  return rows.map((m) => ({
    id: m.id,
    provider: m.provider.label,
    name: m.label,
    modelId: m.modelId,
    contextWindow: m.contextWindow,
    inputCost: decimal(m.inputCostPer1k),
    outputCost: decimal(m.outputCostPer1k),
  }));
}

export async function listPanelConfigs(): Promise<FlatRecord[]> {
  const prisma = await db();
  const rows = await prisma.panelConfig.findMany({
    orderBy: { createdAt: "asc" },
    include: { _count: { select: { seats: true } } },
  });
  return rows.map((c) => ({
    id: c.id,
    name: c.name,
    preset: c.preset,
    panelSize: c.panelSize,
    seats: c._count.seats,
    createdAt: c.createdAt.toISOString(),
  }));
}

export async function listPanelSeats(): Promise<FlatRecord[]> {
  const prisma = await db();
  const rows = await prisma.panelSeat.findMany({
    orderBy: [{ config: { name: "asc" } }, { seatIndex: "asc" }],
    include: {
      config: { select: { name: true } },
      expert: { select: { panelCode: true } },
      modelProfile: { select: { label: true, provider: { select: { label: true } } } },
    },
  });
  return rows.map((s) => ({
    id: s.id,
    config: s.config.name,
    seat: s.label,
    field: s.field,
    panelCode: s.expert?.panelCode ?? null,
    provider: s.modelProfile.provider.label,
    model: s.modelProfile.label,
    temperature: s.temperature,
    seed: s.seed,
    newMember: s.isNewMember,
    contextScope: s.contextScope,
  }));
}
