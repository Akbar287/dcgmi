"use client";

import { useActionState, useTransition } from "react";

import { FractionValue } from "@/components/atoms/fraction-value";
import { StatusBadge } from "@/components/atoms/status-badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { NativeSelect, NativeSelectOption } from "@/components/ui/native-select";
import { TableCell, TableRow } from "@/components/ui/table";
import type { ActionResult } from "@/lib/action-result";
import { formatNumber } from "@/lib/format";
import { useT } from "@/lib/i18n/client";

export interface ReviewRowData {
  resultId: string;
  code: string;
  name: string;
  iCvi: number;
  validRaters: number;
  median: number;
  iqr: number;
  decision: string;
  reason: string | null;
  clarityFlags: number;
  clarityNotes: string[];
  clarityCritical: boolean | null;
  constructConflict: boolean;
  researcherNote: string | null;
}

export function ItemReviewRow({
  row,
  canReview,
  action,
}: {
  row: ReviewRowData;
  canReview: boolean;
  action: (s: ActionResult<string> | null, f: FormData) => Promise<ActionResult<string> | null>;
}) {
  const t = useT();
  const [state, formAction, pending] = useActionState(action, null);
  const [transitioning, start] = useTransition();
  const formId = `review-${row.resultId}`;
  const busy = pending || transitioning;
  return (
    <TableRow>
      <TableCell>
        <div className="flex flex-col">
          <span className="font-mono text-xs">{row.code}</span>
          <span className="line-clamp-2 max-w-56 text-xs text-muted-foreground">{row.name}</span>
        </div>
      </TableCell>
      <TableCell>
        <FractionValue value={row.iCvi} denominator={row.validRaters} locale={t.locale} digits={3} />
      </TableCell>
      <TableCell className="tabular-nums">{formatNumber(row.median, t.locale, 1)}</TableCell>
      <TableCell className="tabular-nums">{formatNumber(row.iqr, t.locale, 2)}</TableCell>
      <TableCell>
        <StatusBadge value={row.decision} label={t.maybe(`enums.${row.decision}`) ?? row.decision} />
        {row.reason ? <p className="mt-1 max-w-64 text-xs text-muted-foreground">{row.reason}</p> : null}
      </TableCell>
      <TableCell className="min-w-44 text-sm">
        {row.clarityFlags === 0 ? (
          <span className="text-muted-foreground">{t("delphiSim.review.noFlags")}</span>
        ) : (
          <details>
            <summary className="cursor-pointer">{t("delphiSim.review.flags", { n: row.clarityFlags })}</summary>
            <ul className="mt-1 flex flex-col gap-1 text-xs text-muted-foreground">
              {row.clarityNotes.map((n, i) => (
                <li key={i}>{n}</li>
              ))}
            </ul>
          </details>
        )}
      </TableCell>
      <TableCell className="min-w-72">
        {canReview ? (
          <form
            id={formId}
            className="flex flex-col gap-2"
            onSubmit={(e) => {
              e.preventDefault();
              const fd = new FormData(e.currentTarget);
              start(() => formAction(fd));
            }}
          >
            <input type="hidden" name="resultId" value={row.resultId} />
            <NativeSelect
              name="clarityCritical"
              size="sm"
              aria-label={t("delphiSim.review.clarity")}
              defaultValue={row.clarityCritical === null ? "" : row.clarityCritical ? "yes" : "no"}
              required={row.clarityFlags > 0}
            >
              <NativeSelectOption value="">{row.clarityFlags > 0 ? t("delphiSim.review.unreviewed") : "—"}</NativeSelectOption>
              <NativeSelectOption value="no">{t("delphiSim.review.notCritical")}</NativeSelectOption>
              <NativeSelectOption value="yes">{t("delphiSim.review.critical")}</NativeSelectOption>
            </NativeSelect>
            <label className="flex items-center gap-2 text-xs">
              <Checkbox name="constructConflict" defaultChecked={row.constructConflict} />
              {t("delphiSim.review.conflict")}
            </label>
            <Input name="note" defaultValue={row.researcherNote ?? ""} placeholder={t("delphiSim.review.note")} aria-label={t("delphiSim.review.note")} maxLength={2000} />
            <div className="flex items-center gap-2">
              <Button type="submit" size="sm" variant="outline" disabled={busy}>
                {t("delphiSim.review.save")}
              </Button>
              {state && !state.ok ? (
                <span role="alert" className="text-xs text-destructive">
                  {state.error.message}
                </span>
              ) : null}
            </div>
          </form>
        ) : (
          <div className="flex flex-col gap-1 text-xs">
            <span>
              {t("delphiSim.review.clarity")}{" "}
              {row.clarityCritical === null ? "—" : row.clarityCritical ? t("delphiSim.review.critical") : t("delphiSim.review.notCritical")}
            </span>
            {row.constructConflict ? <span>{t("delphiSim.review.conflict")}</span> : null}
            {row.researcherNote ? <span className="text-muted-foreground">{row.researcherNote}</span> : null}
          </div>
        )}
      </TableCell>
    </TableRow>
  );
}
