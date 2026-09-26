"use client";

import { ActionForm } from "@/components/molecules/action-form";
import { Field, FieldDescription, FieldLabel } from "@/components/ui/field";
import { NativeSelect, NativeSelectOption } from "@/components/ui/native-select";
import type { ActionResult } from "@/lib/action-result";
import { useT } from "@/lib/i18n/client";

import { EditMetaFields, type EditContext } from "./edit-meta-fields";

type Action = (s: ActionResult<unknown> | null, f: FormData) => Promise<ActionResult<unknown> | null>;

export function StructurePanel({
  indicatorId,
  aspectId,
  deleted,
  aspects,
  ctx,
  moveAction,
  deleteAction,
  defaultTask,
}: {
  indicatorId: string;
  aspectId: string;
  deleted: boolean;
  aspects: { id: string; label: string }[];
  ctx: EditContext;
  moveAction: Action;
  deleteAction: Action;
  defaultTask?: string | null;
}) {
  const t = useT();
  return (
    <div className="grid gap-4 lg:grid-cols-2">
      {deleted ? null : (
        <ActionForm action={moveAction} submitLabel={t("editor.moveAction")} submitVariant="outline" className="rounded-xl border p-3">
          <input type="hidden" name="indicatorId" value={indicatorId} />
          <Field>
            <FieldLabel htmlFor="move-target">{t("editor.move")}</FieldLabel>
            <NativeSelect id="move-target" name="targetAspectId" defaultValue={aspectId} className="w-full">
              {aspects.map((a) => (
                <NativeSelectOption key={a.id} value={a.id}>
                  {a.label}
                </NativeSelectOption>
              ))}
            </NativeSelect>
          </Field>
          <EditMetaFields ctx={ctx} idPrefix="move" defaultTask={defaultTask} />
        </ActionForm>
      )}
      <ActionForm
        action={deleteAction}
        submitLabel={deleted ? t("editor.restore") : t("editor.remove")}
        submitVariant={deleted ? "outline" : "destructive"}
        className="rounded-xl border p-3"
      >
        <input type="hidden" name="indicatorId" value={indicatorId} />
        <input type="hidden" name="deleted" value={deleted ? "0" : "1"} />
        <FieldDescription>{t("editor.removeHint")}</FieldDescription>
        <EditMetaFields ctx={ctx} idPrefix="delete" defaultTask={defaultTask} />
      </ActionForm>
    </div>
  );
}
