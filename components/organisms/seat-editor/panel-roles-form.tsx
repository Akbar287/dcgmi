"use client";

import { useActionState } from "react";

import { Button } from "@/components/ui/button";
import { Field, FieldError, FieldLabel } from "@/components/ui/field";
import { NativeSelect, NativeSelectOption } from "@/components/ui/native-select";
import type { ActionResult } from "@/lib/action-result";
import { useT } from "@/lib/i18n/client";

export function PanelRolesForm({
  configId,
  facilitatorModelId,
  notetakerModelId,
  models,
  action,
}: {
  configId: string;
  facilitatorModelId: string | null;
  notetakerModelId: string | null;
  models: { id: string; label: string }[];
  action: (state: ActionResult | null, formData: FormData) => Promise<ActionResult | null>;
}) {
  const t = useT();
  const [state, formAction, pending] = useActionState(action, null);
  const select = (name: string, label: string, value: string | null) => (
    <Field>
      <FieldLabel htmlFor={`${configId}-${name}`}>{label}</FieldLabel>
      <NativeSelect id={`${configId}-${name}`} name={name} defaultValue={value ?? ""} size="sm" className="w-full">
        <NativeSelectOption value="">—</NativeSelectOption>
        {models.map((m) => (
          <NativeSelectOption key={m.id} value={m.id}>
            {m.label}
          </NativeSelectOption>
        ))}
      </NativeSelect>
    </Field>
  );
  return (
    <form key={`${facilitatorModelId}|${notetakerModelId}`} action={formAction} className="grid gap-3 rounded-xl border p-3 md:grid-cols-[1fr_1fr_auto] md:items-end">
      <input type="hidden" name="configId" value={configId} />
      <p className="text-sm font-medium md:col-span-3">{t("gateway.rolesTitle")}</p>
      {select("facilitatorModelId", t("gateway.facilitator"), facilitatorModelId)}
      {select("notetakerModelId", t("gateway.notetaker"), notetakerModelId)}
      <Button type="submit" size="sm" variant="outline" disabled={pending}>
        {t("panelAdmin.save")}
      </Button>
      {state && !state.ok ? <FieldError className="md:col-span-3">{state.error.message}</FieldError> : null}
    </form>
  );
}
