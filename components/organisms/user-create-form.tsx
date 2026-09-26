"use client";

import { UserAdd01Icon } from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";
import { useActionState } from "react";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Field, FieldDescription, FieldError, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { NativeSelect, NativeSelectOption } from "@/components/ui/native-select";
import type { ActionResult } from "@/lib/action-result";
import { ROLES } from "@/lib/auth/roles";
import { useT } from "@/lib/i18n/client";

type State = ActionResult<{ id: string }> | null;

export function UserCreateForm({
  action,
  passwordMin,
}: {
  action: (state: State, formData: FormData) => Promise<State>;
  passwordMin: number;
}) {
  const t = useT();
  const [state, formAction, pending] = useActionState(action, null);

  return (
    <Card>
      <CardHeader>
        <CardTitle>{t("users.createTitle")}</CardTitle>
        <CardDescription>{t("users.createHint")}</CardDescription>
      </CardHeader>
      <CardContent>
        {/* Keyed on success so React clears the fields for the next entry. */}
        <form key={state?.ok ? state.data.id : "form"} action={formAction} className="grid items-start gap-4 md:grid-cols-2 xl:grid-cols-4">
          <Field>
            <FieldLabel htmlFor="new-user-email">{t("auth.email")}</FieldLabel>
            <Input id="new-user-email" name="email" type="email" required autoComplete="off" />
          </Field>
          <Field>
            <FieldLabel htmlFor="new-user-name">{t("columns.name")}</FieldLabel>
            <Input id="new-user-name" name="name" autoComplete="off" />
          </Field>
          <Field>
            <FieldLabel htmlFor="new-user-role">{t("columns.role")}</FieldLabel>
            <NativeSelect id="new-user-role" name="role" defaultValue="PAKAR" className="w-full">
              {ROLES.map((r) => (
                <NativeSelectOption key={r} value={r}>
                  {t(`roles.${r}`)}
                </NativeSelectOption>
              ))}
            </NativeSelect>
          </Field>
          <Field>
            <FieldLabel htmlFor="new-user-password">{t("auth.password")}</FieldLabel>
            <Input id="new-user-password" name="password" type="password" autoComplete="new-password" minLength={passwordMin} />
            <FieldDescription>{t("users.passwordHint", { min: passwordMin })}</FieldDescription>
          </Field>
          <div className="flex justify-end md:col-span-2 xl:col-span-4">
            <Button type="submit" disabled={pending}>
              <HugeiconsIcon icon={UserAdd01Icon} strokeWidth={2} aria-hidden="true" data-icon="inline-start" />
              {t("users.create")}
            </Button>
          </div>
        </form>
        <div aria-live="polite" className="mt-3 text-sm">
          {state && !state.ok ? <FieldError>{t.maybe(`errors.${state.error.code}`) ?? state.error.message}</FieldError> : null}
          {state?.ok ? <p className="text-success">{t("users.saved")}</p> : null}
        </div>
      </CardContent>
    </Card>
  );
}
