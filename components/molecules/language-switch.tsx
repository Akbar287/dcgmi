"use client";

import { NativeSelect, NativeSelectOption } from "@/components/ui/native-select";

export function LanguageSwitch({
  locale,
  locales,
  label,
  action,
}: {
  locale: string;
  locales: readonly string[];
  label: string;
  action: (formData: FormData) => Promise<void>;
}) {
  return (
    // Keyed by locale: React 19 resets uncontrolled fields after a form action,
    // so remounting keeps the select in sync with the server-rendered value.
    <form key={locale} action={action} className="flex items-center">
      <label htmlFor="ui-locale" className="sr-only">
        {label}
      </label>
      <NativeSelect
        id="ui-locale"
        name="locale"
        size="sm"
        defaultValue={locale}
        onChange={(event) => event.currentTarget.form?.requestSubmit()}
      >
        {locales.map((l) => (
          <NativeSelectOption key={l} value={l}>
            {l.toUpperCase()}
          </NativeSelectOption>
        ))}
      </NativeSelect>
    </form>
  );
}
