"use client";

import { ActionForm } from "@/components/molecules/action-form";
import { FormDialog } from "@/components/molecules/form-dialog";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Field, FieldLabel } from "@/components/ui/field";
import { NativeSelect, NativeSelectOption } from "@/components/ui/native-select";
import { Textarea } from "@/components/ui/textarea";
import type { ActionResult } from "@/lib/action-result";
import { useT } from "@/lib/i18n/client";

import { EditMetaFields, type EditContext } from "./edit-meta-fields";

type Action = (s: ActionResult<unknown> | null, f: FormData) => Promise<ActionResult<unknown> | null>;

export const EVIDENCE_KINDS = ["NORMATIF", "IMPLEMENTASI", "OPERASIONAL", "HASIL", "PERBAIKAN"] as const;

export interface EvidenceRow {
  id: string;
  kind: (typeof EVIDENCE_KINDS)[number];
  minimumFor: number | null;
  mandatory: boolean;
  description: string;
}

function EvidenceFields({ row, levels, idPrefix }: { row?: EvidenceRow; levels: number[]; idPrefix: string }) {
  const t = useT();
  return (
    <>
      <div className="grid gap-3 sm:grid-cols-3">
        <Field>
          <FieldLabel htmlFor={`${idPrefix}-kind`}>{t("editor.kind")}</FieldLabel>
          <NativeSelect id={`${idPrefix}-kind`} name="kind" defaultValue={row?.kind ?? "NORMATIF"} className="w-full">
            {EVIDENCE_KINDS.map((k) => (
              <NativeSelectOption key={k} value={k}>
                {t.maybe(`enums.${k}`) ?? k}
              </NativeSelectOption>
            ))}
          </NativeSelect>
        </Field>
        <Field>
          <FieldLabel htmlFor={`${idPrefix}-min`}>{t("editor.minimumFor")}</FieldLabel>
          <NativeSelect id={`${idPrefix}-min`} name="minimumFor" defaultValue={row?.minimumFor ? String(row.minimumFor) : ""} className="w-full">
            <NativeSelectOption value="">—</NativeSelectOption>
            {levels.map((l) => (
              <NativeSelectOption key={l} value={String(l)}>
                {l}
              </NativeSelectOption>
            ))}
          </NativeSelect>
        </Field>
        <label className="flex items-center gap-2 self-end pb-2 text-sm">
          <Checkbox name="mandatory" defaultChecked={row?.mandatory ?? true} />
          {t("editor.mandatory")}
        </label>
      </div>
      <Field>
        <FieldLabel htmlFor={`${idPrefix}-desc`}>{t("editor.description")}</FieldLabel>
        <Textarea id={`${idPrefix}-desc`} name="description" defaultValue={row?.description ?? ""} required minLength={5} maxLength={2000} rows={3} />
      </Field>
    </>
  );
}

export function EvidenceEditor({
  indicatorId,
  rows,
  levels,
  ctx,
  action,
  readOnly,
  defaultTask,
}: {
  indicatorId: string;
  rows: EvidenceRow[];
  levels: number[];
  ctx: EditContext;
  action: Action;
  readOnly: boolean;
  defaultTask?: string | null;
}) {
  const t = useT();
  return (
    <div className="flex flex-col gap-3">
      {rows.length === 0 ? <p className="text-sm text-muted-foreground">{t("editor.evidenceNone")}</p> : null}
      <ul className="flex flex-col gap-2">
        {rows.map((r) => (
          <li key={r.id} className="flex flex-wrap items-start justify-between gap-3 rounded-xl border p-3">
            <div className="flex min-w-0 flex-1 flex-col gap-1">
              <span className="text-xs text-muted-foreground">
                {t.maybe(`enums.${r.kind}`) ?? r.kind} · L{r.minimumFor ?? "–"} · {r.mandatory ? t("editor.mandatory") : "—"}
              </span>
              <p className="text-sm">{r.description}</p>
            </div>
            {readOnly ? null : (
              <div className="flex gap-2">
                <FormDialog title={t("editor.editEvidence")} trigger={<Button size="sm" variant="outline">{t("editor.editEvidence")}</Button>} action={action}>
                  <input type="hidden" name="indicatorId" value={indicatorId} />
                  <input type="hidden" name="evidenceId" value={r.id} />
                  <EvidenceFields row={r} levels={levels} idPrefix={`ev-${r.id}`} />
                  <EditMetaFields ctx={ctx} idPrefix={`ev-${r.id}`} defaultTask={defaultTask} />
                </FormDialog>
                <FormDialog
                  title={t("editor.removeEvidence")}
                  trigger={<Button size="sm" variant="ghost">{t("editor.removeEvidence")}</Button>}
                  action={action}
                  submitLabel={t("editor.removeEvidence")}
                >
                  <input type="hidden" name="indicatorId" value={indicatorId} />
                  <input type="hidden" name="evidenceId" value={r.id} />
                  <input type="hidden" name="remove" value="1" />
                  <p className="text-sm text-muted-foreground">{r.description}</p>
                  <EditMetaFields ctx={ctx} idPrefix={`evrm-${r.id}`} defaultTask={defaultTask} />
                </FormDialog>
              </div>
            )}
          </li>
        ))}
      </ul>
      {readOnly ? null : (
        <details className="rounded-xl border p-3">
          <summary className="cursor-pointer text-sm font-medium">{t("editor.addEvidence")}</summary>
          <ActionForm action={action} submitLabel={t("editor.addEvidence")} resetOnSuccess className="mt-3">
            <input type="hidden" name="indicatorId" value={indicatorId} />
            <EvidenceFields levels={levels} idPrefix="ev-new" />
            <EditMetaFields ctx={ctx} idPrefix="ev-new" defaultTask={defaultTask} />
          </ActionForm>
        </details>
      )}
    </div>
  );
}
