"use client";

import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { cn } from "@/lib/utils";

export interface FieldChrome {
  id: string;
  label: string;
  help?: string;
  required: boolean;
  requiredLabel: string;
  error?: string;
}

export function FieldHeader({ id, label, help, required, requiredLabel }: FieldChrome) {
  return (
    <div className="flex flex-col gap-1">
      <span id={`${id}-label`} className="text-sm font-medium">
        {label}
        {required ? (
          <span className="ml-1 text-destructive" aria-hidden="true">
            *
          </span>
        ) : null}
        {required ? <span className="sr-only"> ({requiredLabel})</span> : null}
      </span>
      {help ? (
        <p id={`${id}-help`} className="text-xs whitespace-pre-line text-muted-foreground">
          {help}
        </p>
      ) : null}
    </div>
  );
}

export function ChoiceField({
  choices,
  value,
  onChange,
  clearLabel,
  ...chrome
}: FieldChrome & {
  choices: string[];
  value: string;
  onChange: (value: string) => void;
  clearLabel: string;
}) {
  const describedBy = [chrome.help ? `${chrome.id}-help` : null, chrome.error ? `${chrome.id}-error` : null].filter(Boolean).join(" ");
  return (
    <div id={chrome.id} className="flex scroll-mt-24 flex-col gap-3">
      <FieldHeader {...chrome} />
      <RadioGroup
        value={value || null}
        onValueChange={(v) => onChange(String(v ?? ""))}
        aria-labelledby={`${chrome.id}-label`}
        aria-describedby={describedBy || undefined}
        aria-invalid={Boolean(chrome.error)}
        className="gap-2"
      >
        {choices.map((choice) => (
          <label
            key={choice}
            className={cn(
              "flex cursor-pointer items-center gap-3 rounded-xl border px-3 py-2.5 text-sm transition-colors hover:bg-muted/60",
              value === choice && "border-primary/40 bg-primary/5",
            )}
          >
            <RadioGroupItem value={choice} aria-invalid={Boolean(chrome.error)} />
            <span>{choice}</span>
          </label>
        ))}
      </RadioGroup>
      {!chrome.required && value ? (
        <button type="button" onClick={() => onChange("")} className="self-start text-xs text-muted-foreground underline underline-offset-2">
          {clearLabel}
        </button>
      ) : null}
      {chrome.error ? (
        <p id={`${chrome.id}-error`} role="alert" className="text-sm text-destructive">
          {chrome.error}
        </p>
      ) : null}
    </div>
  );
}
