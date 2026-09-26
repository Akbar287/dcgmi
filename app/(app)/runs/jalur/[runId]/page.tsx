import Link from "next/link";
import { notFound } from "next/navigation";

import { StatusBadge } from "@/components/atoms/status-badge";
import { Notice } from "@/components/molecules/notice";
import { RunRunner } from "@/components/organisms/pipeline/run-runner";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { SectionTemplate } from "@/components/templates/section-template";
import { requirePermission } from "@/lib/auth/session";
import { getRunView } from "@/lib/db/repository/pipeline";
import { formatDateTime, formatNumber } from "@/lib/format";
import { getTranslator } from "@/lib/i18n/server";

import { activateVersionAndGo } from "../../../actions";
import { advanceRunAction, runControlAction } from "../../pipeline-actions";

/** Where the researcher or Admin acts on a wait (docs/06). */
function waitHref(reason: string, refType: string | null, refId: string | null) {
  if (reason.endsWith("G1_BASELINE")) return "/";
  if (reason.endsWith("G2_FGD")) return "/fgd/terapkan";
  if (reason.endsWith("FGD_SPECIAL")) return refId ? `/fgd/ruang/${refId}` : "/fgd/ruang";
  if (reason.endsWith("FGD_ADOPTION")) return "/fgd/revisi";
  if (reason.endsWith("DELPHI_REVIEW")) return refType === "DelphiRound" && refId ? `/delphi/ronde/${refId}` : "/delphi/ronde";
  if (reason.endsWith("DELPHI_REVISE")) return "/artefak/indikator";
  if (reason.endsWith("G3_DELPHI") || reason.endsWith("G4_CONTENT_LOCK")) return "/delphi/ringkasan";
  if (reason.endsWith("G5_AHP")) return "/ahp/konfigurasi";
  if (reason.endsWith("RECOMPUTE_AND_G6") || reason.endsWith("G6_SCORING")) return "/scoring/profil";
  return null;
}

export default async function RunPage({ params }: PageProps<"/runs/jalur/[runId]">) {
  await requirePermission("simulation:run");
  const { runId } = await params;
  const t = await getTranslator();
  const view = await getRunView(runId);
  if (!view) notFound();
  const { run, versions, calls } = view;
  const usd = (v: number) => `$${formatNumber(v, t.locale, 4)}`;
  const budget = run.budgetUsd === null ? null : Number(run.budgetUsd);
  const spent = Number(run.spentUsd);

  return (
    <SectionTemplate
      eyebrow={t("nav.modules.runs")}
      title={run.name}
      description={t("pipeline.cost", { spent: usd(spent), budget: budget === null ? t("pipeline.noBudget") : usd(budget), calls })}
      actions={
        <Link href="/runs/daftar" className="text-sm underline underline-offset-4">
          {t("nav.sections.runs.daftar")}
        </Link>
      }
      notices={<Notice tone="warning">{t("banner.simulatedDetail")}</Notice>}
    >
      <Card>
        <CardContent className="flex flex-col gap-3 pt-6">
          <div className="flex flex-wrap items-center gap-3">
            <StatusBadge value={run.status} label={t.maybe(`enums.${run.status}`) ?? run.status} />
            <span className="text-xs text-muted-foreground">{t.maybe(`enums.${run.mode}`) ?? run.mode}</span>
            {budget !== null ? (
              <div className="h-2 w-48 overflow-hidden rounded-full bg-muted" role="img" aria-label={`${usd(spent)} / ${usd(budget)}`}>
                <div className="h-full bg-primary" style={{ width: `${Math.min(100, (spent / budget) * 100)}%` }} />
              </div>
            ) : null}
          </div>
          {run.error ? <Notice tone="warning">{run.error}</Notice> : null}
          <RunRunner runId={run.id} status={run.status} mode={run.mode} advanceAction={advanceRunAction} controlAction={runControlAction} />
        </CardContent>
      </Card>
      <Card>
        <CardHeader>
          <CardTitle>{t("pipeline.timeline")}</CardTitle>
        </CardHeader>
        <CardContent>
          <ol className="flex flex-col gap-3">
            {run.steps.map((s) => {
              const href = s.waitReason ? waitHref(s.waitReason, s.refType, s.refId) : null;
              const wait = s.waitReason ? (t.maybe(`pipeline.waits.${s.waitReason}`) ?? s.waitReason) : null;
              return (
                <li key={s.id} className="flex flex-col gap-1 rounded-xl border p-3">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="text-sm font-medium tabular-nums">{s.order + 1}.</span>
                    <span className="text-sm font-medium">{t.maybe(`pipeline.steps.${s.label}`) ?? s.label}</span>
                    <StatusBadge value={s.status} label={t.maybe(`enums.${s.status}`) ?? s.status} />
                    <span className="font-mono text-xs text-muted-foreground">{s.gateChecked}</span>
                    <span className="ml-auto text-xs tabular-nums text-muted-foreground">
                      {s.tokensIn}/{s.tokensOut} · {usd(Number(s.costUsd))}
                    </span>
                  </div>
                  {s.versionId ? <span className="text-xs text-muted-foreground">{t("pipeline.working", { version: versions.get(s.versionId) ?? s.versionId })}</span> : null}
                  {s.startedAt ? (
                    <span className="text-xs text-muted-foreground tabular-nums">
                      {formatDateTime(s.startedAt, t.locale)}
                      {s.endedAt ? ` → ${formatDateTime(s.endedAt, t.locale)}` : ""}
                    </span>
                  ) : null}
                  {wait && s.status !== "COMPLETED" ? (
                    <div className="flex flex-wrap items-center gap-3 rounded-lg bg-warning/10 px-3 py-2 text-sm">
                      <span>{wait}</span>
                      {href && s.versionId ? (
                        <form action={activateVersionAndGo}>
                          <input type="hidden" name="versionId" value={s.versionId} />
                          <input type="hidden" name="href" value={href} />
                          <Button type="submit" size="sm" variant="outline">
                            {t("pipeline.goTo")}
                          </Button>
                        </form>
                      ) : null}
                    </div>
                  ) : null}
                  {s.error ? <span className="text-xs text-destructive">{s.error}</span> : null}
                </li>
              );
            })}
          </ol>
        </CardContent>
      </Card>
    </SectionTemplate>
  );
}
