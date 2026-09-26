import type { ReactNode } from "react";

import { StatusBadge } from "@/components/atoms/status-badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { formatDateTime } from "@/lib/format";
import { getTranslator } from "@/lib/i18n/server";
import type { GateEvaluation } from "@/lib/method/gates";

const VISIBLE = 8;

function CodeList({ items, more }: { items: string[]; more: (n: number) => string }) {
  return (
    <ul className="flex flex-col gap-1 font-mono text-xs">
      {items.slice(0, VISIBLE).map((item) => (
        <li key={item} className="break-all">
          {item}
        </li>
      ))}
      {items.length > VISIBLE ? <li className="text-muted-foreground">{more(items.length - VISIBLE)}</li> : null}
    </ul>
  );
}

export async function GateEvaluationCard({
  evaluation,
  title,
  recordStatus,
  decidedAt,
  action,
}: {
  evaluation: GateEvaluation;
  title: string;
  /** Stored GateRecord status; distinct from the live evaluation below. */
  recordStatus: string;
  decidedAt: string | null;
  action?: ReactNode;
}) {
  const t = await getTranslator();
  const more = (n: number) => t("dashboard.moreItems", { n });

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex flex-wrap items-center gap-2">
          {title}
          <StatusBadge
            value={evaluation.passed ? "ACCEPTED" : "FAILED"}
            label={evaluation.passed ? t("dashboard.conditionsMet") : t("dashboard.conditionsUnmet")}
          />
          <StatusBadge
            value={recordStatus}
            label={`${t("dashboard.gateStatus")}: ${t.maybe(`enums.${recordStatus}`) ?? recordStatus}`}
          />
        </CardTitle>
        <CardDescription>
          {t("dashboard.baselineGateHint")}
          {recordStatus === "PASSED" && decidedAt ? ` · ${t("dashboard.passedAt", { time: formatDateTime(decidedAt, t.locale) })}` : null}
          {recordStatus !== "PASSED" && evaluation.passed ? ` · ${t("dashboard.pendingAdmin")}` : null}
        </CardDescription>
      </CardHeader>
      <CardContent className="grid gap-4 md:grid-cols-2">
        <div className="flex flex-col gap-2">
          <h3 className="text-sm font-medium">
            {t("dashboard.unmet")} ({evaluation.unmet.length})
          </h3>
          {evaluation.unmet.length === 0 ? (
            <p className="text-sm text-muted-foreground">{t("dashboard.allMet")}</p>
          ) : (
            <CodeList items={evaluation.unmet} more={more} />
          )}
        </div>
        <div className="flex flex-col gap-2">
          <h3 className="text-sm font-medium">
            {t("dashboard.warnings")} ({evaluation.warnings.length})
          </h3>
          {evaluation.warnings.length === 0 ? (
            <p className="text-sm text-muted-foreground">{t("common.none")}</p>
          ) : (
            <CodeList items={evaluation.warnings} more={more} />
          )}
        </div>
        {action ? <div className="md:col-span-2">{action}</div> : null}
      </CardContent>
    </Card>
  );
}
