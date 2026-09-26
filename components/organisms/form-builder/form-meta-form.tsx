"use client";

import { ActionForm } from "@/components/molecules/action-form";
import { Field, FieldDescription, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { NativeSelect, NativeSelectOption } from "@/components/ui/native-select";
import { Textarea } from "@/components/ui/textarea";
import type { ActionResult } from "@/lib/action-result";
import { useT } from "@/lib/i18n/client";

export const STAGE_TAGS = ["BASELINE", "FGD", "DELPHI_CVI", "CONTENT_LOCK", "AHP", "SCORING", "PILOT"] as const;

export function StageSelect({ id, defaultValue }: { id: string; defaultValue: string | null }) {
  const t = useT();
  return (
    <NativeSelect id={id} name="stageTag" defaultValue={defaultValue ?? ""} className="w-full">
      <NativeSelectOption value="">{t("builder.stageNone")}</NativeSelectOption>
      {STAGE_TAGS.map((s) => (
        <NativeSelectOption key={s} value={s}>
          {t.maybe(`process.stages.${s}.title`) ?? s}
        </NativeSelectOption>
      ))}
    </NativeSelect>
  );
}

export function FormMetaForm({
  form,
  action,
}: {
  form: { id: string; title: string; purpose: string; instructions: string | null; stageTag: string | null; respondents: string[] };
  action: (s: ActionResult | null, f: FormData) => Promise<ActionResult | null>;
}) {
  const t = useT();
  return (
    <ActionForm action={action} submitLabel={t("builder.saveMeta")} successLabel={t("editor.saved")}>
      <input type="hidden" name="formId" value={form.id} />
      <div className="grid gap-3 md:grid-cols-2">
        <Field>
          <FieldLabel htmlFor="fm-title">{t("builder.title")}</FieldLabel>
          <Input id="fm-title" name="title" defaultValue={form.title} required minLength={3} maxLength={200} />
        </Field>
        <Field>
          <FieldLabel htmlFor="fm-stage">{t("builder.stageTag")}</FieldLabel>
          <StageSelect id="fm-stage" defaultValue={form.stageTag} />
        </Field>
      </div>
      <Field>
        <FieldLabel htmlFor="fm-purpose">{t("builder.purpose")}</FieldLabel>
        <Input id="fm-purpose" name="purpose" defaultValue={form.purpose} required minLength={3} maxLength={1000} />
      </Field>
      <Field>
        <FieldLabel htmlFor="fm-instr">{t("builder.instructions")}</FieldLabel>
        <Textarea id="fm-instr" name="instructions" defaultValue={form.instructions ?? ""} rows={3} />
      </Field>
      <Field>
        <FieldLabel htmlFor="fm-resp">{t("builder.respondents")}</FieldLabel>
        <Textarea id="fm-resp" name="respondents" defaultValue={form.respondents.join("\n")} rows={3} className="font-mono text-xs" />
        <FieldDescription>{t("builder.respondentsHint")}</FieldDescription>
      </Field>
    </ActionForm>
  );
}

export function CreateFormForm({ action }: { action: (s: ActionResult | null, f: FormData) => Promise<ActionResult | null> }) {
  const t = useT();
  return (
    <ActionForm action={action} submitLabel={t("builder.create")}>
      <div className="grid gap-3 md:grid-cols-3">
        <Field>
          <FieldLabel htmlFor="cf-slug">{t("builder.slug")}</FieldLabel>
          <Input id="cf-slug" name="slug" required pattern="[a-z0-9][a-z0-9\-]{2,60}" className="font-mono" />
          <FieldDescription>{t("builder.slugHint")}</FieldDescription>
        </Field>
        <Field>
          <FieldLabel htmlFor="cf-title">{t("builder.title")}</FieldLabel>
          <Input id="cf-title" name="title" required minLength={3} maxLength={200} />
        </Field>
        <Field>
          <FieldLabel htmlFor="cf-stage">{t("builder.stageTag")}</FieldLabel>
          <StageSelect id="cf-stage" defaultValue={null} />
        </Field>
      </div>
      <Field>
        <FieldLabel htmlFor="cf-purpose">{t("builder.purpose")}</FieldLabel>
        <Input id="cf-purpose" name="purpose" required minLength={3} maxLength={1000} />
      </Field>
    </ActionForm>
  );
}
