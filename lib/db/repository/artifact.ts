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
    include: { aspects: { select: { _count: { select: { indicators: true } } } } },
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
    include: { domain: { select: { code: true } }, _count: { select: { indicators: true } } },
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

export async function listIndicators(versionId: string): Promise<FlatRecord[]> {
  const prisma = await db();
  const rows = await prisma.indicator.findMany({
    where: { aspect: { domain: { versionId } } },
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
  }));
}

export async function listRubricLevels(versionId: string): Promise<FlatRecord[]> {
  const prisma = await db();
  const rows = await prisma.rubricLevel.findMany({
    where: { indicator: { aspect: { domain: { versionId } } } },
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
    where: { indicator: { aspect: { domain: { versionId } } } },
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
