"use client";

import { FormDialog } from "@/components/molecules/form-dialog";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Field, FieldDescription, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { NativeSelect, NativeSelectOption } from "@/components/ui/native-select";
import { Textarea } from "@/components/ui/textarea";
import type { ActionResult } from "@/lib/action-result";
import { EXPERT_FIELDS, type ExpertField } from "@/lib/panel/presets";
import { useT } from "@/lib/i18n/client";

export interface ExpertValues {
  id?: string;
  panelCode: string;
  displayName: string | null;
  field: ExpertField;
  affiliation: string | null;
  coiDeclared: boolean;
  coiNote: string | null;
  inFgd: boolean;
  inDelphi: boolean;
  inAhp: boolean;
}

export function ExpertDialog({
  expert,
  action,
}: {
  expert?: ExpertValues;
  action: (state: ActionResult<unknown> | null, formData: FormData) => Promise<ActionResult<unknown> | null>;
}) {
  const t = useT();
  const id = expert?.id ?? "new";
  const check = (name: "coiDeclared" | "inFgd" | "inDelphi" | "inAhp", label: string) => (
    <label className="flex items-center gap-2 text-sm">
      <Checkbox name={name} value="true" defaultChecked={expert?.[name] ?? false} />
      {label}
    </label>
  );
  return (
    <FormDialog
      title={expert ? t("panelAdmin.experts.editTitle", { code: expert.panelCode }) : t("panelAdmin.experts.newTitle")}
      trigger={<Button variant={expert ? "ghost" : "default"} size="sm">{expert ? t("panelAdmin.edit") : t("panelAdmin.experts.add")}</Button>}
      action={action}
    >
      {expert?.id ? <input type="hidden" name="id" value={expert.id} /> : null}
      <div className="grid gap-4 sm:grid-cols-2">
        <Field>
          <FieldLabel htmlFor={`${id}-code`}>{t("panelAdmin.experts.panelCode")}</FieldLabel>
          <Input id={`${id}-code`} name="panelCode" required defaultValue={expert?.panelCode} autoComplete="off" />
          <FieldDescription>{t("panelAdmin.experts.panelCodeHint")}</FieldDescription>
        </Field>
        <Field>
          <FieldLabel htmlFor={`${id}-field`}>{t("panelAdmin.experts.field")}</FieldLabel>
          <NativeSelect id={`${id}-field`} name="field" defaultValue={expert?.field ?? "IT_GOVERNANCE"} className="w-full">
            {EXPERT_FIELDS.map((f) => (
              <NativeSelectOption key={f} value={f}>
                {t(`enums.${f}`)}
              </NativeSelectOption>
            ))}
          </NativeSelect>
        </Field>
        <Field>
          <FieldLabel htmlFor={`${id}-name`}>{t("panelAdmin.experts.displayName")}</FieldLabel>
          <Input id={`${id}-name`} name="displayName" defaultValue={expert?.displayName ?? ""} autoComplete="off" />
        </Field>
        <Field>
          <FieldLabel htmlFor={`${id}-aff`}>{t("panelAdmin.experts.affiliation")}</FieldLabel>
          <Input id={`${id}-aff`} name="affiliation" defaultValue={expert?.affiliation ?? ""} autoComplete="off" />
        </Field>
      </div>
      <fieldset className="flex flex-wrap gap-4">
        <legend className="mb-2 text-sm font-medium">{t("panelAdmin.experts.participation")}</legend>
        {check("inFgd", t("panelAdmin.experts.inFgd"))}
        {check("inDelphi", t("panelAdmin.experts.inDelphi"))}
        {check("inAhp", t("panelAdmin.experts.inAhp"))}
      </fieldset>
      {check("coiDeclared", t("panelAdmin.experts.coi"))}
      <Field>
        <FieldLabel htmlFor={`${id}-coi`}>{t("panelAdmin.experts.coiNote")}</FieldLabel>
        <Textarea id={`${id}-coi`} name="coiNote" defaultValue={expert?.coiNote ?? ""} />
      </Field>
    </FormDialog>
  );
}
