"use client";

import { ActionForm } from "@/components/molecules/action-form";
import { BudgetField } from "@/components/molecules/budget-field";
import { Notice } from "@/components/molecules/notice";
import { Checkbox } from "@/components/ui/checkbox";
import { Field, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { NativeSelect, NativeSelectOption } from "@/components/ui/native-select";
import type { ActionResult } from "@/lib/action-result";
import { useT } from "@/lib/i18n/client";

type Option = { id: string; label: string };

export function RunDesigner({
  version,
  fgdPanels,
  delphiPanels,
  ahpPanels,
  models,
  profiles,
  blocked,
  mockAi,
  action,
}: {
  version: string;
  fgdPanels: Option[];
  delphiPanels: Option[];
  ahpPanels: Option[];
  models: Option[];
  profiles: Option[];
  blocked: string | null;
  mockAi: boolean;
  action: (s: ActionResult | null, f: FormData) => Promise<ActionResult | null>;
}) {
  const t = useT();
  if (blocked) return <Notice tone="locked">{blocked}</Notice>;
  const select = (id: string, name: string, label: string, options: Option[]) => (
    <Field>
      <FieldLabel htmlFor={id}>{label}</FieldLabel>
      <NativeSelect id={id} name={name} className="w-full" required>
        {options.map((o) => (
          <NativeSelectOption key={o.id} value={o.id}>
            {o.label}
          </NativeSelectOption>
        ))}
      </NativeSelect>
    </Field>
  );
  return (
    <ActionForm action={action} submitLabel={t("pipeline.create")}>
      <div className="grid gap-4 md:grid-cols-3">
        <Field className="md:col-span-2">
          <FieldLabel htmlFor="run-name">{t("pipeline.name")}</FieldLabel>
          <Input id="run-name" name="name" required minLength={3} maxLength={120} defaultValue={`Run ${version}`} />
        </Field>
        <Field>
          <FieldLabel htmlFor="run-mode">{t("pipeline.mode")}</FieldLabel>
          <NativeSelect id="run-mode" name="mode" defaultValue="AUTO" className="w-full">
            <NativeSelectOption value="AUTO">{t("pipeline.modeAuto")}</NativeSelectOption>
            <NativeSelectOption value="STEP">{t("pipeline.modeStep")}</NativeSelectOption>
          </NativeSelect>
        </Field>
      </div>
      <div className="grid gap-4 md:grid-cols-3">
        {select("run-fgd", "fgdConfigId", t("pipeline.fgdPanel"), fgdPanels)}
        <Field>
          <FieldLabel htmlFor="run-cross">{t("fgdSim.crossTalk")}</FieldLabel>
          <NativeSelect id="run-cross" name="crossTalkRounds" defaultValue="0" className="w-full">
            {[0, 1, 2].map((n) => (
              <NativeSelectOption key={n} value={String(n)}>
                {n}
              </NativeSelectOption>
            ))}
          </NativeSelect>
        </Field>
        {select("run-delphi", "delphiConfigId", t("pipeline.delphiPanel"), delphiPanels)}
        {select("run-ahp", "ahpConfigId", t("pipeline.ahpPanel"), ahpPanels)}
        {select("run-model", "assessorModelId", t("scoringSim.model"), models)}
        <Field>
          <FieldLabel htmlFor="run-seed">{t("fgdSim.seed")}</FieldLabel>
          <Input id="run-seed" name="seed" inputMode="numeric" pattern="\d*" />
        </Field>
      </div>
      <fieldset className="flex flex-col gap-2">
        <legend className="mb-1 text-sm font-medium">{t("pipeline.profiles")}</legend>
        {profiles.map((p) => (
          <label key={p.id} className="flex items-center gap-2 text-sm">
            <Checkbox name="profileIds" value={p.id} defaultChecked />
            {p.label}
          </label>
        ))}
      </fieldset>
      <p className="text-xs text-muted-foreground">{t("pipeline.designHint")}</p>
      <BudgetField id="run-budget" />
      <Notice tone={mockAi ? "info" : "warning"}>{mockAi ? t("fgdSim.mockNote") : t("fgdSim.liveNote")}</Notice>
    </ActionForm>
  );
}
