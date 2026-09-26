"use client";

import { Textarea } from "@/components/ui/textarea";

import { FieldHeader, type FieldChrome } from "./choice-field";

export function ParagraphField({
  value,
  onChange,
  maxLength,
  ...chrome
}: FieldChrome & { value: string; onChange: (value: string) => void; maxLength: number }) {
  const describedBy = [chrome.help ? `${chrome.id}-help` : null, chrome.error ? `${chrome.id}-error` : null].filter(Boolean).join(" ");
  return (
    <div id={chrome.id} className="flex scroll-mt-24 flex-col gap-3">
      <FieldHeader {...chrome} />
      <Textarea
        aria-labelledby={`${chrome.id}-label`}
        aria-describedby={describedBy || undefined}
        aria-invalid={Boolean(chrome.error)}
        aria-required={chrome.required}
        value={value}
        maxLength={maxLength}
        onChange={(event) => onChange(event.target.value)}
        className="min-h-24"
      />
      {chrome.error ? (
        <p id={`${chrome.id}-error`} role="alert" className="text-sm text-destructive">
          {chrome.error}
        </p>
      ) : null}
    </div>
  );
}
