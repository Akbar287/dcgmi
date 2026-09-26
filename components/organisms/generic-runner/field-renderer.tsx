"use client";

import { useMemo } from "react";

import { ChoiceField, FieldHeader, type FieldChrome } from "@/components/molecules/choice-field";
import { ParagraphField } from "@/components/molecules/paragraph-field";
import { RichHelpText } from "@/components/molecules/rich-help-text";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { NativeSelect, NativeSelectOption } from "@/components/ui/native-select";
import { Textarea } from "@/components/ui/textarea";
import { answerKeys, TEXT_MAX, type Answers, type FieldDef } from "@/lib/forms/types";
import { parseMulti, parsePair } from "@/lib/forms/validate";
import { useT } from "@/lib/i18n/client";
import { buildMatrixFromPairs, pairValue, priorityVector } from "@/lib/method/ahp";
import { cn } from "@/lib/utils";

export interface ItemFeedback {
  own: number | null;
  median: number;
  iqr: number;
  distribution: number[];
  revised: boolean;
}

export const fieldDomId = (key: string) => `q-${key.replace(/[^a-zA-Z0-9_-]/g, "_")}`;

export function FieldRenderer({
  field,
  answers,
  set,
  errors,
  feedback,
}: {
  field: FieldDef;
  answers: Answers;
  set: (key: string, value: string) => void;
  errors: Record<string, string>;
  feedback?: ItemFeedback;
}) {
  const t = useT();
  const id = fieldDomId(field.key);
  const chrome: FieldChrome = { id, label: field.label, help: field.type === "RELEVANCE_4" || field.type === "INFO" ? undefined : (field.helpText ?? undefined), required: field.required, requiredLabel: t("runner.required"), error: errors[field.key] };
  const v = answers[field.key] ?? "";

  switch (field.type) {
    case "INFO":
      return (
        <div className="flex flex-col gap-2 rounded-xl bg-muted/40 p-4">
          <p className="text-sm font-medium">{field.label}</p>
          {field.helpText ? <RichHelpText text={field.helpText} /> : null}
        </div>
      );
    case "SHORT_TEXT":
      return (
        <div id={id} className="flex scroll-mt-24 flex-col gap-3">
          <FieldHeader {...chrome} />
          <Input aria-labelledby={`${id}-label`} value={v} maxLength={TEXT_MAX.SHORT_TEXT} onChange={(e) => set(field.key, e.target.value)} aria-invalid={Boolean(chrome.error)} />
          {chrome.error ? <p role="alert" className="text-sm text-destructive">{chrome.error}</p> : null}
        </div>
      );
    case "PARAGRAPH":
      return <ParagraphField {...chrome} value={v} maxLength={TEXT_MAX.PARAGRAPH} onChange={(x) => set(field.key, x)} />;
    case "SINGLE_CHOICE":
      return <ChoiceField {...chrome} choices={field.options} value={v} onChange={(x) => set(field.key, x)} clearLabel={t("runner.clear")} />;
    case "DROPDOWN":
      return (
        <div id={id} className="flex scroll-mt-24 flex-col gap-3">
          <FieldHeader {...chrome} />
          <NativeSelect aria-labelledby={`${id}-label`} value={v} onChange={(e) => set(field.key, e.target.value)} className="w-full max-w-md">
            <NativeSelectOption value="">—</NativeSelectOption>
            {field.options.map((o) => (
              <NativeSelectOption key={o} value={o}>
                {o}
              </NativeSelectOption>
            ))}
          </NativeSelect>
          {chrome.error ? <p role="alert" className="text-sm text-destructive">{chrome.error}</p> : null}
        </div>
      );
    case "MULTI_CHOICE": {
      const picked = parseMulti(v) ?? [];
      return (
        <div id={id} className="flex scroll-mt-24 flex-col gap-3">
          <FieldHeader {...chrome} />
          {field.options.map((o) => (
            <label key={o} className="flex items-center gap-3 rounded-xl border px-3 py-2.5 text-sm">
              <Checkbox checked={picked.includes(o)} onCheckedChange={(c) => set(field.key, JSON.stringify(c ? [...picked, o] : picked.filter((x) => x !== o)))} />
              {o}
            </label>
          ))}
          {chrome.error ? <p role="alert" className="text-sm text-destructive">{chrome.error}</p> : null}
        </div>
      );
    }
    case "LINEAR_SCALE": {
      const min = field.config?.min ?? 1;
      const max = field.config?.max ?? 5;
      const steps = Array.from({ length: max - min + 1 }, (_, i) => String(min + i));
      return (
        <div className="flex flex-col gap-2">
          <ChoiceField {...chrome} choices={steps} value={v} onChange={(x) => set(field.key, x)} clearLabel={t("runner.clear")} />
          {field.config?.minLabel || field.config?.maxLabel ? (
            <p className="flex justify-between text-xs text-muted-foreground">
              <span>{min}: {field.config?.minLabel}</span>
              <span>{max}: {field.config?.maxLabel}</span>
            </p>
          ) : null}
        </div>
      );
    }
    case "DATE":
      return (
        <div id={id} className="flex scroll-mt-24 flex-col gap-3">
          <FieldHeader {...chrome} />
          <Input type="date" aria-labelledby={`${id}-label`} value={v} onChange={(e) => set(field.key, e.target.value)} className="max-w-xs" />
          {chrome.error ? <p role="alert" className="text-sm text-destructive">{chrome.error}</p> : null}
        </div>
      );
    case "RELEVANCE_4":
      return <RelevanceField field={field} answers={answers} set={set} chrome={chrome} feedback={feedback} />;
    case "PAIRWISE":
      return <PairwiseField field={field} answers={answers} set={set} chrome={chrome} errors={errors} />;
  }
}

