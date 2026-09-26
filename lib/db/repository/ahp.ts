import { METHOD } from "@/lib/method/constants";

import { db } from "../client";
import type { FlatRecord } from "../types";

export async function listAhpSessions(versionId: string): Promise<FlatRecord[]> {
  const prisma = await db();
  const rows = await prisma.ahpSession.findMany({
    where: { versionId },
    include: { config: { select: { name: true } }, _count: { select: { matrices: true, sensitivity: true } } },
  });
  return rows.map((s) => ({
    id: s.id,
    origin: s.dataOrigin,
    config: s.config.name,
    scope: s.scope,
    aggregation: s.aggregation,
    status: s.status,
    matrices: s._count.matrices,
  }));
}

export async function listAhpMatrices(versionId: string, onlyReturned = false): Promise<FlatRecord[]> {
  const prisma = await db();
  const rows = await prisma.ahpMatrix.findMany({
    where: {
      session: { versionId },
      // R1-V1.7 §3.9.2: CR >= CR_MAX goes back to the seat for review.
      ...(onlyReturned ? { OR: [{ accepted: false }, { cr: { gte: METHOD.CR_MAX } }] } : {}),
    },
    orderBy: [{ level: "asc" }, { parentCode: "asc" }, { seatIndex: "asc" }],
    include: { session: { select: { dataOrigin: true } } },
  });
  return rows.map((m) => ({
    id: m.id,
    origin: m.session.dataOrigin,
    seat: `#${m.seatIndex}`,
    level: m.level,
    parent: m.parentCode,
    size: m.size,
    lambdaMax: m.lambdaMax,
    ci: m.ci,
    cr: m.cr,
    status: m.accepted ? "ACCEPTED" : "RETURNED",
  }));
}

export async function listAhpWeights(versionId: string): Promise<FlatRecord[]> {
  const prisma = await db();
  const rows = await prisma.ahpWeight.findMany({
    where: { session: { versionId } },
    orderBy: [{ level: "asc" }, { parentCode: "asc" }, { targetCode: "asc" }],
    include: { session: { select: { dataOrigin: true } } },
  });
  return rows.map((w) => ({
    id: w.id,
    origin: w.session.dataOrigin,
    level: w.level,
    parent: w.parentCode,
    target: w.targetCode,
    // Individual seat weights stay visible next to the aggregate (§3.9.2).
    seat: w.seatIndex === null ? null : `#${w.seatIndex}`,
    weight: w.weight,
    archived: w.archived,
  }));
}

export async function listSensitivityScenarios(versionId: string): Promise<FlatRecord[]> {
  const prisma = await db();
  const rows = await prisma.sensitivityScenario.findMany({
    where: { session: { versionId } },
    include: { session: { select: { dataOrigin: true } } },
  });
  return rows.map((s) => ({
    id: s.id,
    origin: s.session.dataOrigin,
    name: s.name,
    rankChanged: s.rankChanged,
  }));
}
