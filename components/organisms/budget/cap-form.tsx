"use client";

import { ActionForm } from "@/components/molecules/action-form";
import { Field, FieldDescription, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import type { ActionResult } from "@/lib/action-result";
import { useT } from "@/lib/i18n/client";

export function CapForm({ cap, action }: { cap: number | null; action: (s: ActionResult | null, f: FormData) => Promise<ActionResult | null> }) {
  const t = useT();
  return (
    <ActionForm action={action} submitLabel={t("budget.capSave")} successLabel={t("editor.saved")}>
      <Field className="max-w-xs">
        <FieldLabel htmlFor="cap">{t("budget.capLabel")}</FieldLabel>
        <Input id="cap" name="cap" type="number" min="0.01" step="0.01" defaultValue={cap ?? ""} inputMode="decimal" />
        <FieldDescription>{t("budget.capHint")}</FieldDescription>
      </Field>
    </ActionForm>
  );
}
