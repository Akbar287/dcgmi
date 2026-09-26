import { CapForm } from "@/components/organisms/budget/cap-form";
import { PriceTable } from "@/components/organisms/budget/price-table";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { can } from "@/lib/auth/roles";
import { estimateForVersion } from "@/lib/db/repository/cost-estimate";
import { getMonthlyCap, listModelPrices, spendSummary } from "@/lib/db/repository/model-calls";
import { formatDateTime, formatNumber } from "@/lib/format";

import { refreshCatalogPricesAction, setModelPriceAction, setMonthlyCapAction } from "../settings/budget-actions";
import type { SectionContext } from "./types";

const usd = (v: number | null, locale: string) => (v === null ? "—" : `$${formatNumber(v, locale as never, 4)}`);

export async function BudgetView({ t, user }: SectionContext) {
  const [cap, summary, prices] = await Promise.all([getMonthlyCap(), spendSummary(), listModelPrices()]);
  return (
    <>
      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>{t("budget.capTitle")}</CardTitle>
          </CardHeader>
          <CardContent>
            {can(user.role, "users:manage") ? <CapForm cap={cap} action={setMonthlyCapAction} /> : <p className="text-sm">{cap === null ? "—" : usd(cap, t.locale)}</p>}
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>{t("budget.spendTitle")}</CardTitle>
            <CardDescription>
              {t("budget.spendMonth", { since: formatDateTime(summary.since, t.locale), usd: usd(summary.month, t.locale) })} · {t("budget.spendAll", { usd: usd(summary.all, t.locale) })}
            </CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col gap-3">
            {summary.unpriced ? <p className="text-sm text-warning">{t("budget.unpriced", { n: summary.unpriced })}</p> : null}
            <p className="text-sm font-medium">{t("budget.byModel")}</p>
            <ul className="flex flex-col gap-1 text-xs">
              {summary.byModel.map((m) => (
                <li key={m.modelId} className="flex justify-between gap-3">
                  <span className="font-mono">{m.modelId}</span>
                  <span className="tabular-nums text-muted-foreground">
                    {m.calls} · {m.tokensIn}/{m.tokensOut} · {usd(m.cost, t.locale)}
                  </span>
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
      </div>
      <Card>
        <CardHeader>
          <CardTitle>{t("budget.pricesTitle")}</CardTitle>
          <CardDescription>{t("budget.pricesHint")}</CardDescription>
        </CardHeader>
        <CardContent>
          <PriceTable rows={prices} action={setModelPriceAction} catalogAction={refreshCatalogPricesAction} canEdit={can(user.role, "panel:manage")} />
        </CardContent>
      </Card>
    </>
  );
}

export async function EstimatorView({ t, versionId }: SectionContext) {
  if (!versionId) return null;
  const lines = await estimateForVersion(versionId);
  return (
    <Card>
      <CardHeader>
        <CardTitle>{t("estimator.title")}</CardTitle>
        <CardDescription>{t("estimator.hint")}</CardDescription>
      </CardHeader>
      <CardContent>
        {lines.length === 0 ? (
          <p className="text-sm text-muted-foreground">{t("estimator.none")}</p>
        ) : (
          <div className="overflow-x-auto rounded-2xl border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>{t("estimator.kind")}</TableHead>
                  <TableHead>{t("estimator.panel")}</TableHead>
                  <TableHead className="text-right">{t("estimator.calls")}</TableHead>
                  <TableHead className="text-right">{t("estimator.tokens")}</TableHead>
                  <TableHead className="text-right">{t("estimator.cost")}</TableHead>
                  <TableHead>{t("estimator.source")}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {lines.map((l, i) => (
                  <TableRow key={i}>
                    <TableCell>{t(`estimator.kinds.${l.kind}`)}</TableCell>
                    <TableCell className="text-sm">{l.target}</TableCell>
                    <TableCell className="text-right tabular-nums">{l.calls}</TableCell>
                    <TableCell className="text-right tabular-nums text-xs">
                      {formatNumber(l.tokensIn, t.locale)} / {formatNumber(l.tokensOut, t.locale)}
                    </TableCell>
                    <TableCell className="text-right tabular-nums">{l.costUsd === null ? <Badge variant="destructive">{t("estimator.unpriced")}</Badge> : usd(l.costUsd, t.locale)}</TableCell>
                    <TableCell className="text-xs text-muted-foreground">{l.fromHistory ? t("estimator.history", { n: l.fromHistory }) : t("estimator.assumption")}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
