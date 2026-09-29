import { CheckmarkCircle02Icon, CancelCircleIcon } from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";

import Link from "next/link";

import { ActionForm } from "@/components/molecules/action-form";
import { BudgetField } from "@/components/molecules/budget-field";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { can } from "@/lib/auth/roles";
import { db } from "@/lib/db/client";
import { evaluateAcceptance } from "@/lib/db/repository/acceptance";
import { listReportJobs } from "@/lib/db/repository/report-jobs";
import { formatDateTime } from "@/lib/format";
import { NAV_MODULES } from "@/lib/navigation";

import { createReportAction } from "../audit/report-actions";
import { SECTIONS } from "./registry";
import type { SectionContext, SectionDef } from "./types";

const link = "rounded-4xl border px-3 py-1 text-xs font-medium hover:bg-muted";

export async function ExportView({ t, user }: SectionContext) {
  const prisma = await db();
  const history = await prisma.auditEvent.findMany({ where: { action: { startsWith: "EXPORT_" } }, orderBy: { createdAt: "desc" }, take: 20 });
  const groups = NAV_MODULES.map((m) => ({
    key: m.key,
    tables: (m.sections as readonly string[]).filter((slug) => {
      const def = (SECTIONS[m.key] as Record<string, SectionDef>)[slug];
      return def?.view.kind === "table" && (!def.permission || can(user.role, def.permission));
    }),
  })).filter((g) => g.tables.length);
  return (
    <>
      <Card>
        <CardHeader>
          <CardTitle>{t("exports.title")}</CardTitle>
          <CardDescription>{t("exports.hint")}</CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-4">
          {groups.map((g) => (
            <div key={g.key}>
              <p className="mb-2 text-sm font-medium">{t(`nav.modules.${g.key}`)}</p>
              <ul className="grid gap-2 sm:grid-cols-2 xl:grid-cols-3">
                {g.tables.map((slug) => (
                  <li key={slug} className="flex items-center justify-between gap-2 rounded-xl border px-3 py-2 text-sm">
                    <span className="truncate">{t.maybe(`nav.sections.${g.key}.${slug}`) ?? slug}</span>
                    <span className="flex gap-1">
                      {(["csv", "xlsx", "json", "pdf"] as const).map((f) => (
                        <a key={f} className={link} href={`/api/export/table?module=${g.key}&section=${slug}&format=${f}`} download>
                          {f.toUpperCase()}
                        </a>
                      ))}
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </CardContent>
      </Card>
      <Card>
        <CardHeader>
          <CardTitle>{t("exports.special")}</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-wrap gap-2">
          <a className={link} href="/api/export/recompute" download>
            {t("exports.recompute")}
          </a>
          <a className={link} href="/api/export/reproduction" download>
            {t("exports.reproduction")}
          </a>
        </CardContent>
      </Card>
      <Card>
        <CardHeader>
          <CardTitle>{t("exports.history")}</CardTitle>
        </CardHeader>
        <CardContent>
          {history.length === 0 ? (
            <p className="text-sm text-muted-foreground">{t("exports.historyNone")}</p>
          ) : (
            <ul className="flex flex-col gap-1 text-xs">
              {history.map((h) => {
                const p = (h.payload ?? {}) as { filename?: string; format?: string };
                return (
                  <li key={h.id} className="flex flex-wrap justify-between gap-2">
                    <span className="font-mono">{p.filename ?? h.targetId}</span>
                    <span className="text-muted-foreground tabular-nums">
                      {h.action} · {formatDateTime(h.createdAt, t.locale)}
                    </span>
                  </li>
                );
              })}
            </ul>
          )}
        </CardContent>
      </Card>
    </>
  );
}

export async function ReproductionView({ t, user, versionId }: SectionContext) {
  const criteria = await evaluateAcceptance(versionId);
  const ready = criteria.every((c) => c.ok);
  const reports = versionId ? await listReportJobs(versionId) : [];
  return (
    <>
      <Card>
        <CardHeader>
          <CardTitle>{t("report.cardTitle")}</CardTitle>
          <CardDescription>{t("report.cardHint")}</CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-3">
          {can(user.role, "simulation:run") ? (
            <ActionForm action={createReportAction} submitLabel={t("report.create")}>
              <BudgetField id="report-budget" />
            </ActionForm>
          ) : null}
          {reports.length ? (
            <ul className="flex flex-col gap-1 text-sm">
              {reports.map((r) => (
                <li key={r.id} className="flex flex-wrap justify-between gap-2">
                  <Link href={`/audit/laporan/${r.id}`} className="underline underline-offset-4">
                    {formatDateTime(r.createdAt, t.locale)}
                  </Link>
                  <span className="text-xs text-muted-foreground">
                    {t.maybe(`report.status.${r.status}`) ?? r.status}
                    {r.pages ? ` · ${r.pages} hlm.` : ""}
                  </span>
                </li>
              ))}
            </ul>
          ) : null}
        </CardContent>
      </Card>
      <Card>
        <CardHeader>
          <CardTitle>{t("acceptance.packageTitle")}</CardTitle>
          <CardDescription>{t("acceptance.packageHint")}</CardDescription>
        </CardHeader>
        <CardContent>
          <a className={link} href="/api/export/reproduction" download>
            {t("exports.reproduction")}
          </a>
        </CardContent>
      </Card>
      <Card>
        <CardHeader>
          <CardTitle>{t("acceptance.title")}</CardTitle>
          <CardDescription>{ready ? t("acceptance.ready") : t("acceptance.notReady")}</CardDescription>
        </CardHeader>
        <CardContent>
          <ol className="flex flex-col gap-3">
            {criteria.map((c) => (
              <li key={c.n} className="flex gap-3">
                <HugeiconsIcon icon={c.ok ? CheckmarkCircle02Icon : CancelCircleIcon} strokeWidth={2} className={c.ok ? "mt-0.5 size-5 shrink-0 text-success" : "mt-0.5 size-5 shrink-0 text-destructive"} aria-label={c.ok ? t("common.yes") : t("common.no")} />
                <div className="flex flex-col">
                  <span className="text-sm font-medium">
                    {c.n}. {t(`acceptance.c${c.n}` as "acceptance.c1")}
                  </span>
                  <span className="text-xs text-muted-foreground">{c.detail}</span>
                </div>
              </li>
            ))}
          </ol>
        </CardContent>
      </Card>
    </>
  );
}
