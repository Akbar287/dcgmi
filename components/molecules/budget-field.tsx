"use client";

import { Field, FieldDescription, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { useT } from "@/lib/i18n/client";

/** Optional session budget in USD (docs/04 §9); calls that would exceed it are refused. */
export function BudgetField({ id }: { id: string }) {
  const t = useT();
  return (
    <Field className="max-w-xs">
      <FieldLabel htmlFor={id}>{t("budget.sessionLabel")}</FieldLabel>
      <Input id={id} name="budget" type="number" min="0.0001" step="0.0001" inputMode="decimal" placeholder="—" />
      <FieldDescription>{t("budget.sessionHint")}</FieldDescription>
    </Field>
  );
}
