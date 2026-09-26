import { db } from "../client";
import { copyHierarchy } from "./hierarchy-copy";
import { recordEvaluation } from "./gates";
import { evaluateFgdGateFor } from "./fgd-gate";

/** Next free label: bump the trailing number (A1.0 → A1.1), else append -A1.1. */
export function suggestDerivedLabel(label: string, taken: Set<string>) {
  const bump = (l: string) => (/\d+$/.test(l) ? l.replace(/\d+$/, (n) => String(Number(n) + 1)) : `${l}-A1.1`);
  let next = bump(label);
  while (taken.has(next)) next = bump(next);
  return next;
}

export class DeriveError extends Error {
  constructor(readonly code: "GATE" | "CONFLICT" | "NOT_FOUND", message: string) {
    super(message);
    this.name = "DeriveError";
  }
}

/**
 * "Terapkan ke A1.1" (SPECIFICATION §4.5): after G2 passes on the version the
 * FGD discussed, a DRAFT child is created as a full copy. Structure changes
 * happen afterwards in the child, one logged edit at a time; the parent stays
 * frozen. Adopted suggestions become the child's revision task list.
 */
export async function createDerivedVersion(actorId: string, parentId: string, label: string, note: string | null) {
  const prisma = await db();
  const g2 = await prisma.gateRecord.findUnique({ where: { versionId_gate: { versionId: parentId, gate: "G2_FGD" } } });
  if (g2?.status !== "PASSED") throw new DeriveError("GATE", "G2_FGD versi induk belum diluluskan Admin.");
  if (await prisma.artifactVersion.findUnique({ where: { label }, select: { id: true } })) throw new DeriveError("CONFLICT", `Label ${label} sudah dipakai.`);

  const parent = await prisma.artifactVersion.findUniqueOrThrow({
    where: { id: parentId },
    include: {
      domains: {
        orderBy: { order: "asc" },
        include: {
          aspects: {
            orderBy: { order: "asc" },
            include: { indicators: { where: { deletedAt: null }, orderBy: { order: "asc" }, include: { rubricLevels: true, evidence: true } } },
          },
        },
      },
    },
  });

  const childId = await prisma.$transaction(
    async (tx) => {
      const child = await tx.artifactVersion.create({ data: { label, status: "DRAFT", parentId, note } });
      await copyHierarchy(tx, parent.domains, child.id);
      await tx.changeLogEntry.create({
        data: {
          versionId: child.id,
          targetType: "ArtifactVersion",
          targetCode: label,
          action: "TAMBAH",
          reason: `Versi turunan dari ${parent.label} setelah G2_FGD diluluskan.`,
          decisionSource: `G2_FGD ${parent.label} PASSED ${g2.decidedAt?.toISOString() ?? ""}`.trim(),
          impactNote: "Salinan penuh; perubahan dilakukan per suntingan tercatat di versi ini.",
          actorId,
        },
      });
      await tx.auditEvent.create({ data: { actorId, actorKind: "USER", action: "VERSION_DERIVE", targetType: "ArtifactVersion", targetId: child.id, payload: { parent: parent.label, label } } });
      return child.id;
    },
    { timeout: 120_000 },
  );
  await recordEvaluation(childId, "G1_BASELINE", `Evaluasi otomatis saat ${label} diturunkan dari ${parent.label}.`);
  return childId;
}

/** Adopted suggestions of the parent's counted FGD results, as the child's revision tasks. */
export async function listRevisionTasks(childId: string) {
  const prisma = await db();
  const child = await prisma.artifactVersion.findUnique({ where: { id: childId }, select: { parentId: true } });
  if (!child?.parentId) return [];
  const { counted } = await evaluateFgdGateFor(child.parentId);
  const rows = await prisma.fgdSuggestion.findMany({
    where: { adopted: true, itemId: { in: counted } },
    include: { item: { select: { targetType: true, targetCode: true, title: true, stage: { select: { title: true } } } } },
    orderBy: [{ item: { targetCode: "asc" } }, { seatIndex: "asc" }],
  });
  return rows.map((s) => ({
    id: s.id,
    stage: s.item.stage.title,
    targetType: s.item.targetType,
    targetCode: s.item.targetCode,
    title: s.item.title,
    seatIndex: s.seatIndex,
    action: s.action,
    quote: s.quote,
    rationale: s.rationale,
    appliedAt: s.appliedAt?.toISOString() ?? null,
    appliedNote: s.appliedNote,
  }));
}

export async function markRevisionTask(actorId: string, suggestionId: string, note: string | null, done: boolean) {
  const prisma = await db();
  await prisma.$transaction([
    prisma.fgdSuggestion.update({
      where: { id: suggestionId },
      data: done ? { appliedAt: new Date(), appliedById: actorId, appliedNote: note } : { appliedAt: null, appliedById: null, appliedNote: null },
    }),
    prisma.auditEvent.create({ data: { actorId, actorKind: "USER", action: done ? "REVISION_TASK_DONE" : "REVISION_TASK_REOPENED", targetType: "FgdSuggestion", targetId: suggestionId, payload: {} } }),
  ]);
}
