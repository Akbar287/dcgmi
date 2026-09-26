"use client";

import { ActionForm } from "@/components/molecules/action-form";
import { Field, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import type { ActionResult } from "@/lib/action-result";
import { useT } from "@/lib/i18n/client";

import { EditMetaFields, type EditContext } from "./edit-meta-fields";

type Action = (s: ActionResult<unknown> | null, f: FormData) => Promise<ActionResult<unknown> | null>;

export interface IndicatorContent {
  id: string;
  name: string;
  operationalDefinition: string | null;
  assessmentObject: string | null;
  boundaryNote: string | null;
  sources: string[];
}

export function ContentForm({ value, ctx, action, defaultTask }: { value: IndicatorContent; ctx: EditContext; action: Action; defaultTask?: string | null }) {
  const t = useT();
  const area = (name: "operationalDefinition" | "assessmentObject" | "boundaryNote", rows = 4) => (
    <Field>
      <FieldLabel htmlFor={`content-${name}`}>{t(`editor.${name}`)}</FieldLabel>
      <Textarea id={`content-${name}`} name={name} defaultValue={value[name] ?? ""} rows={rows} maxLength={4000} />
    </Field>
  );
  return (
    <ActionForm action={action} submitLabel={t("editor.save")} successLabel={t("editor.saved")}>
      <input type="hidden" name="indicatorId" value={value.id} />
      <Field>
        <FieldLabel htmlFor="content-name">{t("editor.name")}</FieldLabel>
        <Input id="content-name" name="name" defaultValue={value.name} required minLength={3} maxLength={500} />
      </Field>
      {area("operationalDefinition", 5)}
      {area("assessmentObject", 3)}
      {area("boundaryNote", 3)}
      <Field>
        <FieldLabel htmlFor="content-sources">{t("editor.sources")}</FieldLabel>
        <Textarea id="content-sources" name="sources" defaultValue={value.sources.join("\n")} rows={3} />
      </Field>
      <EditMetaFields ctx={ctx} idPrefix="content" defaultTask={defaultTask} />
    </ActionForm>
  );
}
