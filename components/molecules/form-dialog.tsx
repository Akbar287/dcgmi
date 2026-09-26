"use client";

import { useActionState, useState, type ReactNode } from "react";

import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { FieldError } from "@/components/ui/field";
import type { ActionResult } from "@/lib/action-result";
import { useT } from "@/lib/i18n/client";

/** Dialog around a server-action form; closes itself when the action succeeds. */
export function FormDialog<T>({
  title,
  trigger,
  action,
  submitLabel,
  children,
}: {
  title: string;
  trigger: ReactNode;
  action: (state: ActionResult<T> | null, formData: FormData) => Promise<ActionResult<T> | null>;
  submitLabel?: string;
  children: ReactNode;
}) {
  const t = useT();
  const [open, setOpen] = useState(false);
  const [state, formAction, pending] = useActionState(async (prev: ActionResult<T> | null, formData: FormData) => {
    const result = await action(prev, formData);
    if (result?.ok) setOpen(false);
    return result;
  }, null);

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger render={trigger as React.ReactElement} />
      <DialogContent className="sm:max-w-xl">
        <form action={formAction} className="grid gap-4">
          <DialogHeader>
            <DialogTitle>{title}</DialogTitle>
          </DialogHeader>
          {children}
          {state && !state.ok ? <FieldError>{state.error.message}</FieldError> : null}
          <DialogFooter>
            <Button type="button" variant="ghost" onClick={() => setOpen(false)}>
              {t("panelAdmin.cancel")}
            </Button>
            <Button type="submit" disabled={pending}>
              {pending ? t("panelAdmin.saving") : (submitLabel ?? t("panelAdmin.save"))}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
