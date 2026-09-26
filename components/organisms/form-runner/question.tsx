"use client";

import { ChoiceField } from "@/components/molecules/choice-field";
import { ParagraphField } from "@/components/molecules/paragraph-field";
import { PARAGRAPH_MAX } from "@/lib/instruments/pre-review/answers";
import type { PlanItem } from "@/lib/instruments/pre-review/types";
import { useT } from "@/lib/i18n/client";

import { fieldDomId } from "./types";

export function Question({
  item,
  value,
  error,
  hideHelp,
  onChange,
}: {
  item: PlanItem;
  value: string;
  error?: string;
  hideHelp?: boolean;
  onChange: (key: string, value: string) => void;
}) {
  const t = useT();
  const chrome = {
    id: fieldDomId(item.key),
    label: item.title,
    help: hideHelp ? undefined : item.help,
    required: item.required,
    requiredLabel: t("runner.required"),
    error,
  };
  if (item.type === "MC") {
    return (
      <ChoiceField
        {...chrome}
        choices={item.choices}
        value={value}
        clearLabel={t("runner.clear")}
        onChange={(v) => onChange(item.key, v)}
      />
    );
  }
  return <ParagraphField {...chrome} value={value} maxLength={PARAGRAPH_MAX} onChange={(v) => onChange(item.key, v)} />;
}
