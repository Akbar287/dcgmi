import { GoogleSignInButton } from "@/components/molecules/google-sign-in-button";
import { LoginForm } from "@/components/organisms/login-form";
import { AuthTemplate } from "@/components/templates/auth-template";
import { googleEnabled } from "@/auth";
import { getTranslator } from "@/lib/i18n/server";

import { credentialsSignIn, googleSignIn } from "./actions";

export const metadata = { title: "Masuk" };

function first(value: string | string[] | undefined): string | undefined {
  return Array.isArray(value) ? value[0] : value;
}

export default async function LoginPage({ searchParams }: PageProps<"/login">) {
  const t = await getTranslator();
  const params = await searchParams;
  const rawCallback = first(params.callbackUrl);
  // Auth.js passes an absolute callbackUrl; keep only its path.
  let callbackUrl = "/";
  if (rawCallback) {
    try {
      const url = new URL(rawCallback, "http://local");
      callbackUrl = url.pathname + url.search;
    } catch {
      callbackUrl = "/";
    }
  }
  const error = first(params.code) === "NotRegistered" ? "NotRegistered" : (first(params.error) ?? null);

  return (
    <AuthTemplate appName={t("app.name")} tagline={t("app.tagline")} title={t("auth.title")} description={t("auth.description")}>
      <LoginForm action={credentialsSignIn} callbackUrl={callbackUrl} initialError={error} />
      {googleEnabled ? (
        <>
          <div className="flex items-center gap-3 text-xs text-muted-foreground">
            <span className="h-px flex-1 bg-border" />
            {t("auth.or")}
            <span className="h-px flex-1 bg-border" />
          </div>
          <GoogleSignInButton label={t("auth.google")} callbackUrl={callbackUrl} action={googleSignIn} />
        </>
      ) : null}
    </AuthTemplate>
  );
}
