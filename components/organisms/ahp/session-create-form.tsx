"use client";

import { useState } from "react";

import { ActionForm } from "@/components/molecules/action-form";
import { BudgetField } from "@/components/molecules/budget-field";
import { Notice } from "@/components/molecules/notice";
import { Field, FieldDescription, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { NativeSelect, NativeSelectOption } from "@/components/ui/native-select";
import { Textarea } from "@/components/ui/textarea";
import type { ActionResult } from "@/lib/action-result";
import { useT } from "@/lib/i18n/client";

type Scope = "BOTH" | "DOMAIN" | "ASPECT";

export interface AhpPanelOption {
  id: string;
  name: string;
  ready: boolean;
  seats: { seatIndex: number; label: string; field: string }[];
}

export function AhpSessionCreateForm({
  panels,
  groups,
  defaultScenarios,
  blocked,
  mockAi,
  action,
}: {
  panels: AhpPanelOption[];
  groups: { key: string; level: "DOMAIN" | "ASPECT"; size: number }[];
  defaultScenarios: string;
  blocked: string[];
  mockAi: boolean;
  action: (s: ActionResult | null, f: FormData) => Promise<ActionResult | null>;
}) {
  const t = useT();
  const [panelId, setPanelId] = useState(panels.find((p) => p.ready)?.id ?? panels[0]?.id ?? "");
  const panel = panels.find((p) => p.id === panelId);
  const [scopes, setScopes] = useState<Record<number, Scope>>({});

  if (blocked.length) {
    return (
      <Notice tone="locked" title={t("ahpSim.blocked")}>
        <ul className="list-disc pl-4">
          {blocked.map((b) => (
            <li key={b}>{t.maybe(`ahpSim.blockers.${b}`) ?? b}</li>
          ))}
        </ul>
      </Notice>
    );
  }
  if (!panel) return <Notice>{t("ahpSim.noPanel")}</Notice>;

  const pairs = (n: number) => (n * (n - 1)) / 2;
  const calls = panel.seats.reduce((sum, s) => {
    const scope = scopes[s.seatIndex] ?? "BOTH";
    return sum + groups.filter((g) => scope === "BOTH" || scope === g.level).reduce((n, g) => n + pairs(g.size), 0);
  }, 0);

  return (
    <ActionForm action={action} submitLabel={t("ahpSim.create")}>
      <div className="grid gap-4 md:grid-cols-3">
        <Field className="md:col-span-2">
          <FieldLabel htmlFor="ahp-panel">{t("ahpSim.panel")}</FieldLabel>
          <NativeSelect id="ahp-panel" name="configId" value={panelId} onChange={(e) => setPanelId(e.target.value)} className="w-full">
            {panels.map((p) => (
              <NativeSelectOption key={p.id} value={p.id}>
                {p.name} — {p.ready ? t("fgdSim.panelReady") : t("fgdSim.panelNotReady")}
              </NativeSelectOption>
            ))}
          </NativeSelect>
        </Field>
        <Field>
          <FieldLabel htmlFor="ahp-seed">{t("ahpSim.seed")}</FieldLabel>
          <Input id="ahp-seed" name="seed" inputMode="numeric" pattern="\d*" />
        </Field>
      </div>
      <fieldset className="flex flex-col gap-2">
        <legend className="mb-1 text-sm font-medium">{t("ahpSim.seatScope")}</legend>
        <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
          {panel.seats.map((s) => (
            <label key={s.seatIndex} className="flex flex-col gap-1 rounded-xl border p-2 text-xs">
              <span>
                {s.label} · {t.maybe(`enums.${s.field}`) ?? s.field}
              </span>
              <NativeSelect
                name={`scope-${s.seatIndex}`}
                size="sm"
                value={scopes[s.seatIndex] ?? "BOTH"}
                onChange={(e) => setScopes((x) => ({ ...x, [s.seatIndex]: e.target.value as Scope }))}
                className="w-full"
              >
                {(["BOTH", "DOMAIN", "ASPECT"] as const).map((v) => (
                  <NativeSelectOption key={v} value={v}>
                    {t(`ahpSim.scopes.${v}`)}
                  </NativeSelectOption>
                ))}
              </NativeSelect>
            </label>
          ))}
        </div>
      </fieldset>
      <p className="text-sm text-muted-foreground">{t("ahpSim.groups", { groups: groups.length, list: groups.map((g) => `${g.key} (n=${g.size})`).join(", ") })}</p>
      <Field>
        <FieldLabel htmlFor="ahp-scen">{t("ahpSim.scenarios")}</FieldLabel>
        <Textarea id="ahp-scen" name="scenarios" defaultValue={defaultScenarios} rows={6} className="font-mono text-xs" required />
        <FieldDescription>{t("ahpSim.scenariosHint")}</FieldDescription>
      </Field>
      <p className="text-sm tabular-nums">{t("ahpSim.estimate", { calls })}</p>
      <BudgetField id="ahp-budget" />
      <Notice tone={mockAi ? "info" : "warning"}>{mockAi ? t("fgdSim.mockNote") : t("fgdSim.liveNote")}</Notice>
    </ActionForm>
  );
}
