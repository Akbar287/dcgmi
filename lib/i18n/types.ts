import type { id } from "./dictionaries/id";

type Widen<T> = T extends string
  ? string
  : { readonly [K in keyof T]: Widen<T[K]> };

type DeepPartial<T> = T extends string
  ? T
  : { readonly [K in keyof T]?: DeepPartial<T[K]> };

type Paths<T, P extends string = ""> = {
  [K in keyof T & string]: T[K] extends string
    ? `${P}${K}`
    : Paths<T[K], `${P}${K}.`>;
}[keyof T & string];

export type Dictionary = Widen<typeof id>;
export type PartialDictionary = DeepPartial<Dictionary>;
export type TranslationKey = Paths<Dictionary>;

export const LOCALES = ["id", "en"] as const;
export type Locale = (typeof LOCALES)[number];
export const DEFAULT_LOCALE: Locale = "id";
export const LOCALE_COOKIE = "ddc_locale";

export type TranslationVars = Record<string, string | number>;

export interface Translator {
  (key: TranslationKey, vars?: TranslationVars): string;
  /** For keys built at runtime (enum values, section slugs). */
  maybe(key: string, vars?: TranslationVars): string | undefined;
  locale: Locale;
}
