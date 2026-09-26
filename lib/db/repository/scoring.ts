import { db } from "../client";
import { iso, type FlatRecord } from "../types";

export async function listAssessments(versionId: string): Promise<FlatRecord[]> {
  const prisma = await db();
  const rows = await prisma.assessment.findMany({
    where: { versionId },
    orderBy: { createdAt: "desc" },
    include: { _count: { select: { scores: true } } },
  });
  return rows.map((a) => ({
    id: a.id,
    origin: a.dataOrigin,
    institution: a.institutionLabel,
    assessor: a.assessorRef,
    status: a.status,
    scores: a._count.scores,
    action: a.id,
    createdAt: iso(a.createdAt),
  }));
}

export async function listIndicatorScores(
  versionId: string,
  filter: "all" | "missing" | "evidence" = "all",
): Promise<FlatRecord[]> {
  const prisma = await db();
  const rows = await prisma.indicatorScore.findMany({
    where: {
      assessment: { versionId },
      ...(filter === "missing" ? { missingKind: { not: "NONE" } } : {}),
      ...(filter === "evidence" ? { evidenceLocator: { not: null } } : {}),
    },
    orderBy: [{ assessment: { createdAt: "desc" } }, { indicator: { code: "asc" } }],
    include: {
      assessment: { select: { institutionLabel: true, dataOrigin: true } },
      indicator: { select: { code: true } },
    },
  });
  return rows.map((s) => ({
    id: s.id,
    origin: s.assessment.dataOrigin,
    institution: s.assessment.institutionLabel,
    indicator: s.indicator.code,
    level: s.level,
    missingKind: s.missingKind,
    evidenceLocator: s.evidenceLocator,
    rationale: s.rationale,
  }));
}
