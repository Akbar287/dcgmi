import { evaluateBaselineGate, GATE_ORDER } from "@/lib/method/gates";

import { db } from "../client";
import { evaluateAhpGateFor } from "./ahp-sessions";
import { getArtifactSnapshot } from "./artifact";
import { evaluateContentLockFor } from "./content-lock";
import { evaluateDelphiGateFor } from "./delphi-gate";
import { evaluateFgdGateFor } from "./fgd-gate";
import { evaluatePilotGateFor } from "./pilot";
import { evaluateScoringGateFor } from "./scoring-runs";

/**
 * Everything the G1–G7 report prints, for the active version and all its
 * ancestors (root first). Full rows, not summaries: the PDF is the complete
 * record. PanelistIdentity and CV content are never loaded (docs/07 P6).
 */
export async function loadReportData(versionId: string) {
  const prisma = await db();
  const chain: { id: string; label: string; status: string; parentId: string | null; note: string | null; createdAt: Date; contentLockedAt: Date | null }[] = [];
  for (let id: string | null = versionId; id; ) {
    const v: (typeof chain)[number] | null = await prisma.artifactVersion.findUnique({ where: { id }, select: { id: true, label: true, status: true, parentId: true, note: true, createdAt: true, contentLockedAt: true } });
    if (!v) break;
    chain.push(v);
    id = v.parentId;
  }
  const lineage = chain.reverse();
  const ids = lineage.map((v) => v.id);

  const [domains, changeLog, gates, fgd, delphi, ahp, assessments, profiles, pilots, declarations, recompute, calls] = await Promise.all([
    prisma.domain.findMany({
      where: { versionId: { in: ids } },
      orderBy: { order: "asc" },
      include: { aspects: { orderBy: { order: "asc" }, include: { indicators: { orderBy: { order: "asc" }, include: { rubricLevels: { orderBy: { level: "asc" } }, evidence: { orderBy: [{ minimumFor: "asc" }, { id: "asc" }] } } } } } },
    }),
    prisma.changeLogEntry.findMany({ where: { versionId: { in: ids } }, orderBy: { createdAt: "asc" } }),
    prisma.gateRecord.findMany({ where: { versionId: { in: ids } } }),
    prisma.fgdSession.findMany({
      where: { versionId: { in: ids } },
      orderBy: { createdAt: "asc" },
      include: {
        config: { select: { name: true, seats: { orderBy: { seatIndex: "asc" }, select: { seatIndex: true, label: true, field: true, expert: { select: { panelCode: true } }, modelProfile: { select: { label: true, modelId: true } } } } } },
        stages: { orderBy: { order: "asc" }, include: { items: { orderBy: { order: "asc" }, include: { utterances: { orderBy: { turn: "asc" } }, positions: { orderBy: { seatIndex: "asc" } }, decision: true, suggestions: { orderBy: { seatIndex: "asc" } } } } } },
      },
    }),
    prisma.delphiRound.findMany({
      where: { versionId: { in: ids } },
      orderBy: [{ versionId: "asc" }, { roundNumber: "asc" }],
      include: { config: { select: { name: true, seats: { orderBy: { seatIndex: "asc" }, select: { seatIndex: true, label: true, field: true, isNewMember: true, expert: { select: { panelCode: true } }, modelProfile: { select: { label: true } } } } } }, ratings: true, results: true },
    }),
    prisma.ahpSession.findMany({ where: { versionId: { in: ids } }, orderBy: { createdAt: "asc" }, include: { config: { select: { name: true } }, matrices: { orderBy: [{ level: "asc" }, { parentCode: "asc" }, { seatIndex: "asc" }, { attempt: "asc" }] }, weights: true, sensitivity: true } }),
    prisma.assessment.findMany({ where: { versionId: { in: ids } }, orderBy: { createdAt: "asc" }, include: { scores: true } }),
    prisma.institutionProfile.findMany({ orderBy: { createdAt: "asc" } }),
    prisma.pilotRun.findMany({ where: { versionId: { in: ids } }, orderBy: { createdAt: "asc" } }),
    prisma.pilotDeclaration.findMany({ where: { versionId: { in: ids } }, orderBy: { createdAt: "asc" } }),
    prisma.recomputeCheck.findMany({ where: { versionId: { in: ids } }, orderBy: { createdAt: "asc" } }),
    prisma.modelCall.findMany({ where: { versionId: { in: ids } }, orderBy: { createdAt: "asc" } }),
  ]);
  const indicatorCode = new Map(domains.flatMap((d) => d.aspects.flatMap((a) => a.indicators.map((i) => [i.id, i.code] as const))));

  // Live evaluations next to the stored gate records (the record is the decision; the evaluation shows why).
  const evaluations: Record<string, Record<string, { passed: boolean; unmet: string[]; warnings: string[] }>> = {};
  for (const v of lineage) {
    const e = await Promise.all([
      evaluateBaselineGate(await getArtifactSnapshot(v.id)),
      evaluateFgdGateFor(v.id),
      evaluateDelphiGateFor(v.id),
      evaluateContentLockFor(v.id),
      evaluateAhpGateFor(v.id),
      evaluateScoringGateFor(v.id),
      evaluatePilotGateFor(v.id),
    ]);
    evaluations[v.id] = Object.fromEntries(GATE_ORDER.map((g, i) => [g, { passed: e[i].passed, unmet: e[i].unmet, warnings: e[i].warnings }]));
  }

  return { lineage, domains, changeLog, gates, evaluations, fgd, delphi, ahp, assessments, profiles, pilots, declarations, recompute, calls, indicatorCode };
}

export type ReportData = Awaited<ReturnType<typeof loadReportData>>;
