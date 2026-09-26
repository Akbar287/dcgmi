import { db } from "../client";
import { iso, type FlatRecord } from "../types";

// PanelistIdentity is intentionally absent: it is Owner-only and never joins
// analysis screens (R1-V1.7 §3.13.2).

function participation(e: { inFgd: boolean; inDelphi: boolean; inAhp: boolean }): string[] {
  return [e.inFgd && "FGD", e.inDelphi && "Delphi", e.inAhp && "AHP"].filter((x): x is string => Boolean(x));
}

export async function listExperts(): Promise<FlatRecord[]> {
  const prisma = await db();
  const rows = await prisma.expert.findMany({
    orderBy: { panelCode: "asc" },
    include: { persona: { select: { status: true } } },
  });
  return rows.map((e) => ({
    id: e.id,
    panelCode: e.panelCode,
    name: e.displayName,
    field: e.field,
    affiliation: e.affiliation,
    participation: participation(e),
    coi: e.coiDeclared,
    hasCv: Boolean(e.cvFileKey),
    persona: e.persona?.status ?? null,
  }));
}

export async function listExpertCoi(): Promise<FlatRecord[]> {
  const prisma = await db();
  const rows = await prisma.expert.findMany({ orderBy: { panelCode: "asc" } });
  return rows.map((e) => ({
    id: e.id,
    panelCode: e.panelCode,
    field: e.field,
    coi: e.coiDeclared,
    coiNote: e.coiNote,
  }));
}

export async function listPersonaBriefs(): Promise<FlatRecord[]> {
  const prisma = await db();
  const rows = await prisma.personaBrief.findMany({
    orderBy: { expert: { panelCode: "asc" } },
    include: { expert: { select: { panelCode: true, field: true } } },
  });
  return rows.map((p) => ({
    id: p.id,
    panelCode: p.expert.panelCode,
    field: p.expert.field,
    expertise: p.expertiseAreas,
    years: p.yearsExperience,
    status: p.status,
    promptVersion: p.promptVersion,
    approvedAt: iso(p.approvedAt),
  }));
}
