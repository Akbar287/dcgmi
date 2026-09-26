"use client";

import { useActionState, useTransition } from "react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import type { ActionResult } from "@/lib/action-result";
import { useT } from "@/lib/i18n/client";

export interface PriceRow {
  id: string;
  label: string;
  modelId: string;
  provider: string;
  gateway: boolean;
  input: number | null;
  output: number | null;
  source: string | null;
}

type Action = (s: ActionResult | null, f: FormData) => Promise<ActionResult | null>;

function Row({ row, action, canEdit }: { row: PriceRow; action: Action; canEdit: boolean }) {
  const t = useT();
  const [state, formAction, pending] = useActionState(action, null);
  const [transitioning, start] = useTransition();
  const formId = `price-${row.id}`;
  return (
    <TableRow>
      <TableCell>
        <span className="block">{row.label}</span>
        <span className="font-mono text-xs text-muted-foreground">
          {row.provider} · {row.modelId}
        </span>
      </TableCell>
      <TableCell>
        <form
          id={formId}
          onSubmit={(e) => {
            e.preventDefault();
            const fd = new FormData(e.currentTarget);
            start(() => formAction(fd));
          }}
        >
          <input type="hidden" name="modelProfileId" value={row.id} />
        </form>
        <Input form={formId} name="input" type="number" min="0" step="0.000001" defaultValue={row.input ?? ""} placeholder={t("budget.unknown")} aria-label={t("budget.inputPrice")} className="w-32" disabled={!canEdit} />
      </TableCell>
      <TableCell>
        <Input form={formId} name="output" type="number" min="0" step="0.000001" defaultValue={row.output ?? ""} placeholder={t("budget.unknown")} aria-label={t("budget.outputPrice")} className="w-32" disabled={!canEdit} />
      </TableCell>
      <TableCell>{row.source ? <Badge variant="secondary">{row.source}</Badge> : <span className="text-xs text-muted-foreground">{t("budget.unknown")}</span>}</TableCell>
      <TableCell className="text-right">
        {canEdit ? (
          <Button form={formId} type="submit" size="sm" variant="outline" disabled={pending || transitioning}>
            {t("budget.savePrice")}
          </Button>
        ) : null}
        {state && !state.ok ? (
          <p role="alert" className="mt-1 text-xs text-destructive">
            {state.error.message}
          </p>
        ) : null}
      </TableCell>
    </TableRow>
  );
}

export function PriceTable({
  rows,
  action,
  catalogAction,
  canEdit,
}: {
  rows: PriceRow[];
  action: Action;
  catalogAction: (s: ActionResult<number> | null) => Promise<ActionResult<number> | null>;
  canEdit: boolean;
}) {
  const t = useT();
  const [state, formAction, pending] = useActionState(catalogAction, null);
  return (
    <div className="flex flex-col gap-3">
      {canEdit && rows.some((r) => r.gateway) ? (
        <form action={formAction} className="flex flex-wrap items-center gap-3">
          <Button type="submit" variant="outline" size="sm" disabled={pending}>
            {t("budget.fetchCatalog")}
          </Button>
          {state?.ok ? <span className="text-sm text-muted-foreground">{t("budget.fetched", { n: state.data })}</span> : null}
          {state && !state.ok ? <span className="text-sm text-destructive">{state.error.message}</span> : null}
        </form>
      ) : null}
      <div className="overflow-x-auto rounded-2xl border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>{t("columns.model")}</TableHead>
              <TableHead>{t("budget.inputPrice")}</TableHead>
              <TableHead>{t("budget.outputPrice")}</TableHead>
              <TableHead>{t("columns.decisionSource")}</TableHead>
              <TableHead>
                <span className="sr-only">{t("budget.savePrice")}</span>
              </TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.map((r) => (
              <Row key={r.id} row={r} action={action} canEdit={canEdit} />
            ))}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
