"use client";

import { ActionForm } from "@/components/molecules/action-form";
import { Field, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import type { ActionResult } from "@/lib/action-result";
import { useT } from "@/lib/i18n/client";

export function LockForm({ defaultLabel, action }: { defaultLabel: string; action: (s: ActionResult | null, f: FormData) => Promise<ActionResult | null> }) {
  const t = useT();
  return (
    <ActionForm action={action} submitLabel={t("lock.submit")} className="rounded-xl border p-4">
      <Field>
        <FieldLabel htmlFor="lock-label">{t("lock.label")}</FieldLabel>
        <Input id="lock-label" name="label" defaultValue={defaultLabel} required pattern="[A-Za-z0-9._\-]+" className="max-w-xs font-mono" />
      </Field>
      <Field>
        <FieldLabel htmlFor="lock-note">{t("lock.note")}</FieldLabel>
        <Textarea id="lock-note" name="note" required minLength={10} maxLength={2000} rows={2} />
      </Field>
    </ActionForm>
  );
}
