import { cookies } from "next/headers";

import { createTranslator, DEFAULT_LOCALE, isLocale, LOCALE_COOKIE, type Locale } from ".";

export async function getLocale(): Promise<Locale> {
  const value = (await cookies()).get(LOCALE_COOKIE)?.value;
  return isLocale(value) ? value : DEFAULT_LOCALE;
}

export async function getTranslator() {
  return createTranslator(await getLocale());
}
