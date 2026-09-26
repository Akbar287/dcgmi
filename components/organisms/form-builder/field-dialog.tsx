"use client";

import { useState } from "react";

import { FormDialog } from "@/components/molecules/form-dialog";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Field, FieldDescription, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { NativeSelect, NativeSelectOption } from "@/components/ui/native-select";
import { Textarea } from "@/components/ui/textarea";
import type { ActionResult } from "@/lib/action-result";
import { FIELD_TYPES, type FieldDef, type FieldType } from "@/lib/forms/types";
import { useT } from "@/lib/i18n/client";

type Action = (s: ActionResult | null, f: FormData) => Promise<ActionResult | null>;

export function FieldDialog({
  formId,
  sectionId,
  field,
  sections,
  action,
  trigger,
}: {
  formId: string;
  sectionId: string;
  field?: FieldDef;
  sections: { order: number; title: string }[];
  action: Action;
  trigger: React.ReactElement;
}) {
  const t = useT();
  const [type, setType] = useState<FieldType>(field?.type ?? "SHORT_TEXT");
  const [options, setOptions] = useState((field?.options ?? []).join("\n"));
  const opts = options.split("\n").map((o) => o.trim()).filter(Boolean);
  const idp = field?.id ?? `new-${sectionId}`;
  const choice = ["SINGLE_CHOICE", "MULTI_CHOICE", "DROPDOWN"].includes(type);
  return (
    <FormDialog title={field ? t("builder.editField") : t("builder.addField")} trigger={trigger} action={action}>
      <input type="hidden" name="formId" value={formId} />
      <input type="hidden" name="sectionId" value={sectionId} />
      {field ? <input type="hidden" name="fieldId" value={field.id} /> : null}
      <div className="grid gap-3 sm:grid-cols-2">
        <Field>
          <FieldLabel htmlFor={`${idp}-type`}>{t("builder.type")}</FieldLabel>
          <NativeSelect id={`${idp}-type`} name="type" value={type} onChange={(e) => setType(e.target.value as FieldType)} className="w-full">
            {FIELD_TYPES.map((ft) => (
              <NativeSelectOption key={ft} value={ft}>
                {t(`builder.types.${ft}`)}
              </NativeSelectOption>
            ))}
          </NativeSelect>
        </Field>
        <Field>
          <FieldLabel htmlFor={`${idp}-key`}>{t("builder.key")}</FieldLabel>
          <Input id={`${idp}-key`} name="key" defaultValue={field?.key ?? ""} required pattern="[a-z][a-z0-9_]{0,39}" className="font-mono" />
          <FieldDescription>{t("builder.keyHint")}</FieldDescription>
        </Field>
      </div>
      <Field>
        <FieldLabel htmlFor={`${idp}-label`}>{t("builder.label")}</FieldLabel>
        <Input id={`${idp}-label`} name="label" defaultValue={field?.label ?? ""} required maxLength={500} />
      </Field>
      <Field>
        <FieldLabel htmlFor={`${idp}-help`}>{t("builder.help")}</FieldLabel>
        <Textarea id={`${idp}-help`} name="helpText" defaultValue={field?.helpText ?? ""} rows={2} maxLength={5000} />
      </Field>
      {type !== "INFO" ? (
        <label className="flex items-center gap-2 text-sm">
          <Checkbox name="required" defaultChecked={field?.required ?? false} />
          {t("builder.required")}
        </label>
      ) : null}
      {choice ? (
        <Field>
          <FieldLabel htmlFor={`${idp}-opts`}>{t("builder.options")}</FieldLabel>
          <Textarea id={`${idp}-opts`} name="options" value={options} onChange={(e) => setOptions(e.target.value)} rows={4} />
        </Field>
      ) : null}
      {type === "LINEAR_SCALE" ? (
        <div className="grid gap-3 sm:grid-cols-4">
          <Input name="min" type="number" defaultValue={field?.config?.min ?? 1} aria-label={t("builder.scaleMin")} />
          <Input name="max" type="number" defaultValue={field?.config?.max ?? 5} aria-label={t("builder.scaleMax")} />
          <Input name="minLabel" defaultValue={field?.config?.minLabel ?? ""} placeholder={t("builder.scaleMinLabel")} aria-label={t("builder.scaleMinLabel")} />
          <Input name="maxLabel" defaultValue={field?.config?.maxLabel ?? ""} placeholder={t("builder.scaleMaxLabel")} aria-label={t("builder.scaleMaxLabel")} />
        </div>
      ) : null}
      {type === "PAIRWISE" ? (
        <Field>
          <FieldLabel htmlFor={`${idp}-el`}>{t("builder.elements")}</FieldLabel>
          <Textarea id={`${idp}-el`} name="elements" defaultValue={(field?.config?.elements ?? []).map((e) => `${e.code} ${e.label}`).join("\n")} rows={5} className="font-mono text-xs" />
        </Field>
      ) : null}
      {type === "RELEVANCE_4" ? (
        <label className="flex items-center gap-2 text-sm">
          <Checkbox name="clarity" defaultChecked={field?.config?.clarity ?? true} />
          {t("builder.clarity")}
        </label>
      ) : null}
      {(type === "SINGLE_CHOICE" || type === "DROPDOWN") && opts.length ? (
        <fieldset className="flex flex-col gap-2">
          <legend className="text-sm font-medium">{t("builder.branching")}</legend>
          {opts.map((o, i) => (
            <label key={`${o}-${i}`} className="flex items-center justify-between gap-2 text-sm">
              <span className="truncate">{o}</span>
              <NativeSelect size="sm" name={`branch-${i}`} defaultValue={field?.branching?.[o] === undefined ? "" : String(field.branching[o])}>
                <NativeSelectOption value="">{t("builder.branchNone")}</NativeSelectOption>
                {sections.map((s) => (
                  <NativeSelectOption key={s.order} value={String(s.order)}>
                    {t("builder.goTo", { n: s.order + 1 })} — {s.title}
                  </NativeSelectOption>
                ))}
                <NativeSelectOption value="SUBMIT">{t("builder.nextSubmit")}</NativeSelectOption>
              </NativeSelect>
            </label>
          ))}
        </fieldset>
      ) : null}
    </FormDialog>
  );
}

export function AddFieldButton(props: Omit<Parameters<typeof FieldDialog>[0], "trigger" | "field">) {
  const t = useT();
  return <FieldDialog {...props} trigger={<Button size="sm" variant="outline">{t("builder.addField")}</Button>} />;
}
