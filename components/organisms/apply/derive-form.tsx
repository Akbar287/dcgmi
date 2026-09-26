"use client";

import { ActionForm } from "@/components/molecules/action-form";
import { Field, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import type { ActionResult } from "@/lib/action-result";
import { useT } from "@/lib/i18n/client";

export function DeriveForm({ defaultLabel, action }: { defaultLabel: string; action: (s: ActionResult | null, f: FormData) => Promise<ActionResult | null> }) {
  const t = useT();
  return (
    <ActionForm action={action} submitLabel={t("apply.derive")}>
      <Field>
        <FieldLabel htmlFor="derive-label">{t("apply.label")}</FieldLabel>
        <Input id="derive-label" name="label" defaultValue={defaultLabel} required pattern="[A-Za-z0-9._\-]+" minLength={2} maxLength={60} className="max-w-xs font-mono" />
      </Field>
      <Field>
        <FieldLabel htmlFor="derive-note">{t("apply.note")}</FieldLabel>
        <Textarea id="derive-note" name="note" rows={2} maxLength={2000} />
      </Field>
    </ActionForm>
  );
}
