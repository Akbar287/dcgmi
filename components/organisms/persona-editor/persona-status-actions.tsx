"use client";

import { useActionState } from "react";

import { Button } from "@/components/ui/button";
import { FieldError } from "@/components/ui/field";
import type { ActionResult } from "@/lib/action-result";
import { useT } from "@/lib/i18n/client";

type Action = (state: ActionResult<unknown> | null, formData: FormData) => Promise<ActionResult<unknown> | null>;

export function PersonaStatusActions({
  expertId,
  status,
  blocked,
  canApprove,
  action,
}: {
  expertId: string;
  status: string;
  blocked: boolean;
  canApprove: boolean;
  action: Action;
}) {
  const t = useT();
  const [state, formAction, pending] = useActionState(action, null);
  const button = (to: string, label: string, disabled: boolean, variant: "default" | "outline" | "ghost" = "outline") => (
    <Button type="submit" name="to" value={to} variant={variant} size="sm" disabled={pending || disabled}>
      {label}
    </Button>
  );
  return (
    <form action={formAction} className="flex flex-col gap-2 rounded-xl border p-4">
      <input type="hidden" name="expertId" value={expertId} />
      <div className="flex flex-wrap gap-2">
        {button("REVIEWED", t("panelAdmin.persona.markReviewed"), status !== "DRAFT")}
        {canApprove ? button("APPROVED", t("panelAdmin.persona.approve"), status !== "REVIEWED" || blocked, "default") : null}
        {canApprove ? button("RETIRED", t("panelAdmin.persona.retire"), status === "RETIRED", "ghost") : null}
      </div>
      {!canApprove ? <p className="text-xs text-muted-foreground">{t("panelAdmin.persona.adminOnly")}</p> : null}
      {state && !state.ok ? <FieldError>{state.error.message}</FieldError> : null}
    </form>
  );
}
