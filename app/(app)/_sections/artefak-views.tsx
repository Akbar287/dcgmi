import { AddIndicatorDialog } from "@/components/organisms/artifact-edit/add-indicator-dialog";
import { GroupEditList } from "@/components/organisms/artifact-edit/group-edit-list";
import { VersionCompare } from "@/components/organisms/version-compare/version-compare";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { diffVersions } from "@/lib/artifact/diff";
import { can } from "@/lib/auth/roles";
import { db } from "@/lib/db/client";
import { getDiffIndicators } from "@/lib/db/repository/artifact";
import { listRevisionTasks } from "@/lib/db/repository/version-derive";
import type { Translator } from "@/lib/i18n";

import { addIndicatorAction, compareVersionsAction, updateGroupAction } from "../artefak/artifact-actions";
import type { SectionContext } from "./types";

/** Editing tools appear only on DRAFT versions for `artifact:write` (A1.0 stays frozen). */
async function editableVersion({ user, versionId }: SectionContext) {
  if (!versionId || !can(user.role, "artifact:write")) return null;
  const prisma = await db();
  const v = await prisma.artifactVersion.findUnique({ where: { id: versionId }, select: { id: true, status: true } });
  return v?.status === "DRAFT" ? v.id : null;
}

async function taskOptions(versionId: string, t: Translator, codes?: Set<string>) {
  return (await listRevisionTasks(versionId))
    .filter((r) => !codes || codes.has(r.targetCode))
    .map((r) => ({ id: r.id, label: `${r.appliedAt ? "✓ " : ""}${r.targetCode} · ${r.stage} · Pakar ${r.seatIndex} · ${t.maybe(`enums.${r.action}`) ?? r.action}: ${r.quote.slice(0, 70)}` }));
}

export async function AddIndicatorView(ctx: SectionContext) {
  const versionId = await editableVersion(ctx);
  if (!versionId) return null;
  const prisma = await db();
  const aspects = await prisma.aspect.findMany({
    where: { domain: { versionId } },
    orderBy: [{ domain: { order: "asc" } }, { order: "asc" }],
    include: { domain: { select: { code: true } } },
  });
  return (
    <AddIndicatorDialog
      aspects={aspects.map((a) => ({ id: a.id, label: `${a.domain.code} / ${a.code} — ${a.name}` }))}
      tasks={await taskOptions(versionId, ctx.t)}
      action={addIndicatorAction}
    />
  );
}

export async function GroupEditView(ctx: SectionContext, type: "Domain" | "Aspect") {
  const versionId = await editableVersion(ctx);
  if (!versionId) return null;
  const prisma = await db();
  const rows =
    type === "Domain"
      ? (await prisma.domain.findMany({ where: { versionId }, orderBy: { order: "asc" } })).map((d) => ({ id: d.id, code: d.code, name: d.name, rationale: d.rationale, sdgTags: d.sdgTags }))
      : (await prisma.aspect.findMany({ where: { domain: { versionId } }, orderBy: [{ domain: { order: "asc" } }, { order: "asc" }] })).map((a) => ({
          id: a.id,
          code: a.code,
          name: a.name,
          rationale: a.rationale,
        }));
  return (
    <GroupEditList type={type} rows={rows} tasks={await taskOptions(versionId, ctx.t, new Set(rows.map((r) => r.code)))} action={updateGroupAction} />
  );
}

export async function CompareView({ t, versionId }: SectionContext) {
  const prisma = await db();
  const versions = await prisma.artifactVersion.findMany({ orderBy: { createdAt: "asc" }, select: { id: true, label: true, parentId: true } });
  if (versions.length < 2) return <p className="text-sm text-muted-foreground">{t("compare.needTwo")}</p>;
  const to = versions.find((v) => v.id === versionId) ?? versions[versions.length - 1];
  const from = versions.find((v) => v.id === to.parentId) ?? versions.find((v) => v.id !== to.id)!;
  const entries = diffVersions(await getDiffIndicators(from.id), await getDiffIndicators(to.id));
  return (
    <Card>
      <CardHeader>
        <CardTitle>
          {from.label} → {to.label}
        </CardTitle>
        <CardDescription>{t("nav.sections.artefak.bandingkan")}</CardDescription>
      </CardHeader>
      <CardContent>
        <VersionCompare versions={versions.map((v) => ({ id: v.id, label: v.label }))} initial={{ fromId: from.id, toId: to.id, entries }} action={compareVersionsAction} />
      </CardContent>
    </Card>
  );
}
