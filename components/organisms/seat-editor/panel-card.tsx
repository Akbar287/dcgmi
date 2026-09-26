import { Alert02Icon, Cancel01Icon } from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";

import { StatusBadge } from "@/components/atoms/status-badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import type { ActionResult } from "@/lib/action-result";
import type { PanelFinding, PanelValidation } from "@/lib/panel/composition";
import { getTranslator } from "@/lib/i18n/server";

import { SeatRow, type SeatRowData } from "./seat-row";

type Expert = { id: string; panelCode: string; field: string; personaStatus: string | null };

export async function PanelCard({
  name,
  preset,
  seats,
  validation,
  experts,
  models,
  action,
  roles,
}: {
  name: string;
  preset: string;
  seats: SeatRowData[];
  validation: PanelValidation;
  experts: Expert[];
  models: { id: string; label: string }[];
  action: (state: ActionResult | null, formData: FormData) => Promise<ActionResult | null>;
  roles?: React.ReactNode;
}) {
  const t = await getTranslator();
  const text = (f: PanelFinding) => {
    const base = t.maybe(`panelAdmin.seats.codes.${f.code}`, { detail: f.detail }) ?? `${f.code}: ${f.detail}`;
    return f.seats.length ? `${base} (kursi ${f.seats.join(", ")})` : base;
  };
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex flex-wrap items-center gap-2">
          {name}
          <StatusBadge value={validation.ready ? "PASSED" : "PENDING"} label={validation.ready ? t("panelAdmin.seats.ready") : t("panelAdmin.seats.notReady")} />
        </CardTitle>
        <CardDescription className="font-mono">{preset}</CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        {validation.issues.length > 0 || validation.warnings.length > 0 ? (
          <div className="grid gap-3 md:grid-cols-2">
            {validation.issues.length > 0 ? (
              <section className="rounded-xl border border-warning/40 bg-warning/5 p-3">
                <h3 className="mb-2 text-sm font-medium">{t("panelAdmin.seats.issues")}</h3>
                <ul className="flex flex-col gap-1 text-sm">
                  {validation.issues.map((f, i) => (
                    <li key={i} className="flex gap-2">
                      <HugeiconsIcon icon={Cancel01Icon} strokeWidth={2} aria-hidden="true" className="mt-0.5 size-4 shrink-0 text-warning" />
                      {text(f)}
                    </li>
                  ))}
                </ul>
              </section>
            ) : null}
            {validation.warnings.length > 0 ? (
              <section className="rounded-xl border p-3">
                <h3 className="mb-2 text-sm font-medium">{t("panelAdmin.seats.warnings")}</h3>
                <ul className="flex flex-col gap-1 text-sm">
                  {validation.warnings.map((f, i) => (
                    <li key={i} className="flex gap-2">
                      <HugeiconsIcon icon={Alert02Icon} strokeWidth={2} aria-hidden="true" className="mt-0.5 size-4 shrink-0 text-info" />
                      {text(f)}
                    </li>
                  ))}
                </ul>
              </section>
            ) : null}
          </div>
        ) : null}
        {roles}
        <div className="overflow-x-auto rounded-2xl border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>{t("columns.seat")}</TableHead>
                <TableHead>{t("panelAdmin.seats.expert")}</TableHead>
                <TableHead>{t("panelAdmin.seats.model")}</TableHead>
                <TableHead>{t("panelAdmin.seats.temperature")}</TableHead>
                <TableHead>{t("panelAdmin.seats.seed")}</TableHead>
                <TableHead className="text-right">
                  <span className="sr-only">{t("columns.action")}</span>
                </TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {seats.map((s) => (
                <SeatRow
                  key={s.id}
                  seat={s}
                  // Only experts of the seat's field are offered (§3.7.1 composition).
                  experts={experts.filter((e) => e.field === s.field)}
                  models={models}
                  action={action}
                />
              ))}
            </TableBody>
          </Table>
        </div>
      </CardContent>
    </Card>
  );
}
