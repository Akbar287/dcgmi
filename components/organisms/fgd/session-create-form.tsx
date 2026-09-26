"use client";

import { useActionState, useMemo, useState } from "react";

import { BudgetField } from "@/components/molecules/budget-field";
import { Notice } from "@/components/molecules/notice";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Field, FieldDescription, FieldError, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { NativeSelect, NativeSelectOption } from "@/components/ui/native-select";
import type { ActionResult } from "@/lib/action-result";
import { AGENDA_CORONG_11, buildAgendaPlan, estimateCalls, type AgendaDomain, type StageKey } from "@/lib/fgd/agenda";
import { useT } from "@/lib/i18n/client";

export function SessionCreateForm({
  panels,
  domains,
  gatePassed,
  mockAi,
  action,
}: {
  panels: { id: string; name: string; ready: boolean; seats: number }[];
  domains: AgendaDomain[];
  gatePassed: boolean;
  mockAi: boolean;
  action: (state: ActionResult | null, formData: FormData) => Promise<ActionResult | null>;
}) {
  const t = useT();
  const [state, formAction, pending] = useActionState(action, null);
  const [stages, setStages] = useState<StageKey[]>(AGENDA_CORONG_11.map((s) => s.key));
  const [picked, setPicked] = useState<string[]>([]);
  const [crossTalk, setCrossTalk] = useState(0);
  const [panelId, setPanelId] = useState(panels.find((p) => p.ready)?.id ?? panels[0]?.id ?? "");
  const seats = panels.find((p) => p.id === panelId)?.seats ?? 6;
  const estimate = useMemo(() => estimateCalls(buildAgendaPlan(domains, { stages, domains: picked }), seats, crossTalk), [domains, stages, picked, seats, crossTalk]);

  if (!gatePassed) return <Notice tone="locked">{t("fgdSim.gateBlocked")}</Notice>;
  if (panels.length === 0) return <Notice>{t("fgdSim.noPanel")}</Notice>;

  const toggle = <T,>(list: T[], v: T) => (list.includes(v) ? list.filter((x) => x !== v) : [...list, v]);

  return (
    <form action={formAction} className="flex flex-col gap-5">
      <div className="grid gap-4 md:grid-cols-4">
        <Field className="md:col-span-2">
          <FieldLabel htmlFor="fgd-panel">{t("fgdSim.panel")}</FieldLabel>
          <NativeSelect id="fgd-panel" name="configId" value={panelId} onChange={(e) => setPanelId(e.target.value)} className="w-full">
            {panels.map((p) => (
              <NativeSelectOption key={p.id} value={p.id}>
                {p.name} — {p.ready ? t("fgdSim.panelReady") : t("fgdSim.panelNotReady")}
              </NativeSelectOption>
            ))}
          </NativeSelect>
        </Field>
        <Field>
          <FieldLabel htmlFor="fgd-cross">{t("fgdSim.crossTalk")}</FieldLabel>
          <NativeSelect id="fgd-cross" name="crossTalkRounds" value={String(crossTalk)} onChange={(e) => setCrossTalk(Number(e.target.value))} className="w-full">
            {[0, 1, 2].map((n) => (
              <NativeSelectOption key={n} value={n}>
                {n}
              </NativeSelectOption>
            ))}
          </NativeSelect>
        </Field>
        <Field>
          <FieldLabel htmlFor="fgd-seed">{t("fgdSim.seed")}</FieldLabel>
          <Input id="fgd-seed" name="seed" type="number" min={0} />
        </Field>
      </div>
      <fieldset className="flex flex-col gap-2">
        <legend className="mb-1 text-sm font-medium">{t("fgdSim.mode")}</legend>
        {(["STEP", "AUTO"] as const).map((m) => (
          <label key={m} className="flex items-center gap-2 text-sm">
            <input type="radio" name="mode" value={m} defaultChecked={m === "STEP"} className="accent-primary" />
            {m === "STEP" ? t("fgdSim.modeStep") : t("fgdSim.modeAuto")}
          </label>
        ))}
      </fieldset>
      <fieldset className="flex flex-col gap-2">
        <legend className="mb-1 text-sm font-medium">{t("fgdSim.stages")}</legend>
        <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
          {AGENDA_CORONG_11.map((s, i) => (
            <label key={s.key} className="flex items-center gap-2 text-sm">
              <Checkbox name="stages" value={s.key} checked={stages.includes(s.key)} onCheckedChange={() => setStages((x) => toggle(x, s.key))} />
              {i + 1}. {s.title}
            </label>
          ))}
        </div>
      </fieldset>
      <fieldset className="flex flex-col gap-2">
        <legend className="mb-1 text-sm font-medium">{t("fgdSim.domains")}</legend>
        <div className="flex flex-wrap gap-3">
          {domains.map((d) => (
            <label key={d.code} className="flex items-center gap-2 text-sm">
              <Checkbox name="domains" value={d.code} checked={picked.includes(d.code)} onCheckedChange={() => setPicked((x) => toggle(x, d.code))} />
              {d.code}
            </label>
          ))}
        </div>
        <FieldDescription>{t("fgdSim.domainsHint")}</FieldDescription>
      </fieldset>
      <p className="text-sm font-medium tabular-nums" aria-live="polite">
        {t("fgdSim.estimate", { components: estimate.components, calls: estimate.calls })}
      </p>
      <BudgetField id="fgd-budget" />
      <Notice tone={mockAi ? "info" : "warning"}>{mockAi ? t("fgdSim.mockNote") : t("fgdSim.liveNote")}</Notice>
      {state && !state.ok ? <FieldError>{state.error.message}</FieldError> : null}
      <Button type="submit" disabled={pending || estimate.components === 0} className="self-start">
        {pending ? t("panelAdmin.saving") : t("fgdSim.create")}
      </Button>
    </form>
  );
}
