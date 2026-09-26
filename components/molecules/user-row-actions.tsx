"use client";

import { Key01Icon } from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";
import { useActionState, useState } from "react";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Field, FieldError, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { NativeSelect, NativeSelectOption } from "@/components/ui/native-select";
import type { ActionResult } from "@/lib/action-result";
import { ROLES, type Role } from "@/lib/auth/roles";
import { useT } from "@/lib/i18n/client";

type State = ActionResult | null;
type Action = (state: State, formData: FormData) => Promise<State>;

export interface UserRowActionHandlers {
  updateRole: Action;
  setActive: Action;
  setPassword: Action;
  setPanelCode: Action;
}

export function UserRowActions({
  userId,
  email,
  role,
  active,
  isSelf,
  passwordMin,
  panelCode,
  panelCodes,
  actions,
}: {
  userId: string;
  email: string;
  role: Role;
  active: boolean;
  isSelf: boolean;
  passwordMin: number;
  panelCode: string | null;
  panelCodes: string[];
  actions: UserRowActionHandlers;
}) {
  const t = useT();
  const [roleState, roleAction, rolePending] = useActionState(actions.updateRole, null);
  const [activeState, activeAction, activePending] = useActionState(actions.setActive, null);
  const [pwState, pwAction, pwPending] = useActionState(actions.setPassword, null);
  const [codeState, codeAction, codePending] = useActionState(actions.setPanelCode, null);
  const [open, setOpen] = useState(false);
  const error = [roleState, activeState, codeState].find((s) => s && !s.ok);
  const errorText = error && !error.ok ? (t.maybe(`errors.${error.error.code}`) ?? error.error.message) : null;

  return (
    <div className="flex flex-col items-end gap-1">
      <div className="flex flex-wrap items-center justify-end gap-2">
        {/* Keyed by role: React 19 resets the form after the action. */}
        <form key={role} action={roleAction}>
          <input type="hidden" name="userId" value={userId} />
          <NativeSelect
            name="role"
            size="sm"
            defaultValue={role}
            disabled={rolePending}
            aria-label={`${t("columns.role")} ${email}`}
            onChange={(event) => event.currentTarget.form?.requestSubmit()}
          >
            {ROLES.map((r) => (
              <NativeSelectOption key={r} value={r}>
                {t(`roles.${r}`)}
              </NativeSelectOption>
            ))}
          </NativeSelect>
        </form>
        {role === "PAKAR" ? (
          <form key={panelCode ?? "none"} action={codeAction}>
            <input type="hidden" name="userId" value={userId} />
            <NativeSelect
              name="panelCode"
              size="sm"
              defaultValue={panelCode ?? ""}
              disabled={codePending}
              aria-label={`${t("users.panelCode")} ${email}`}
              onChange={(event) => event.currentTarget.form?.requestSubmit()}
            >
              <NativeSelectOption value="">{t("users.noPanelCode")}</NativeSelectOption>
              {panelCodes.map((c) => (
                <NativeSelectOption key={c} value={c}>
                  {c}
                </NativeSelectOption>
              ))}
            </NativeSelect>
          </form>
        ) : null}
        <form action={activeAction}>
          <input type="hidden" name="userId" value={userId} />
          <input type="hidden" name="active" value={active ? "false" : "true"} />
          <Button type="submit" variant={active ? "outline" : "secondary"} size="sm" disabled={activePending || isSelf}>
            {active ? t("users.deactivate") : t("users.activate")}
          </Button>
        </form>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger render={<Button variant="ghost" size="sm" />}>
            <HugeiconsIcon icon={Key01Icon} strokeWidth={2} aria-hidden="true" data-icon="inline-start" />
            {t("users.setPassword")}
          </DialogTrigger>
          <DialogContent>
            <form action={pwAction} className="grid gap-4">
              <DialogHeader>
                <DialogTitle>{t("users.setPasswordTitle", { email })}</DialogTitle>
                <DialogDescription>{t("users.passwordHint", { min: passwordMin })}</DialogDescription>
              </DialogHeader>
              <input type="hidden" name="userId" value={userId} />
              <Field>
                <FieldLabel htmlFor={`pw-${userId}`}>{t("auth.password")}</FieldLabel>
                <Input id={`pw-${userId}`} name="password" type="password" autoComplete="new-password" minLength={passwordMin} required />
              </Field>
              {pwState && !pwState.ok ? (
                <FieldError>{t.maybe(`errors.${pwState.error.code}`) ?? pwState.error.message}</FieldError>
              ) : null}
              {pwState?.ok ? <p className="text-sm text-success">{t("users.saved")}</p> : null}
              <DialogFooter>
                <Button type="button" variant="ghost" onClick={() => setOpen(false)}>
                  {t("users.cancel")}
                </Button>
                <Button type="submit" disabled={pwPending}>
                  {t("users.save")}
                </Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>
      </div>
      {errorText ? (
        <p role="alert" className="text-xs text-destructive">
          {errorText}
        </p>
      ) : null}
    </div>
  );
}
