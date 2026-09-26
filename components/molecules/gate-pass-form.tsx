"use client";

import { useActionState } from "react";

import { Button } from "@/components/ui/button";
import { Field, FieldDescription, FieldError, FieldLabel } from "@/components/ui/field";
import { Textarea } from "@/components/ui/textarea";
import type { ActionResult } from "@/lib/action-result";
import { useT } from "@/lib/i18n/client";

type State = ActionResult | null;

export function GatePassForm({
  gate,
  gateLabel,
  action,
}: {
  gate: string;
  gateLabel: string;
  action: (state: State, formData: FormData) => Promise<State>;
}) {
  const t = useT();
  const [state, formAction, pending] = useActionState(action, null);
  const unmet = state && !state.ok && Array.isArray(state.error.details) ? (state.error.details as string[]) : [];
  return (
    <form action={formAction} className="flex flex-col gap-3 rounded-xl border p-4">
      <input type="hidden" name="gate" value={gate} />
      <Field>
        <FieldLabel htmlFor={`pass-${gate}`}>{t("dashboard.passNote")}</FieldLabel>
        <Textarea id={`pass-${gate}`} name="note" required minLength={10} maxLength={2000} />
        <FieldDescription>{t("dashboard.passNoteHint")}</FieldDescription>
      </Field>
      {state && !state.ok ? (
        <FieldError>
          {t.maybe(`errors.${state.error.code}`) ?? state.error.message}
          {unmet.length > 0 ? ` (${unmet.slice(0, 3).join(", ")}${unmet.length > 3 ? "…" : ""})` : null}
        </FieldError>
      ) : null}
      <Button type="submit" disabled={pending} className="self-start">
        {t("dashboard.passGate", { gate: gateLabel })}
      </Button>
    </form>
  );
}
