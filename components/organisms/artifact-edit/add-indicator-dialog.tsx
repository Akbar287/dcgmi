"use client";

import { FormDialog } from "@/components/molecules/form-dialog";
import { EditMetaFields, type RevisionTaskOption } from "@/components/organisms/indicator-editor/edit-meta-fields";
import { Button } from "@/components/ui/button";
import { Field, FieldDescription, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { NativeSelect, NativeSelectOption } from "@/components/ui/native-select";
import { Textarea } from "@/components/ui/textarea";
import type { ActionResult } from "@/lib/action-result";
import { useT } from "@/lib/i18n/client";

type Action = (s: ActionResult<unknown> | null, f: FormData) => Promise<ActionResult<unknown> | null>;

export function AddIndicatorDialog({ aspects, tasks, action }: { aspects: { id: string; label: string }[]; tasks: RevisionTaskOption[]; action: Action }) {
  const t = useT();
  return (
    <FormDialog title={t("editor.addIndicator")} trigger={<Button className="self-start">{t("editor.addIndicator")}</Button>} action={action}>
      <Field>
        <FieldLabel htmlFor="add-aspect">{t("editor.aspect")}</FieldLabel>
        <NativeSelect id="add-aspect" name="aspectId" required className="w-full">
          {aspects.map((a) => (
            <NativeSelectOption key={a.id} value={a.id}>
              {a.label}
            </NativeSelectOption>
          ))}
        </NativeSelect>
      </Field>
      <Field>
        <FieldLabel htmlFor="add-code">{t("editor.code")}</FieldLabel>
        <Input id="add-code" name="code" required pattern="C\d{2,3}[a-z]?" placeholder="C44" className="w-32 font-mono" />
        <FieldDescription>{t("editor.addIndicatorHint")}</FieldDescription>
      </Field>
      <Field>
        <FieldLabel htmlFor="add-name">{t("editor.name")}</FieldLabel>
        <Input id="add-name" name="name" required minLength={3} maxLength={500} />
      </Field>
      <Field>
        <FieldLabel htmlFor="add-def">{t("editor.operationalDefinition")}</FieldLabel>
        <Textarea id="add-def" name="operationalDefinition" rows={3} maxLength={4000} />
      </Field>
      <EditMetaFields ctx={{ code: "", exception: false, tasks }} idPrefix="add" />
    </FormDialog>
  );
}
