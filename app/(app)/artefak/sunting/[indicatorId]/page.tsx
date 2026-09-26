import { notFound } from "next/navigation";
import Link from "next/link";

import { Notice } from "@/components/molecules/notice";
import { ContentForm, EvidenceEditor, RubricEditor, StructurePanel, type EditContext } from "@/components/organisms/indicator-editor";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { SectionTemplate } from "@/components/templates/section-template";
import { can } from "@/lib/auth/roles";
import { requirePermission } from "@/lib/auth/session";
import { getIndicatorEditor } from "@/lib/db/repository/artifact-edit";
import { listRevisionTasks } from "@/lib/db/repository/version-derive";
import { formatDateTime } from "@/lib/format";
import { getTranslator } from "@/lib/i18n/server";
import { METHOD } from "@/lib/method/constants";

import { moveIndicatorAction, saveEvidenceAction, saveRubricAction, setDeletedAction, updateContentAction } from "../../artifact-actions";

const LEVELS = Array.from({ length: METHOD.LEVEL_MAX - METHOD.LEVEL_MIN + 1 }, (_, i) => METHOD.LEVEL_MIN + i);

export default async function IndicatorEditorPage({ params, searchParams }: PageProps<"/artefak/sunting/[indicatorId]">) {
  const user = await requirePermission("console:read");
  const { indicatorId } = await params;
  const task = (await searchParams).task;
  const t = await getTranslator();
  const data = await getIndicatorEditor(indicatorId);
  if (!data) notFound();
  const { ind, version, aspects, history } = data;

  const writable = can(user.role, "artifact:write");
  const editable = writable && version.status === "DRAFT";
  const scope = new Set([ind.code, ind.aspect.code, ind.aspect.domain.code]);
  const tasks = editable ? (await listRevisionTasks(version.id)).filter((r) => scope.has(r.targetCode)) : [];
  const ctx: EditContext = {
    code: ind.code,
    exception: ind.isControlledException || METHOD.CONTROLLED_EXCEPTIONS.includes(ind.code),
    tasks: tasks.map((r) => ({
      id: r.id,
      label: `${r.appliedAt ? "✓ " : ""}${r.targetCode} · ${r.stage} · Pakar ${r.seatIndex} · ${t.maybe(`enums.${r.action}`) ?? r.action}: ${r.quote.slice(0, 70)}`,
    })),
  };
  const defaultTask = typeof task === "string" && tasks.some((r) => r.id === task) ? task : null;
  const deleted = ind.deletedAt !== null;
  const readOnlyNote = !writable ? t("editor.noWrite") : !editable ? t("editor.readOnly", { label: version.label, status: t.maybe(`enums.${version.status}`) ?? version.status }) : null;

  return (
    <SectionTemplate
      eyebrow={`${version.label} · ${ind.aspect.domain.code} / ${ind.aspect.code}`}
      title={t("editor.title", { code: ind.code })}
      description={ind.name}
      actions={
        <Link href="/artefak/indikator" className="text-sm underline underline-offset-4">
          {t("editor.back")}
        </Link>
      }
      notices={
        <>
          {readOnlyNote ? <Notice tone="locked">{readOnlyNote}</Notice> : null}
          {deleted ? <Notice tone="warning">{t("editor.deleted")}</Notice> : null}
          {ctx.exception ? <Notice tone="warning">{t("notices.controlledException")}</Notice> : null}
        </>
      }
    >
      <Card>
        <CardHeader>
          <CardTitle>{t("editor.content")}</CardTitle>
        </CardHeader>
        <CardContent>
          {editable && !deleted ? (
            <ContentForm
              value={{ id: ind.id, name: ind.name, operationalDefinition: ind.operationalDefinition, assessmentObject: ind.assessmentObject, boundaryNote: ind.boundaryNote, sources: ind.sources }}
              ctx={ctx}
              action={updateContentAction}
              defaultTask={defaultTask}
            />
          ) : (
            <dl className="grid gap-3 text-sm">
              {(["operationalDefinition", "assessmentObject", "boundaryNote"] as const).map((f) => (
                <div key={f}>
                  <dt className="font-medium">{t(`editor.${f}`)}</dt>
                  <dd className="whitespace-pre-line text-muted-foreground">{ind[f] ?? "—"}</dd>
                </div>
              ))}
            </dl>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>{t("editor.rubric")}</CardTitle>
        </CardHeader>
        <CardContent>
          <RubricEditor
            indicatorId={ind.id}
            levels={LEVELS}
            initial={ind.rubricLevels.map((r) => ({ level: r.level, label: r.label, descriptor: r.descriptor }))}
            evidence={ind.evidence}
            ctx={ctx}
            action={saveRubricAction}
            readOnly={!editable || deleted}
            defaultTask={defaultTask}
          />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>{t("editor.evidence")}</CardTitle>
        </CardHeader>
        <CardContent>
          <EvidenceEditor
            indicatorId={ind.id}
            rows={ind.evidence.map((e) => ({ id: e.id, kind: e.kind, minimumFor: e.minimumFor, mandatory: e.mandatory, description: e.description }))}
            levels={LEVELS}
            ctx={ctx}
            action={saveEvidenceAction}
            readOnly={!editable || deleted}
            defaultTask={defaultTask}
          />
        </CardContent>
      </Card>

      {editable ? (
        <Card>
          <CardHeader>
            <CardTitle>{t("editor.structure")}</CardTitle>
          </CardHeader>
          <CardContent>
            <StructurePanel
              indicatorId={ind.id}
              aspectId={ind.aspectId}
              deleted={deleted}
              aspects={aspects.map((a) => ({ id: a.id, label: `${a.domain.code} / ${a.code} — ${a.name}` }))}
              ctx={ctx}
              moveAction={moveIndicatorAction}
              deleteAction={setDeletedAction}
              defaultTask={defaultTask}
            />
          </CardContent>
        </Card>
      ) : null}

      <Card>
        <CardHeader>
          <CardTitle>{t("editor.history", { code: ind.code })}</CardTitle>
        </CardHeader>
        <CardContent>
          {history.length === 0 ? (
            <p className="text-sm text-muted-foreground">{t("editor.historyNone")}</p>
          ) : (
            <ol className="flex flex-col gap-3 text-sm">
              {history.map((h) => (
                <li key={h.id} className="border-l-2 pl-3">
                  <p>
                    <span className="font-medium">{t.maybe(`enums.${h.action}`) ?? h.action}</span> · {h.targetType} ·{" "}
                    <span className="text-muted-foreground tabular-nums">{formatDateTime(h.createdAt, t.locale)}</span>
                  </p>
                  <p>{h.reason}</p>
                  <p className="text-xs text-muted-foreground">{h.decisionSource}</p>
                  {h.impactNote ? <p className="line-clamp-3 text-xs text-muted-foreground">{h.impactNote}</p> : null}
                </li>
              ))}
            </ol>
          )}
        </CardContent>
      </Card>
    </SectionTemplate>
  );
}
