"use client";

import { useActionState } from "react";

import { Button } from "@/components/ui/button";
import { Field, FieldError, FieldGroup, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { useT } from "@/lib/i18n/client";

export interface LoginState {
  /** Key under `auth.errors`. */
  error: string | null;
}

export function LoginForm({
  action,
  callbackUrl,
  initialError,
}: {
  action: (state: LoginState, formData: FormData) => Promise<LoginState>;
  callbackUrl: string;
  initialError: string | null;
}) {
  const t = useT();
  const [state, formAction, pending] = useActionState(action, { error: initialError });
  const message = state.error ? (t.maybe(`auth.errors.${state.error}`) ?? t("auth.errors.Default")) : null;

  return (
    <form action={formAction} noValidate>
      <input type="hidden" name="callbackUrl" value={callbackUrl} />
      <FieldGroup>
        <Field>
          <FieldLabel htmlFor="login-email">{t("auth.email")}</FieldLabel>
          <Input id="login-email" name="email" type="email" autoComplete="email" required aria-invalid={Boolean(message)} />
        </Field>
        <Field>
          <FieldLabel htmlFor="login-password">{t("auth.password")}</FieldLabel>
          <Input
            id="login-password"
            name="password"
            type="password"
            autoComplete="current-password"
            required
            aria-invalid={Boolean(message)}
          />
        </Field>
        {message ? <FieldError>{message}</FieldError> : null}
        <Button type="submit" disabled={pending} className="w-full">
          {pending ? t("auth.submitting") : t("auth.submit")}
        </Button>
      </FieldGroup>
    </form>
  );
}
