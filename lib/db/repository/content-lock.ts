import { evaluateContentLockGate, type ContentLockItem } from "@/lib/method/gates";
import type { DelphiDecision } from "@/lib/method/types";

import { db } from "../client";
import { latestFinalizedResults } from "./delphi-gate";
import { copyHierarchy, loadHierarchyForCopy } from "./hierarchy-copy";

export class LockError extends Error {
  constructor(
    readonly code: "GATE" | "CONFLICT",
    message: string,
    readonly details?: string[],
  ) {
    super(message);
    this.name = "LockError";
  }
}

/** Latest finalized Delphi decision per live indicator of the Delphi version. */
async function gatherContentLockInput(versionId: string) {
  const prisma = await db();
  const [g3, openDelphiRounds, indicators, aspects, results] = await Promise.all([
    prisma.gateRecord.findUnique({ where: { versionId_gate: { versionId, gate: "G3_DELPHI" } } }),
    prisma.delphiRound.count({ where: { versionId, finalizedAt: null } }),
    prisma.indicator.findMany({
      where: { aspect: { domain: { versionId } }, deletedAt: null },
      orderBy: [{ aspect: { domain: { order: "asc" } } }, { aspect: { order: "asc" } }, { order: "asc" }],
      select: { code: true, aspect: { select: { code: true, domain: { select: { code: true } } } } },
    }),
    prisma.aspect.findMany({ where: { domain: { versionId } }, orderBy: [{ domain: { order: "asc" } }, { order: "asc" }], select: { code: true, domain: { select: { code: true } } } }),
    latestFinalizedResults(versionId),
  ]);
  const latest = new Map<string, (typeof results)[number]>();
  for (const r of results) {
    const prior = latest.get(r.code);
    if (!prior || r.roundNumber > prior.roundNumber) latest.set(r.code, r);
  }
  const items: ContentLockItem[] = indicators.map((i) => ({
    code: i.code,
    domainCode: i.aspect.domain.code,
    aspectCode: i.aspect.code,
    latestDecision: (latest.get(i.code)?.decision as DelphiDecision | undefined) ?? null,
  }));
  return {
    input: { g3Passed: g3?.status === "PASSED", openDelphiRounds, items, aspects: aspects.map((a) => ({ domainCode: a.domain.code, code: a.code })) },
    latest,
  };
}

/**
 * G4 for any version: a CONTENT_LOCKED version is locked by definition; any
 * other version is evaluated as the source of a lock (docs/05 §6).
 */
export async function evaluateContentLockFor(versionId: string) {
  const prisma = await db();
  const version = await prisma.artifactVersion.findUniqueOrThrow({ where: { id: versionId }, select: { status: true, parent: { select: { label: true } } } });
  if (version.status === "CONTENT_LOCKED") {
    return { gate: "G4_CONTENT_LOCK" as const, passed: true, unmet: [], warnings: [`LOCKED_FROM: ${version.parent?.label ?? "—"}`], kept: [], excluded: [] };
  }
  return evaluateContentLockGate((await gatherContentLockInput(versionId)).input);
}

export function lockedLabel(source: string, taken: Set<string>) {
  let next = /A\d+\.\d+$/.test(source) ? source.replace(/A\d+\.\d+$/, "A2.0") : `${source}-A2.0`;
  while (taken.has(next)) next = next.replace(/(\d+)$/, (n) => String(Number(n) + 1));
  return next;
}

/**
 * Content lock (SPECIFICATION §3 G4, researcher decision 2026-09-26): a new
 * CONTENT_LOCKED version copied from the Delphi version without the items
 * Tabel 3.6 takes out of the core. This button is the Admin's explicit
 * decision (P7): G4 is PASSED on the locked version, and G1–G3 are recorded
 * as inherited from the source. The source is frozen (PROVISIONAL).
 */
export async function lockContent(actorId: string, sourceId: string, label: string, note: string) {
  const prisma = await db();
  const source = await prisma.artifactVersion.findUniqueOrThrow({ where: { id: sourceId }, include: { gates: true } });
  if (source.status !== "DRAFT") throw new LockError("GATE", `${source.label} bukan versi DRAF.`, ["SOURCE_NOT_DRAFT"]);
  const { input, latest } = await gatherContentLockInput(sourceId);
  const evaluation = evaluateContentLockGate(input);
  if (!evaluation.passed) throw new LockError("GATE", "Syarat content lock belum terpenuhi.", evaluation.unmet);
  if (await prisma.artifactVersion.findUnique({ where: { label }, select: { id: true } })) throw new LockError("CONFLICT", `Label ${label} sudah dipakai.`);

  const domains = await loadHierarchyForCopy(sourceId);
  const kept = new Set(evaluation.kept);
  const now = new Date();
  const lockedId = await prisma.$transaction(
    async (tx) => {
      const locked = await tx.artifactVersion.create({ data: { label, status: "CONTENT_LOCKED", parentId: sourceId, note, contentLockedAt: now } });
      await copyHierarchy(tx, domains, locked.id, (code) => kept.has(code));
      await tx.changeLogEntry.create({
        data: {
          versionId: locked.id,
          targetType: "ArtifactVersion",
          targetCode: label,
          action: "TAMBAH",
          reason: `Content lock dari ${source.label}.`,
          decisionSource: `G3_DELPHI ${source.label} PASSED; keputusan Admin: ${note}`,
          impactNote: evaluation.warnings.join(" | "),
          actorId,
        },
      });
      for (const ex of evaluation.excluded) {
        const r = latest.get(ex.code);
        await tx.changeLogEntry.create({
          data: {
            versionId: locked.id,
            targetType: "Indicator",
            targetCode: ex.code,
            action: "HAPUS",
            reason: `Tidak ikut ke instrumen inti: ${ex.decision} (Delphi R${r?.roundNumber ?? "?"}).`,
            decisionSource: `Delphi ${source.label} R${r?.roundNumber ?? "?"} ${ex.decision}`,
            impactNote: r?.researcherNote ?? r?.reason ?? null,
            actorId,
          },
        });
      }
      for (const gate of ["G1_BASELINE", "G2_FGD", "G3_DELPHI"]) {
        const g = source.gates.find((x) => x.gate === gate);
        await tx.gateRecord.create({
          data: { versionId: locked.id, gate, status: "PASSED", unmet: [], warnings: [`INHERITED_FROM: ${source.label}`], decidedById: actorId, decidedAt: now, note: `Diwarisi dari ${source.label} (PASSED ${g?.decidedAt?.toISOString() ?? "?"}).` },
        });
      }
      await tx.gateRecord.create({
        data: { versionId: locked.id, gate: "G4_CONTENT_LOCK", status: "PASSED", unmet: [], warnings: evaluation.warnings, decidedById: actorId, decidedAt: now, note },
      });
      await tx.artifactVersion.update({ where: { id: sourceId }, data: { status: "PROVISIONAL" } });
      await tx.auditEvent.create({
        data: { actorId, actorKind: "USER", action: "CONTENT_LOCK", targetType: "ArtifactVersion", targetId: locked.id, payload: { source: source.label, label, kept: evaluation.kept.length, excluded: evaluation.excluded.map((e) => e.code), note } },
      });
      return locked.id;
    },
    { timeout: 120_000 },
  );
  return lockedId;
}
