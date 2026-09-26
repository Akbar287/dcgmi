"use client";

import { ActionForm } from "@/components/molecules/action-form";
import { BudgetField } from "@/components/molecules/budget-field";
import { Notice } from "@/components/molecules/notice";
import { Field, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { NativeSelect, NativeSelectOption } from "@/components/ui/native-select";
import type { ActionResult } from "@/lib/action-result";
import { useT } from "@/lib/i18n/client";

export interface RoundPlanView {
  roundNumber: number;
  items: number;
  calls: number;
  blocked: string[];
  warnings: string[];
}

export function RoundCreateForm({
  panels,
  plan,
  mockAi,
  action,
}: {
  panels: { id: string; name: string; ready: boolean }[];
  plan: RoundPlanView;
  mockAi: boolean;
  action: (s: ActionResult | null, f: FormData) => Promise<ActionResult | null>;
}) {
  const t = useT();
  if (plan.blocked.length) {
    return (
      <Notice tone="locked" title={t("delphiSim.blocked")}>
        <ul className="list-disc pl-4">
          {plan.blocked.map((b) => (
            <li key={b}>{t.maybe(`delphiSim.blockers.${b.split(":")[0]}`) ?? b}</li>
          ))}
        </ul>
      </Notice>
    );
  }
  if (panels.length === 0) return <Notice>{t("delphiSim.noPanel")}</Notice>;
  return (
    <ActionForm action={action} submitLabel={t("delphiSim.create")}>
      <div className="grid gap-4 md:grid-cols-3">
        <Field className="md:col-span-2">
          <FieldLabel htmlFor="delphi-panel">{t("delphiSim.panel")}</FieldLabel>
          <NativeSelect id="delphi-panel" name="configId" defaultValue={panels.find((p) => p.ready)?.id ?? panels[0].id} className="w-full">
            {panels.map((p) => (
              <NativeSelectOption key={p.id} value={p.id}>
                {p.name} — {p.ready ? t("fgdSim.panelReady") : t("fgdSim.panelNotReady")}
              </NativeSelectOption>
            ))}
          </NativeSelect>
        </Field>
        <Field>
          <FieldLabel htmlFor="delphi-seed">{t("delphiSim.seed")}</FieldLabel>
          <Input id="delphi-seed" name="seed" inputMode="numeric" pattern="\d*" />
        </Field>
      </div>
      <p className="text-sm tabular-nums">{t("delphiSim.plan", { round: plan.roundNumber, items: plan.items, calls: plan.calls })}</p>
      {plan.warnings.map((w) => (
        <Notice key={w} tone="warning">
          <span className="font-mono text-xs">{w}</span>
        </Notice>
      ))}
      <BudgetField id="delphi-budget" />
      <Notice tone={mockAi ? "info" : "warning"}>{mockAi ? t("fgdSim.mockNote") : t("fgdSim.liveNote")}</Notice>
    </ActionForm>
  );
}
