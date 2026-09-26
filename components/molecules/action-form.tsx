"use client";

import { useActionState, useRef, useTransition, type ReactNode } from "react";

import { Button } from "@/components/ui/button";
import { FieldError } from "@/components/ui/field";
import type { ActionResult } from "@/lib/action-result";
import { cn } from "@/lib/utils";
import { useT } from "@/lib/i18n/client";

/**
 * Server-action form that keeps the user's input when the action fails
 * (React resets `<form action>` forms after every submission).
 */
export function ActionForm<T>({
  action,
  submitLabel,
  submitVariant = "default",
  resetOnSuccess = false,
  successLabel,
  className,
  children,
}: {
  action: (state: ActionResult<T> | null, formData: FormData) => Promise<ActionResult<T> | null>;
  submitLabel: string;
  submitVariant?: "default" | "outline" | "destructive" | "secondary";
  resetOnSuccess?: boolean;
  successLabel?: string;
  className?: string;
  children: ReactNode;
}) {
  const t = useT();
  const ref = useRef<HTMLFormElement>(null);
  const [transitioning, startTransition] = useTransition();
  const [state, formAction, pending] = useActionState(async (prev: ActionResult<T> | null, formData: FormData) => {
    const result = await action(prev, formData);
    if (result?.ok && resetOnSuccess) ref.current?.reset();
    return result;
  }, null);
  const busy = pending || transitioning;
  const details = state && !state.ok && Array.isArray(state.error.details) ? (state.error.details as unknown[]) : [];

  return (
    <form
      ref={ref}
      className={cn("flex flex-col gap-3", className)}
      onSubmit={(e) => {
        e.preventDefault();
        const formData = new FormData(e.currentTarget);
        startTransition(() => formAction(formData));
      }}
    >
      {children}
      {state && !state.ok ? (
        <FieldError>
          {state.error.message}
          {details.length > 0 ? ` (${details.map((d) => (typeof d === "string" ? d : ((d as { code?: string }).code ?? ""))).join(", ")})` : null}
        </FieldError>
      ) : null}
      <div className="flex items-center gap-3">
        <Button type="submit" variant={submitVariant} disabled={busy}>
          {busy ? t("panelAdmin.saving") : submitLabel}
        </Button>
        {state?.ok && successLabel ? (
          <span role="status" className="text-sm text-muted-foreground">
            {successLabel}
          </span>
        ) : null}
      </div>
    </form>
  );
}
