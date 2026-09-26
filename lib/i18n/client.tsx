"use client";

import { createContext, useContext, useMemo, type ReactNode } from "react";

import { createTranslator, DEFAULT_LOCALE, type Locale, type Translator } from ".";

const LocaleContext = createContext<Locale>(DEFAULT_LOCALE);

export function I18nProvider({ locale, children }: { locale: Locale; children: ReactNode }) {
  return <LocaleContext.Provider value={locale}>{children}</LocaleContext.Provider>;
}

export function useT(): Translator {
  const locale = useContext(LocaleContext);
  return useMemo(() => createTranslator(locale), [locale]);
}
