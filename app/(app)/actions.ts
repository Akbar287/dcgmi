"use server";

import { cookies } from "next/headers";
import { revalidatePath } from "next/cache";

import { isLocale, LOCALE_COOKIE } from "@/lib/i18n";

import { VERSION_COOKIE } from "./_lib/active-version";

const ONE_YEAR = 60 * 60 * 24 * 365;

// View preferences only; these do not mutate artifacts, so no ChangeLogEntry.
export async function setActiveVersion(formData: FormData) {
  const versionId = formData.get("versionId");
  if (typeof versionId !== "string" || versionId.length === 0) return;
  (await cookies()).set(VERSION_COOKIE, versionId, { path: "/", maxAge: ONE_YEAR, sameSite: "lax" });
  revalidatePath("/", "layout");
}

export async function setLocale(formData: FormData) {
  const locale = formData.get("locale");
  if (!isLocale(locale)) return;
  (await cookies()).set(LOCALE_COOKIE, locale, { path: "/", maxAge: ONE_YEAR, sameSite: "lax" });
  revalidatePath("/", "layout");
}
