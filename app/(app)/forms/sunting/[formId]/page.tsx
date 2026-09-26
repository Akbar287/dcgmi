import Link from "next/link";
import { notFound } from "next/navigation";

import { Notice } from "@/components/molecules/notice";
import { FormMetaForm } from "@/components/organisms/form-builder/form-meta-form";
import { SectionCard } from "@/components/organisms/form-builder/section-card";
import { StatusPanel } from "@/components/organisms/form-builder/status-panel";
import { ActionForm } from "@/components/molecules/action-form";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { SectionTemplate } from "@/components/templates/section-template";
import { can } from "@/lib/auth/roles";
import { requirePermission } from "@/lib/auth/session";
import { db } from "@/lib/db/client";
import { activationIssues, loadForm } from "@/lib/db/repository/form-builder";
import { checkStructure } from "@/lib/forms/branching";
import { getTranslator } from "@/lib/i18n/server";

import { saveFieldAction, saveSectionAction, sectionOpAction, fieldOpAction, setFormStatusAction, updateFormMetaAction } from "../../builder-actions";

const NEXT_STATUS: Record<string, ("DRAFT" | "DRY_RUN" | "HOLD" | "ACTIVE" | "CLOSED")[]> = {
  DRAFT: ["DRY_RUN", "HOLD"],
  DRY_RUN: ["DRAFT", "HOLD"],
  HOLD: ["DRAFT", "DRY_RUN", "ACTIVE"],
  ACTIVE: ["CLOSED", "HOLD"],
  CLOSED: ["ACTIVE"],
};

export default async function FormEditorPage({ params }: PageProps<"/forms/sunting/[formId]">) {
  const user = await requirePermission("console:read");
  const { formId } = await params;
  const t = await getTranslator();
  const loaded = await loadForm(formId);
  if (!loaded) notFound();
  const { row, def, settings } = loaded;
  const prisma = await db();
  const real = await prisma.formResponse.count({ where: { formId, dataOrigin: "REAL" } });
  const canWrite = can(user.role, "artifact:write");
  const lockReason = settings.kind === "DELPHI" ? "DELPHI" : real > 0 ? `${real} REAL` : !["DRAFT", "DRY_RUN", "HOLD"].includes(row.status) ? row.status : null;
  const editable = canWrite && !lockReason;
  const structure = checkStructure(def).map((i) => `${i.code}: ${i.detail}`);
  const activation = row.status === "HOLD" ? await activationIssues(formId) : structure;
  const allowed = (NEXT_STATUS[row.status] ?? []).filter((to) => (to === "ACTIVE" || to === "CLOSED" ? can(user.role, "instrument:manage") : canWrite));
  const sections = def.sections.map((s) => ({ order: s.order, title: s.title }));

  return (
    <SectionTemplate
      eyebrow={t("nav.modules.forms")}
      title={def.title}
      description={`${row.slug} · ${t.maybe(`enums.${row.status}`) ?? row.status}`}
      actions={
        <div className="flex gap-3 text-sm">
          <Link href={`/forms/lihat/${formId}`} className="underline underline-offset-4">
            {t("builder.preview")}
          </Link>
          {row.status === "DRY_RUN" ? (
            <Link href={`/forms/uji/${formId}`} className="underline underline-offset-4">
              {t("builder.tryOut")}
            </Link>
          ) : null}
          <Link href="/forms/builder" className="underline underline-offset-4">
            {t("nav.sections.forms.builder")}
          </Link>
        </div>
      }
      notices={lockReason ? <Notice tone="locked">{t("builder.lockedEdit", { reason: lockReason })}</Notice> : undefined}
    >
      <div className="grid gap-4 xl:grid-cols-[minmax(0,2fr)_minmax(0,1fr)]">
        <Card>
          <CardHeader>
            <CardTitle>{t("builder.saveMeta")}</CardTitle>
          </CardHeader>
          <CardContent>
            {editable ? (
              <FormMetaForm form={{ id: formId, title: def.title, purpose: def.purpose, instructions: def.instructions, stageTag: row.stageTag, respondents: settings.respondents }} action={updateFormMetaAction} />
            ) : (
              <dl className="grid gap-2 text-sm">
                <div><dt className="text-muted-foreground">{t("builder.purpose")}</dt><dd>{def.purpose}</dd></div>
                <div><dt className="text-muted-foreground">{t("builder.respondents")}</dt><dd className="font-mono text-xs">{settings.respondents.join(", ") || "—"}</dd></div>
              </dl>
            )}
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>{t("builder.status")}</CardTitle>
          </CardHeader>
          <CardContent>
            <StatusPanel formId={formId} status={row.status} allowed={allowed} issues={activation} action={setFormStatusAction} />
          </CardContent>
        </Card>
      </div>
      <Card>
        <CardHeader>
          <CardTitle>{t("builder.sections")}</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-4">
          {def.sections.map((s) => (
            <SectionCard key={s.id} formId={formId} section={s} sections={sections} editable={editable} saveSection={saveSectionAction} saveField={saveFieldAction} sectionOp={sectionOpAction} fieldOp={fieldOpAction} />
          ))}
          {editable ? (
            <ActionForm action={saveSectionAction} submitLabel={t("builder.addSection")} submitVariant="outline" resetOnSuccess className="rounded-2xl border border-dashed p-4">
              <input type="hidden" name="formId" value={formId} />
              <input type="hidden" name="next" value="NEXT" />
              <Input name="title" required maxLength={200} placeholder={t("builder.sectionTitle")} aria-label={t("builder.sectionTitle")} />
            </ActionForm>
          ) : null}
        </CardContent>
      </Card>
    </SectionTemplate>
  );
}
