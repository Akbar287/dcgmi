"use client";

import { Checkbox } from "@/components/ui/checkbox";
import { Field, FieldDescription, FieldLabel } from "@/components/ui/field";
import { NativeSelect, NativeSelectOption } from "@/components/ui/native-select";
import { Textarea } from "@/components/ui/textarea";
import { useT } from "@/lib/i18n/client";

export interface RevisionTaskOption {
  id: string;
  label: string;
}

export interface EditContext {
  code: string;
  exception: boolean;
  tasks: RevisionTaskOption[];
}

/**
 * Fields every artifact edit carries: the reason (ChangeLogEntry), the revision
 * task it implements, and for C20b/C42 the two-layer controlled-exception guard.
 */
export function EditMetaFields({ ctx, idPrefix, defaultTask }: { ctx: EditContext; idPrefix: string; defaultTask?: string | null }) {
  const t = useT();
  return (
    <div className="grid gap-3 rounded-xl border border-dashed p-3">
      <Field>
        <FieldLabel htmlFor={`${idPrefix}-reason`}>{t("editor.reason")}</FieldLabel>
        <Textarea id={`${idPrefix}-reason`} name="reason" required minLength={5} maxLength={2000} rows={2} />
        <FieldDescription>{t("editor.reasonHint")}</FieldDescription>
      </Field>
      {ctx.tasks.length > 0 ? (
        <Field>
          <FieldLabel htmlFor={`${idPrefix}-task`}>{t("editor.task")}</FieldLabel>
          <NativeSelect id={`${idPrefix}-task`} name="suggestionId" defaultValue={defaultTask ?? ""} className="w-full">
            <NativeSelectOption value="">{t("editor.taskNone")}</NativeSelectOption>
            {ctx.tasks.map((task) => (
              <NativeSelectOption key={task.id} value={task.id}>
                {task.label}
              </NativeSelectOption>
            ))}
          </NativeSelect>
        </Field>
      ) : null}
      {ctx.exception ? (
        <div className="grid gap-3 rounded-lg border border-warning/40 bg-warning/5 p-3">
          <p className="text-sm font-medium">{t("editor.exceptionTitle")}</p>
          <p className="text-sm text-muted-foreground">{t("editor.exceptionBody", { code: ctx.code })}</p>
          <label className="flex items-start gap-2 text-sm">
            <Checkbox name="exceptionAck" required className="mt-0.5" />
            {t("editor.exceptionAck")}
          </label>
          <Field>
            <FieldLabel htmlFor={`${idPrefix}-exc`}>{t("editor.exceptionDecision")}</FieldLabel>
            <Textarea id={`${idPrefix}-exc`} name="exceptionDecision" required minLength={10} maxLength={2000} rows={2} />
          </Field>
        </div>
      ) : null}
    </div>
  );
}
