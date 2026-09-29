import type { DiffIndicator } from "@/lib/artifact/diff";
import type { ArtifactSnapshot } from "@/lib/method/gates";

import { db } from "../client";
import { iso, type FlatRecord } from "../types";

export async function listVersions(): Promise<FlatRecord[]> {
  const prisma = await db();
  const rows = await prisma.artifactVersion.findMany({
    orderBy: { createdAt: "asc" },
    include: { parent: { select: { label: true } }, _count: { select: { domains: true, changeLog: true } } },
  });
  return rows.map((v) => ({
    id: v.id,
    label: v.label,
    status: v.status,
    parent: v.parent?.label ?? null,
    domainCount: v._count.domains,
    note: v.note,
    lockedAt: iso(v.contentLockedAt),
    createdAt: iso(v.createdAt),
  }));
}

export async function findVersionId(preferred: string | null): Promise<string | null> {
  const prisma = await db();
  if (preferred) {
    const hit = await prisma.artifactVersion.findUnique({ where: { id: preferred }, select: { id: true } });
    if (hit) return hit.id;
  }
  const latest = await prisma.artifactVersion.findFirst({ orderBy: { createdAt: "desc" }, select: { id: true } });
  return latest?.id ?? null;
}

export async function listDomains(versionId: string): Promise<FlatRecord[]> {
  const prisma = await db();
  const rows = await prisma.domain.findMany({
    where: { versionId },
    orderBy: { order: "asc" },
    include: { aspects: { select: { _count: { select: { indicators: { where: { deletedAt: null } } } } } } },
  });
  return rows.map((d) => ({
    id: d.id,
    order: d.order,
    code: d.code,
    name: d.name,
    aspectCount: d.aspects.length,
    indicatorCount: d.aspects.reduce((n, a) => n + a._count.indicators, 0),
    sdgTags: d.sdgTags,
    note: d.rationale,
  }));
}

export async function listAspects(versionId: string): Promise<FlatRecord[]> {
  const prisma = await db();
  const rows = await prisma.aspect.findMany({
    where: { domain: { versionId } },
    orderBy: [{ domain: { order: "asc" } }, { order: "asc" }],
    include: { domain: { select: { code: true } }, _count: { select: { indicators: { where: { deletedAt: null } } } } },
  });
  return rows.map((a) => ({
    id: a.id,
    domain: a.domain.code,
    code: a.code,
    name: a.name,
    indicatorCount: a._count.indicators,
    note: a.rationale,
  }));
}

export async function listIndicators(versionId: string, opts: { includeDeleted?: boolean } = {}): Promise<FlatRecord[]> {
  const prisma = await db();
  const rows = await prisma.indicator.findMany({
    where: { aspect: { domain: { versionId } }, ...(opts.includeDeleted ? {} : { deletedAt: null }) },
    orderBy: [{ aspect: { domain: { order: "asc" } } }, { aspect: { order: "asc" } }, { order: "asc" }],
    include: {
      aspect: { select: { code: true, domain: { select: { code: true } } } },
      rubricLevels: { select: { level: true } },
      evidence: { select: { mandatory: true } },
    },
  });
  return rows.map((i) => ({
    id: i.id,
    domain: i.aspect.domain.code,
    aspect: i.aspect.code,
    code: i.code,
    exception: i.isControlledException,
    name: i.name,
    operationalDefinition: i.operationalDefinition,
    rubricCount: new Set(i.rubricLevels.map((r) => r.level)).size,
    evidenceCount: i.evidence.filter((e) => e.mandatory).length,
    deleted: i.deletedAt !== null,
  }));
}

export async function listRubricLevels(versionId: string): Promise<FlatRecord[]> {
  const prisma = await db();
  const rows = await prisma.rubricLevel.findMany({
    where: { indicator: { aspect: { domain: { versionId } }, deletedAt: null } },
    orderBy: [{ indicator: { code: "asc" } }, { level: "asc" }],
    include: { indicator: { select: { code: true } } },
  });
  return rows.map((r) => ({
    id: r.id,
    indicator: r.indicator.code,
    level: r.level,
    label: r.label,
    descriptor: r.descriptor,
    cumulative: r.cumulative,
  }));
}

export async function listEvidence(versionId: string): Promise<FlatRecord[]> {
  const prisma = await db();
  const rows = await prisma.evidenceRequirement.findMany({
    where: { indicator: { aspect: { domain: { versionId } }, deletedAt: null } },
    orderBy: [{ indicator: { code: "asc" } }, { minimumFor: "asc" }],
    include: { indicator: { select: { code: true } } },
  });
  return rows.map((e) => ({
    id: e.id,
    indicator: e.indicator.code,
    kind: e.kind,
    mandatory: e.mandatory,
    minimumFor: e.minimumFor,
    description: e.description,
  }));
}

export async function listChangeLog(versionId: string): Promise<FlatRecord[]> {
  const prisma = await db();
  const rows = await prisma.changeLogEntry.findMany({ where: { versionId }, orderBy: { createdAt: "desc" } });
  return rows.map((c) => ({
    id: c.id,
    createdAt: iso(c.createdAt),
    targetType: c.targetType,
    target: c.targetCode,
    action: c.action,
    reason: c.reason,
    decisionSource: c.decisionSource,
    impact: c.impactNote,
  }));
}

