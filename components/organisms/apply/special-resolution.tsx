"use client";

import { ActionForm } from "@/components/molecules/action-form";
import { Field, FieldLabel } from "@/components/ui/field";
import { Textarea } from "@/components/ui/textarea";
import type { ActionResult } from "@/lib/action-result";
import { useT } from "@/lib/i18n/client";

type Action = (s: ActionResult | null, f: FormData) => Promise<ActionResult | null>;

export interface SpecialRow {
  id: string;
  stage: string;
  title: string;
  tallyText: string;
  note: string | null;
  resolutionNote: string | null;
  resolvedLabel: string | null;
}

export function SpecialResolution({ row, action, canWrite }: { row: SpecialRow; action: Action; canWrite: boolean }) {
  const t = useT();
  return (
    <li className="flex flex-col gap-2 rounded-xl border p-3">
      <div className="flex flex-col">
        <span className="text-sm font-medium">{row.title}</span>
        <span className="text-xs text-muted-foreground">
          {row.stage} · {row.tallyText}
        </span>
        {row.note ? <span className="text-xs text-muted-foreground">{row.note}</span> : null}
      </div>
      {row.resolvedLabel ? <p className="text-xs text-muted-foreground">{row.resolvedLabel}</p> : null}
      {canWrite ? (
        <ActionForm action={action} submitLabel={t("apply.resolve")} submitVariant="outline" successLabel={t("editor.saved")}>
          <input type="hidden" name="decisionId" value={row.id} />
          <Field>
            <FieldLabel htmlFor={`res-${row.id}`}>{t("apply.resolution")}</FieldLabel>
            <Textarea id={`res-${row.id}`} name="note" defaultValue={row.resolutionNote ?? ""} required minLength={10} maxLength={4000} rows={3} />
          </Field>
        </ActionForm>
      ) : row.resolutionNote ? (
        <p className="text-sm whitespace-pre-line">{row.resolutionNote}</p>
      ) : null}
    </li>
  );
}
