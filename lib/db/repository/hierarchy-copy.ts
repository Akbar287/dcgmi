import type { Prisma } from "@/generated/prisma/client";

import { db } from "../client";

type Tx = Prisma.TransactionClient;

type SourceDomain = Prisma.DomainGetPayload<{
  include: { aspects: { include: { indicators: { include: { rubricLevels: true; evidence: true } } } } };
}>;

/** Full copy of a hierarchy into another version; `keep` filters indicators by code. */
export async function copyHierarchy(tx: Tx, domains: SourceDomain[], versionId: string, keep: (code: string) => boolean = () => true) {
  for (const d of domains) {
    await tx.domain.create({
      data: {
        versionId,
        code: d.code,
        order: d.order,
        name: d.name,
        rationale: d.rationale,
        sdgTags: d.sdgTags,
        slrStrings: d.slrStrings,
        aspects: {
          create: d.aspects.map((a) => ({
            code: a.code,
            order: a.order,
            name: a.name,
            rationale: a.rationale,
            indicators: {
              create: a.indicators
                .filter((i) => keep(i.code))
                .map((i) => ({
                  code: i.code,
                  order: i.order,
                  name: i.name,
                  operationalDefinition: i.operationalDefinition,
                  assessmentObject: i.assessmentObject,
                  boundaryNote: i.boundaryNote,
                  sources: i.sources,
                  isControlledException: i.isControlledException,
                  exceptionNote: i.exceptionNote,
                  rubricLevels: { create: i.rubricLevels.map((r) => ({ level: r.level, label: r.label, descriptor: r.descriptor, cumulative: r.cumulative })) },
                  evidence: { create: i.evidence.map((e) => ({ kind: e.kind, minimumFor: e.minimumFor, mandatory: e.mandatory, description: e.description })) },
                })),
            },
          })),
        },
      },
    });
  }
}

/** Live hierarchy of a version, shaped for copyHierarchy. */
export async function loadHierarchyForCopy(versionId: string) {
  const prisma = await db();
  return prisma.domain.findMany({
    where: { versionId },
    orderBy: { order: "asc" },
    include: {
      aspects: {
        orderBy: { order: "asc" },
        include: { indicators: { where: { deletedAt: null }, orderBy: { order: "asc" }, include: { rubricLevels: true, evidence: true } } },
      },
    },
  });
}
