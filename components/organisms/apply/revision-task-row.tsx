"use client";

import Link from "next/link";

import { ActionForm } from "@/components/molecules/action-form";
import { OriginBadge } from "@/components/atoms/origin-badge";
import { Input } from "@/components/ui/input";
import { TableCell, TableRow } from "@/components/ui/table";
import type { ActionResult } from "@/lib/action-result";
import { useT } from "@/lib/i18n/client";

export interface RevisionTaskView {
  id: string;
  targetCode: string;
  stage: string;
  seatIndex: number;
  action: string;
  quote: string;
  rationale: string;
  appliedLabel: string | null;
  appliedNote: string | null;
  editHref: string | null;
}

export function RevisionTaskRow({ row, action, canWrite }: { row: RevisionTaskView; action: (s: ActionResult | null, f: FormData) => Promise<ActionResult | null>; canWrite: boolean }) {
  const t = useT();
  const done = row.appliedLabel !== null;
  return (
    <TableRow>
      <TableCell>
        <OriginBadge origin="SIMULATED" />
      </TableCell>
      <TableCell>
        <div className="flex flex-col">
          <span className="font-mono text-xs">{row.targetCode}</span>
          <span className="text-xs text-muted-foreground">{row.stage}</span>
        </div>
      </TableCell>
      <TableCell className="whitespace-nowrap">
        Pakar {row.seatIndex} · {t.maybe(`enums.${row.action}`) ?? row.action}
      </TableCell>
      <TableCell className="max-w-md text-sm">
        “{row.quote}”<p className="text-xs text-muted-foreground">{row.rationale}</p>
      </TableCell>
      <TableCell className="text-sm">
        {done ? (
          <span>
            {t("apply.done")} · {row.appliedLabel}
            {row.appliedNote ? <span className="block text-xs text-muted-foreground">{row.appliedNote}</span> : null}
          </span>
        ) : (
          <span className="text-muted-foreground">—</span>
        )}
      </TableCell>
      <TableCell className="min-w-56">
        <div className="flex flex-col gap-2">
          {row.editHref && canWrite ? (
            <Link href={row.editHref} className="text-sm underline underline-offset-4">
              {t("apply.edit")}
            </Link>
          ) : null}
          {canWrite ? (
            <ActionForm action={action} submitLabel={done ? t("apply.reopen") : t("apply.markDone")} submitVariant="outline">
              <input type="hidden" name="suggestionId" value={row.id} />
              <input type="hidden" name="done" value={done ? "0" : "1"} />
              {done ? null : <Input name="note" placeholder={t("apply.note")} aria-label={t("apply.note")} maxLength={1000} />}
            </ActionForm>
          ) : null}
        </div>
      </TableCell>
    </TableRow>
  );
}
