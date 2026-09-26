"use client";

import { useActionState } from "react";

import { OriginBadge } from "@/components/atoms/origin-badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { NativeSelect, NativeSelectOption } from "@/components/ui/native-select";
import { TableCell, TableRow } from "@/components/ui/table";
import type { ActionResult } from "@/lib/action-result";
import { useT } from "@/lib/i18n/client";

export interface AdoptionRowData {
  id: string;
  target: string;
  stage: string;
  seatIndex: number;
  action: string;
  quote: string;
  rationale: string;
  adopted: boolean | null;
  reason: string | null;
}

export function AdoptionRow({ row, action }: { row: AdoptionRowData; action: (s: ActionResult | null, f: FormData) => Promise<ActionResult | null> }) {
  const t = useT();
  const [state, formAction, pending] = useActionState(action, null);
  const formId = `adopt-${row.id}`;
  return (
    <TableRow>
      <TableCell>
        <OriginBadge origin="SIMULATED" />
      </TableCell>
      <TableCell>
        <div className="flex flex-col">
          <span className="font-mono text-xs">{row.target}</span>
          <span className="text-xs text-muted-foreground">{row.stage}</span>
        </div>
      </TableCell>
      <TableCell className="whitespace-nowrap">
        Pakar {row.seatIndex} · {t.maybe(`enums.${row.action}`) ?? row.action}
      </TableCell>
      <TableCell className="max-w-md text-sm">
        “{row.quote}”<p className="text-xs text-muted-foreground">{row.rationale}</p>
      </TableCell>
      <TableCell>
        <form id={formId} key={`${row.adopted}|${row.reason}`} action={formAction}>
          <input type="hidden" name="suggestionId" value={row.id} />
        </form>
        <NativeSelect form={formId} name="adopted" size="sm" defaultValue={row.adopted === null ? "" : row.adopted ? "yes" : "no"} aria-label={t("fgdSim.adoption.adopted")}>
          <NativeSelectOption value="">{t("fgdSim.adoption.undecided")}</NativeSelectOption>
          <NativeSelectOption value="yes">{t("fgdSim.adoption.yes")}</NativeSelectOption>
          <NativeSelectOption value="no">{t("fgdSim.adoption.no")}</NativeSelectOption>
        </NativeSelect>
      </TableCell>
      <TableCell>
        <Input form={formId} name="reason" defaultValue={row.reason ?? ""} placeholder={t("fgdSim.adoption.reason")} aria-label={t("fgdSim.adoption.reason")} className="min-w-48" />
        {state && !state.ok ? (
          <p role="alert" className="mt-1 text-xs text-destructive">
            {state.error.message}
          </p>
        ) : null}
      </TableCell>
      <TableCell className="text-right">
        <Button form={formId} type="submit" size="sm" variant="outline" disabled={pending}>
          {t("fgdSim.adoption.save")}
        </Button>
      </TableCell>
    </TableRow>
  );
}
