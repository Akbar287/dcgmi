"use client";

import { useRouter } from "next/navigation";
import { useRef, useState } from "react";

import { ActionForm } from "@/components/molecules/action-form";
import { Notice } from "@/components/molecules/notice";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Field, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { NativeSelect, NativeSelectOption } from "@/components/ui/native-select";
import { Textarea } from "@/components/ui/textarea";
import type { ActionResult } from "@/lib/action-result";
import { useT } from "@/lib/i18n/client";

type Action = (s: ActionResult | null, f: FormData) => Promise<ActionResult | null>;

export function PilotCreateForm({ profiles, models, action }: { profiles: { id: string; label: string }[]; models: { id: string; label: string }[]; action: Action }) {
  const t = useT();
  const select = (name: string, label: string, def: number) => (
    <Field>
      <FieldLabel htmlFor={`pilot-${name}`}>{label}</FieldLabel>
      <NativeSelect id={`pilot-${name}`} name={name} defaultValue={models[def]?.id} className="w-full">
        {models.map((m) => (
          <NativeSelectOption key={m.id} value={m.id}>
            {m.label}
          </NativeSelectOption>
        ))}
      </NativeSelect>
    </Field>
  );
  return (
    <ActionForm action={action} submitLabel={t("pilot.create")}>
      <div className="grid gap-3 md:grid-cols-3">
        {select("assessorA", t("pilot.assessorA"), 0)}
        {select("assessorB", t("pilot.assessorB"), 1)}
        <Field>
          <FieldLabel htmlFor="pilot-seed">{t("fgdSim.seed")}</FieldLabel>
          <Input id="pilot-seed" name="seed" inputMode="numeric" pattern="\d*" />
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
    </ActionForm>
  );
}

export function PilotRunner({ runId, pending, action }: { runId: string; pending: number; action: (id: string) => Promise<ActionResult<{ kind: string; error?: string }>> }) {
  const t = useT();
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const stop = useRef(false);
  const run = async () => {
    setBusy(true);
    stop.current = false;
    for (let n = 1; ; n++) {
      const r = await action(runId);
      if (!r.ok) {
        setMessage(r.error.message);
        break;
      }
      if (r.data.kind === "FAILED") {
        setMessage(r.data.error ?? "FAILED");
        break;
      }
      if (r.data.kind === "PILOT_DONE" || stop.current) break;
      if (n % 10 === 0) router.refresh();
    }
    router.refresh();
    setBusy(false);
  };
  return (
    <div className="flex flex-wrap items-center gap-3">
      <Button size="sm" disabled={busy || pending === 0} onClick={() => void run()}>
        {busy ? t("pilot.running") : t("pilot.run", { n: pending })}
      </Button>
      {busy ? (
        <Button size="sm" variant="ghost" onClick={() => (stop.current = true)}>
          {t("pipeline.pause")}
        </Button>
      ) : null}
      {message ? <Notice tone="warning">{message}</Notice> : null}
    </div>
  );
}

export function DeclarationForms({ ethics, access, action }: { ethics: { reference: string | null; date: string | null } | null; access: { note: string | null } | null; action: Action }) {
  const t = useT();
  return (
    <div className="grid gap-4 md:grid-cols-2">
      <ActionForm action={action} submitLabel={t("pilot.declare")} submitVariant="outline" successLabel={t("editor.saved")} className="rounded-xl border p-3">
        <input type="hidden" name="kind" value="ETHICS" />
        <p className="text-sm font-medium">{t("pilot.ethics")}</p>
        <Input name="reference" defaultValue={ethics?.reference ?? ""} placeholder={t("pilot.ethicsRef")} aria-label={t("pilot.ethicsRef")} required />
        <Input name="date" type="date" defaultValue={ethics?.date ?? ""} aria-label={t("pilot.ethicsDate")} required />
      </ActionForm>
      <ActionForm action={action} submitLabel={t("pilot.declare")} submitVariant="outline" successLabel={t("editor.saved")} className="rounded-xl border p-3">
        <input type="hidden" name="kind" value="ACCESS" />
        <p className="text-sm font-medium">{t("pilot.access")}</p>
        <Textarea name="note" defaultValue={access?.note ?? ""} placeholder={t("pilot.accessNote")} aria-label={t("pilot.accessNote")} rows={3} required minLength={10} />
      </ActionForm>
    </div>
  );
}