const RELEVANCE = ["1", "2", "3", "4"];

function RelevanceField({ field, answers, set, chrome, feedback }: { field: FieldDef; answers: Answers; set: (k: string, v: string) => void; chrome: FieldChrome; feedback?: ItemFeedback }) {
  const t = useT();
  const v = answers[field.key] ?? "";
  const clarity = answers[`${field.key}:clarity`] === "1";
  return (
    <div id={chrome.id} className="flex scroll-mt-24 flex-col gap-3 rounded-2xl border p-4">
      <FieldHeader {...chrome} />
      {field.helpText ? (
        <details className="text-sm">
          <summary className="cursor-pointer text-muted-foreground">{t("runner.indicatorContext")}</summary>
          <p className="mt-2 whitespace-pre-line text-xs text-muted-foreground">{field.helpText}</p>
        </details>
      ) : null}
      {feedback ? (
        <div className="rounded-lg bg-muted/50 p-3 text-xs" aria-label={t("builder.feedbackTitle")}>
          <p className="font-medium">{t("builder.feedbackTitle")}</p>
          <p className="tabular-nums">
            {t("builder.feedbackLine", { own: feedback.own ?? "—", median: feedback.median, iqr: feedback.iqr })} · {feedback.distribution.map((n, i) => `${i + 1}: ${n}`).join(", ")}
          </p>
          <p className="text-muted-foreground">{feedback.revised ? t("builder.revised") : t("builder.notRevised")}</p>
        </div>
      ) : null}
      <div role="radiogroup" aria-labelledby={`${chrome.id}-label`} className="grid grid-cols-2 gap-2 sm:grid-cols-4">
        {RELEVANCE.map((r) => (
          <label key={r} className={cn("flex cursor-pointer flex-col items-start gap-1 rounded-xl border px-3 py-2 text-sm", v === r && "border-primary/40 bg-primary/5")}>
            <span className="flex items-center gap-2">
              <input type="radio" name={chrome.id} value={r} checked={v === r} onChange={() => set(field.key, r)} className="accent-primary" />
              <span className="font-medium tabular-nums">{r}</span>
            </span>
            <span className="text-xs text-muted-foreground">{t(`builder.relevance.${r}` as "builder.relevance.1")}</span>
          </label>
        ))}
      </div>
      {chrome.error ? <p role="alert" className="text-sm text-destructive">{chrome.error}</p> : null}
      {field.config?.clarity ? (
        <div className="flex flex-col gap-2">
          <label className="flex items-center gap-2 text-sm">
            <Checkbox checked={clarity} onCheckedChange={(c) => set(`${field.key}:clarity`, c ? "1" : "0")} />
            {t("builder.clarityFlag")}
          </label>
          {clarity ? <Textarea aria-label={t("builder.clarityNote")} placeholder={t("builder.clarityNote")} value={answers[`${field.key}:clarityNote`] ?? ""} maxLength={300} onChange={(e) => set(`${field.key}:clarityNote`, e.target.value)} className="min-h-16 text-sm" /> : null}
        </div>
      ) : null}
    </div>
  );
}

