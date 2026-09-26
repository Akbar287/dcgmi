"use client";

import { ActionForm } from "@/components/molecules/action-form";
import { BudgetField } from "@/components/molecules/budget-field";
import { Notice } from "@/components/molecules/notice";
import { Field, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { NativeSelect, NativeSelectOption } from "@/components/ui/native-select";
import type { ActionResult } from "@/lib/action-result";
import { useT } from "@/lib/i18n/client";

export function AssessmentCreateForm({
  profiles,
  models,
  indicators,
  blocked,
  mockAi,
  action,
}: {
  profiles: { id: string; label: string }[];
  models: { id: string; label: string }[];
  indicators: number;
  blocked: string[];
  mockAi: boolean;
  action: (s: ActionResult | null, f: FormData) => Promise<ActionResult | null>;
}) {
  const t = useT();
  if (blocked.length) {
    return (
      <Notice tone="locked" title={t("scoringSim.blocked")}>
        <ul className="list-disc pl-4">
          {blocked.map((b) => (
            <li key={b}>{t.maybe(`scoringSim.blockers.${b}`) ?? b}</li>
          ))}
        </ul>
      </Notice>
    );
  }
  if (profiles.length === 0) return <Notice>{t("scoringSim.profileNone")}</Notice>;
  return (
    <ActionForm action={action} submitLabel={t("scoringSim.create")}>
      <div className="grid gap-4 md:grid-cols-3">
        <Field>
          <FieldLabel htmlFor="as-profile">{t("scoringSim.profile")}</FieldLabel>
          <NativeSelect id="as-profile" name="profileId" className="w-full">
            {profiles.map((p) => (
              <NativeSelectOption key={p.id} value={p.id}>
                {p.label}
              </NativeSelectOption>
            ))}
          </NativeSelect>
        </Field>
        <Field>
          <FieldLabel htmlFor="as-model">{t("scoringSim.model")}</FieldLabel>
          <NativeSelect id="as-model" name="modelProfileId" className="w-full">
            {models.map((m) => (
              <NativeSelectOption key={m.id} value={m.id}>
                {m.label}
              </NativeSelectOption>
            ))}
          </NativeSelect>
        </Field>
        <Field>
          <FieldLabel htmlFor="as-seed">{t("scoringSim.seed")}</FieldLabel>
          <Input id="as-seed" name="seed" inputMode="numeric" pattern="\d*" />
        </Field>
      </div>
      <p className="text-sm tabular-nums">{t("scoringSim.estimate", { n: indicators })}</p>
      <BudgetField id="as-budget" />
      <Notice tone={mockAi ? "info" : "warning"}>{mockAi ? t("fgdSim.mockNote") : t("fgdSim.liveNote")}</Notice>
    </ActionForm>
  );
}
