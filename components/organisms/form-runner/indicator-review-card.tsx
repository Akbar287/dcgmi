"use client";

import { CodeText } from "@/components/atoms/code-text";
import { RichHelpText } from "@/components/molecules/rich-help-text";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type { Answers, PlanItem } from "@/lib/instruments/pre-review/types";
import { useT } from "@/lib/i18n/client";

import { Question } from "./question";

/** The six response fields of one indicator, with its package shown once on top. */
export function IndicatorReviewCard({
  canonicalId,
  indicatorName,
  fields,
  answers,
  errors,
  onChange,
}: {
  canonicalId: string;
  indicatorName: string;
  fields: PlanItem[];
  answers: Answers;
  errors: Record<string, string>;
  onChange: (key: string, value: string) => void;
}) {
  const t = useT();
  const decision = fields.find((f) => f.field === "decision");
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex flex-wrap items-center gap-2 text-base">
          <CodeText>{canonicalId}</CodeText>
          <span>{indicatorName}</span>
        </CardTitle>
      </CardHeader>
      <CardContent className="flex flex-col gap-6">
        {decision ? (
          <section aria-label={t("runner.indicatorContext")} className="rounded-xl bg-muted/50 p-4">
            <RichHelpText text={decision.help} />
          </section>
        ) : null}
        {fields.map((f) => (
          <Question
            key={f.key}
            item={f}
            value={answers[f.key] ?? ""}
            error={errors[f.key]}
            hideHelp={f.field === "decision"}
            onChange={onChange}
          />
        ))}
      </CardContent>
    </Card>
  );
}