const PAIR_OPTIONS = ["A:9", "A:8", "A:7", "A:6", "A:5", "A:4", "A:3", "A:2", "EQ", "B:2", "B:3", "B:4", "B:5", "B:6", "B:7", "B:8", "B:9"];

function PairwiseField({ field, answers, set, chrome, errors }: { field: FieldDef; answers: Answers; set: (k: string, v: string) => void; chrome: FieldChrome; errors: Record<string, string> }) {
  const t = useT();
  const els = field.config?.elements ?? [];
  const keys = answerKeys(field);
  // Live consistency for the respondent's own reflection; never corrected by the system (§3.9.2).
  const cr = useMemo(() => {
    const pairs = keys.map((k) => ({ k, p: parsePair(answers[k] ?? "") }));
    if (els.length < 3 || pairs.some((x) => !x.p)) return null;
    try {
      const m = buildMatrixFromPairs(els.length, pairs.map(({ k, p }) => {
        const [i, j] = k.split(":").at(-1)!.split("-").map(Number);
        return { i, j, value: pairValue(p!.preferred, p!.intensity) };
      }));
      return priorityVector(m).cr;
    } catch {
      return null;
    }
  }, [answers, els.length, keys]);
  const label = (o: string) => (o === "EQ" ? t("builder.pairEqual") : `${o[0] === "A" ? "A" : "B"} ${o.slice(2)}`);
  return (
    <div id={chrome.id} className="flex scroll-mt-24 flex-col gap-3">
      <FieldHeader {...chrome} />
      <p className="text-xs text-muted-foreground">{t("builder.pairHint")}</p>
      <ul className="flex flex-col gap-2">
        {keys.map((k) => {
          const [i, j] = k.split(":").at(-1)!.split("-").map(Number);
          return (
            <li key={k} id={fieldDomId(k)} className="grid items-center gap-2 rounded-xl border p-2 text-sm sm:grid-cols-[1fr_auto_1fr]">
              <span>A: {els[i]?.label}</span>
              <NativeSelect size="sm" value={answers[k] ?? ""} onChange={(e) => set(k, e.target.value)} aria-label={`${els[i]?.label} — ${els[j]?.label}`}>
                <NativeSelectOption value="">—</NativeSelectOption>
                {PAIR_OPTIONS.map((o) => (
                  <NativeSelectOption key={o} value={o}>
                    {label(o)}
                  </NativeSelectOption>
                ))}
              </NativeSelect>
              <span className="sm:text-right">B: {els[j]?.label}</span>
              {errors[k] ? <span role="alert" className="text-xs text-destructive sm:col-span-3">{errors[k]}</span> : null}
            </li>
          );
        })}
      </ul>
      {cr !== null ? <p className={cn("text-xs tabular-nums", cr >= 0.1 ? "text-warning" : "text-muted-foreground")}>{t("builder.pairCr", { cr: cr.toFixed(3) })}</p> : null}
    </div>
  );
}
