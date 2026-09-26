import { en } from "./dictionaries/en";
import { id } from "./dictionaries/id";
import {
  DEFAULT_LOCALE,
  LOCALES,
  type Locale,
  type PartialDictionary,
  type TranslationKey,
  type TranslationVars,
  type Translator,
} from "./types";

export * from "./types";

const DICTIONARIES: Record<Locale, PartialDictionary> = { id, en };

export function isLocale(value: unknown): value is Locale {
  return typeof value === "string" && (LOCALES as readonly string[]).includes(value);
}

function lookup(dict: unknown, key: string): string | undefined {
  let node: unknown = dict;
  for (const part of key.split(".")) {
    if (typeof node !== "object" || node === null) return undefined;
    node = (node as Record<string, unknown>)[part];
  }
  return typeof node === "string" ? node : undefined;
}

function interpolate(template: string, vars?: TranslationVars): string {
  if (!vars) return template;
  return template.replace(/\{(\w+)\}/g, (match, name: string) =>
    name in vars ? String(vars[name]) : match,
  );
}

export function createTranslator(locale: Locale = DEFAULT_LOCALE): Translator {
  const resolve = (key: string) =>
    lookup(DICTIONARIES[locale], key) ?? lookup(DICTIONARIES[DEFAULT_LOCALE], key);

  const maybe = (key: string, vars?: TranslationVars) => {
    const hit = resolve(key);
    return hit === undefined ? undefined : interpolate(hit, vars);
  };

  // Typed keys always exist in `id`; falling back to the key keeps a missing
  // translation visible instead of rendering an empty string.
  const t = ((key: TranslationKey, vars?: TranslationVars) => maybe(key, vars) ?? key) as Translator;
  t.maybe = maybe;
  t.locale = locale;
  return t;
}
