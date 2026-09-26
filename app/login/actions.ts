"use server";

import { AuthError } from "next-auth";
import { redirect } from "next/navigation";

import { signIn } from "@/auth";
import type { LoginState } from "@/components/organisms/login-form";
import { can, homePathFor } from "@/lib/auth/roles";
import { findActiveRoleByEmail } from "@/lib/db/repository/users";

/** Only same-origin relative paths; anything else falls back to "/". */
function safeCallback(value: FormDataEntryValue | null): string {
  return typeof value === "string" && value.startsWith("/") && !value.startsWith("//") ? value : "/";
}

export async function credentialsSignIn(_state: LoginState, formData: FormData): Promise<LoginState> {
  const email = formData.get("email");
  try {
    await signIn("credentials", { email, password: formData.get("password"), redirect: false });
  } catch (error) {
    if (error instanceof AuthError) {
      const code = "code" in error && error.code === "NotRegistered" ? "NotRegistered" : error.type;
      return { error: code === "CredentialsSignin" || code === "NotRegistered" ? code : "Default" };
    }
    throw error;
  }
  // Land on the role's own home so the URL matches what is rendered; a Pakar
  // never follows a callback into the simulation console.
  const role = typeof email === "string" ? await findActiveRoleByEmail(email) : null;
  if (!role) return { error: "NotRegistered" };
  const callback = safeCallback(formData.get("callbackUrl"));
  redirect(can(role, "console:read") ? callback : homePathFor(role));
}

export async function googleSignIn(formData: FormData) {
  await signIn("google", { redirectTo: safeCallback(formData.get("callbackUrl")) });
}
