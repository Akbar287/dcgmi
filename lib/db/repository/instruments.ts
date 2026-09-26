import { db } from "../client";
import { iso, type FlatRecord } from "../types";

export async function listForms(): Promise<FlatRecord[]> {
  const prisma = await db();
  const rows = await prisma.form.findMany({
    orderBy: { createdAt: "desc" },
    include: { _count: { select: { sections: true, responses: true } } },
  });
  return rows.map((f) => ({
    id: f.id,
    slug: f.slug,
    title: f.title,
    version: f.versionLabel,
    stageTag: f.stageTag,
    status: f.status,
    sections: f._count.sections,
    responses: f._count.responses,
    createdAt: iso(f.createdAt),
  }));
}

export async function listFormResponses(): Promise<FlatRecord[]> {
  const prisma = await db();
  const rows = await prisma.formResponse.findMany({
    orderBy: { submittedAt: "desc" },
    include: { form: { select: { slug: true } } },
  });
  return rows.map((r) => ({
    id: r.id,
    origin: r.dataOrigin,
    slug: r.form.slug,
    respondent: r.respondentRef,
    completed: r.completed,
    submittedAt: iso(r.submittedAt),
  }));
}
