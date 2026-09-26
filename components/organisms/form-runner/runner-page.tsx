"use client";

import { RichHelpText } from "@/components/molecules/rich-help-text";
import { Card, CardContent } from "@/components/ui/card";
import { EXPERT_KEY } from "@/lib/instruments/pre-review/answers";
import type { PlanPage } from "@/lib/instruments/pre-review/pages";
import type { Answers, PlanItem } from "@/lib/instruments/pre-review/types";
import { useT } from "@/lib/i18n/client";

import { IndicatorReviewCard } from "./indicator-review-card";
import { Question } from "./question";
import type { RunnerDefinition } from "./types";

function groupByIndicator(fields: PlanItem[]) {
  const groups: { id: string | null; fields: PlanItem[] }[] = [];
  for (const f of fields) {
    const id = f.canonicalId ?? null;
    const last = groups.at(-1);
    if (last && id && last.id === id) last.fields.push(f);
    else groups.push({ id, fields: [f] });
  }
  return groups;
}

export function RunnerPage({
  page,
  definition,
  answers,
  errors,
  onChange,
}: {
  page: PlanPage;
  definition: RunnerDefinition;
  answers: Answers;
  errors: Record<string, string>;
  onChange: (key: string, value: string) => void;
}) {
  const t = useT();
  return (
    <div className="flex flex-col gap-6">
      {page.page ? (
        <header className="flex flex-col gap-2">
          <h2 className="font-heading text-xl font-semibold">{page.page.title}</h2>
          <RichHelpText text={page.page.help} className="text-muted-foreground" />
        </header>
      ) : (
        <Card>
          <CardContent>
            <RichHelpText text={definition.description} />
          </CardContent>
        </Card>
      )}
      {groupByIndicator(page.fields).map((group) =>
        group.id ? (
          <IndicatorReviewCard
            key={group.id}
            canonicalId={group.id}
            indicatorName={definition.indicatorNames[group.id] ?? ""}
            fields={group.fields}
            answers={answers}
            errors={errors}
            onChange={onChange}
          />
        ) : (
          group.fields.map((f) =>
            f.key === EXPERT_KEY ? (
              // Bound to the account by an Admin (researcher decision); shown, never chosen.
              <Card key={f.key}>
                <CardContent className="flex flex-col gap-2">
                  <span className="text-sm font-medium">{f.title}</span>
                  <p className="text-xs text-muted-foreground">{f.help}</p>
                  <p className="font-mono text-2xl font-semibold tracking-wide">{definition.expertCode}</p>
                  <p className="text-xs text-muted-foreground">{t("runner.assignedCodeHint")}</p>
                </CardContent>
              </Card>
            ) : (
              <Card key={f.key}>
                <CardContent>
                  <Question item={f} value={answers[f.key] ?? ""} error={errors[f.key]} onChange={onChange} />
                </CardContent>
              </Card>
            ),
          )
        ),
      )}
    </div>
  );
}
