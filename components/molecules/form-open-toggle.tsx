"use client";

import { useActionState } from "react";

import { Button } from "@/components/ui/button";
import type { ActionResult } from "@/lib/action-result";
import { useT } from "@/lib/i18n/client";

type State = ActionResult | null;

export function FormOpenToggle({
  formId,
  isOpen,
  disabled,
  action,
}: {
  formId: string;
  isOpen: boolean;
  disabled: boolean;
  action: (state: State, formData: FormData) => Promise<State>;
}) {
  const t = useT();
  const [state, formAction, pending] = useActionState(action, null);
  return (
    <form action={formAction} className="flex flex-col items-start gap-1">
      <input type="hidden" name="formId" value={formId} />
      <input type="hidden" name="open" value={isOpen ? "false" : "true"} />
      <Button type="submit" variant={isOpen ? "outline" : "default"} size="sm" disabled={disabled || pending}>
        {isOpen ? t("preReview.close") : t("preReview.open")}
      </Button>
      {state && !state.ok ? (
        <p role="alert" className="max-w-md text-xs whitespace-pre-line text-destructive">
          {t.maybe(`errors.${state.error.code}`) ?? state.error.message}
          {state.error.code === "NOT_READY" ? `\n${state.error.message}` : null}
        </p>
      ) : null}
    </form>
  );
}