export async function listGateRecords(versionId: string) {
  const prisma = await db();
  return prisma.gateRecord.findMany({
    where: { versionId },
    select: { gate: true, status: true, unmet: true, warnings: true, decidedAt: true },
  });
}

/**
 * Gate status along the whole process line of a version: its ancestors, the
 * version itself, and its newest descendant at each step (A1.0 → A1.1 → A2.0).
 * Each gate shows the furthest record on that line, i.e. where the flow stands,
 * with the label of the version that holds it (researcher decision 2026-09-29).
 */
export async function listLineageGates(versionId: string) {
  const prisma = await db();
  const versions = await prisma.artifactVersion.findMany({ select: { id: true, label: true, parentId: true, createdAt: true } });
  const byId = new Map(versions.map((v) => [v.id, v]));
  const up: typeof versions = [];
  for (let v = byId.get(versionId); v; v = v.parentId ? byId.get(v.parentId) : undefined) up.unshift(v);
  const line = [...up];
  for (let current = byId.get(versionId); current; ) {
    const child: (typeof versions)[number] | undefined = versions.filter((v) => v.parentId === current!.id).sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())[0];
    if (child) line.push(child);
    current = child;
  }
  const records = await prisma.gateRecord.findMany({ where: { versionId: { in: line.map((v) => v.id) } }, select: { gate: true, status: true, versionId: true } });
  const depth = new Map(line.map((v, i) => [v.id, i]));
  const furthest = new Map<string, (typeof records)[number]>();
  for (const r of records) {
    const prior = furthest.get(r.gate);
    if (!prior || depth.get(r.versionId)! > depth.get(prior.versionId)!) furthest.set(r.gate, r);
  }
  return [...furthest.values()].map((r) => ({ gate: r.gate, status: r.status, versionLabel: byId.get(r.versionId)!.label }));
}

/** Mirrors prisma/seed.ts so the dashboard evaluates G1 exactly as the seed does. */
export async function getArtifactSnapshot(versionId: string): Promise<ArtifactSnapshot> {
  const prisma = await db();
  const [version, domains] = await Promise.all([
    prisma.artifactVersion.findUniqueOrThrow({ where: { id: versionId }, select: { status: true } }),
    prisma.domain.findMany({
      where: { versionId },
      orderBy: { order: "asc" },
      include: {
        aspects: {
          orderBy: { order: "asc" },
          include: {
            indicators: {
              where: { deletedAt: null },
              orderBy: { order: "asc" },
              include: { rubricLevels: { select: { level: true } }, evidence: { select: { mandatory: true } } },
            },
          },
        },
      },
    }),
  ]);
  return {
    contentLocked: version.status === "CONTENT_LOCKED",
    domains: domains.map((d) => ({
      code: d.code,
      aspects: d.aspects.map((a) => ({
        code: a.code,
        indicators: a.indicators.map((i) => ({
          code: i.code,
          hasOperationalDefinition: Boolean(i.operationalDefinition),
          rubricLevels: i.rubricLevels.map((r) => r.level),
          mandatoryEvidenceCount: i.evidence.filter((e) => e.mandatory).length,
        })),
      })),
    })),
  };
}

export interface HierarchyIndicator {
  code: string;
  name: string;
  isControlledException: boolean;
  operationalDefinition: string | null;
}
export interface HierarchyAspect {
  code: string;
  name: string;
  indicators: HierarchyIndicator[];
}
export interface HierarchyDomain {
  code: string;
  name: string;
  aspects: HierarchyAspect[];
}

/** Domain → aspect → indicator in stored order, for the dashboard map. */
export async function getArtifactHierarchy(versionId: string): Promise<HierarchyDomain[]> {
  const prisma = await db();
  const domains = await prisma.domain.findMany({
    where: { versionId },
    orderBy: { order: "asc" },
    select: {
      code: true,
      name: true,
      aspects: {
        orderBy: { order: "asc" },
        select: {
          code: true,
          name: true,
          indicators: {
            where: { deletedAt: null },
            orderBy: { order: "asc" },
            select: { code: true, name: true, isControlledException: true, operationalDefinition: true },
          },
        },
      },
    },
  });
  return domains;
}

/** Every indicator of a version (soft-deleted included) in the shape `diffVersions` compares. */
export async function getDiffIndicators(versionId: string): Promise<DiffIndicator[]> {
  const prisma = await db();
  const rows = await prisma.indicator.findMany({
    where: { aspect: { domain: { versionId } } },
    include: { aspect: { select: { code: true, domain: { select: { code: true } } } }, rubricLevels: true, evidence: true },
  });
  return rows.map((i) => ({
    code: i.code,
    name: i.name,
    domainCode: i.aspect.domain.code,
    aspectCode: i.aspect.code,
    deleted: i.deletedAt !== null,
    operationalDefinition: i.operationalDefinition,
    assessmentObject: i.assessmentObject,
    boundaryNote: i.boundaryNote,
    rubric: i.rubricLevels.map((r) => ({ level: r.level, label: r.label, descriptor: r.descriptor })),
    evidence: i.evidence.map((e) => ({ kind: e.kind, minimumFor: e.minimumFor, mandatory: e.mandatory, description: e.description })),
  }));
}
