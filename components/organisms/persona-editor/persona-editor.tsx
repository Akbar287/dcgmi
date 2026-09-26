"use client";

import { useActionState } from "react";

import { StatusBadge } from "@/components/atoms/status-badge";
import { Notice } from "@/components/molecules/notice";
import { Button } from "@/components/ui/button";
import { Field, FieldError, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { NativeSelect, NativeSelectOption } from "@/components/ui/native-select";
import { Textarea } from "@/components/ui/textarea";
import type { ActionResult } from "@/lib/action-result";
import type { DeidFinding } from "@/lib/persona/deidentify";
import { INSTITUTION_TYPES, type PersonaBriefInput } from "@/lib/persona/schema";
import { useT } from "@/lib/i18n/client";

import { PersonaStatusActions } from "./persona-status-actions";

type Action = (state: ActionResult<unknown> | null, formData: FormData) => Promise<ActionResult<unknown> | null>;

export interface PersonaEditorProps {
  expertId: string;
  panelCode: string;
  persona: (PersonaBriefInput & { status: string; findings: DeidFinding[]; systemPrompt: string; promptVersion: string }) | null;
  canApprove: boolean;
  saveAction: Action;
  statusAction: Action;
}

export function PersonaEditor({ expertId, panelCode, persona, canApprove, saveAction, statusAction }: PersonaEditorProps) {
  const t = useT();
  const [state, formAction, pending] = useActionState(saveAction, null);
  const p = persona;
  const area = (name: string, label: string, value: string, rows = 3, max?: number) => (
    <Field>
      <FieldLabel htmlFor={`p-${name}`}>{label}</FieldLabel>
      <Textarea id={`p-${name}`} name={name} defaultValue={value} rows={rows} maxLength={max} />
    </Field>
  );
  return (
    <div className="grid gap-6 xl:grid-cols-[minmax(0,3fr)_minmax(0,2fr)]">
      {/* Keyed by the stored prompt so fields reset to the saved text after each save. */}
      <form key={p?.systemPrompt ?? "new"} action={formAction} className="flex flex-col gap-4">
        <input type="hidden" name="expertId" value={expertId} />
        <div className="flex flex-wrap items-center gap-2">
          <h2 className="font-heading text-lg font-semibold">{t("panelAdmin.persona.title", { code: panelCode })}</h2>
          {p ? <StatusBadge value={p.status} label={t.maybe(`enums.${p.status}`) ?? p.status} /> : null}
        </div>
        {p?.status === "APPROVED" ? <Notice tone="warning">{t("panelAdmin.persona.editApprovedWarning")}</Notice> : null}
        {area("expertiseAreas", t("panelAdmin.persona.expertise"), p?.expertiseAreas.join("\n") ?? "", 4)}
        <div className="grid gap-4 sm:grid-cols-2">
          <Field>
            <FieldLabel htmlFor="p-years">{t("panelAdmin.persona.years")}</FieldLabel>
            <Input id="p-years" name="yearsExperience" type="number" min={0} max={60} defaultValue={p?.yearsExperience ?? ""} />
          </Field>
          <Field>
            <FieldLabel htmlFor="p-inst">{t("panelAdmin.persona.institutionType")}</FieldLabel>
            <NativeSelect id="p-inst" name="institutionType" defaultValue={p?.institutionType ?? ""} className="w-full">
              <NativeSelectOption value="">—</NativeSelectOption>
              {INSTITUTION_TYPES.map((i) => (
                <NativeSelectOption key={i} value={i}>
                  {t(`panelAdmin.persona.institution.${i}`)}
                </NativeSelectOption>
              ))}
            </NativeSelect>
          </Field>
        </div>
        {area("researchFocus", t("panelAdmin.persona.researchFocus"), p?.researchFocus.join("\n") ?? "", 3)}
        {area("methodStance", t("panelAdmin.persona.methodStance"), p?.methodStance ?? "", 3, 400)}
        {area("vocabularyHints", t("panelAdmin.persona.vocabulary"), p?.vocabularyHints.join("\n") ?? "", 3)}
        {area("emphasisBias", t("panelAdmin.persona.emphasis"), p?.emphasisBias ?? "", 2, 300)}
        {state && !state.ok ? <FieldError>{state.error.message}</FieldError> : null}
        {state?.ok ? (
          <p role="status" className="text-sm text-success">
            {t("panelAdmin.persona.savedFindings", { n: (state.data as { findings: number }).findings })}
          </p>
        ) : null}
        <Button type="submit" disabled={pending} className="self-start">
          {pending ? t("panelAdmin.saving") : t("panelAdmin.persona.saveDraft")}
        </Button>
      </form>

      <aside className="flex flex-col gap-4">
        <section className="flex flex-col gap-2 rounded-xl border p-4">
          <h3 className="text-sm font-medium">{t("panelAdmin.persona.findingsTitle")}</h3>
          {!p ? (
            <p className="text-sm text-muted-foreground">{t("panelAdmin.persona.noPersona")}</p>
          ) : p.findings.length === 0 ? (
            <p className="text-sm text-muted-foreground">{t("panelAdmin.persona.findingsNone")}</p>
          ) : (
            <>
              <p className="text-sm text-destructive">{t("panelAdmin.persona.findingsHint")}</p>
              <ul className="flex flex-col gap-1 text-sm">
                {p.findings.map((f, i) => (
                  <li key={i}>
                    <span className="font-medium">{t.maybe(`panelAdmin.persona.rules.${f.rule}`) ?? f.rule}</span>
                    {" · "}
                    {t.maybe(`panelAdmin.persona.fields.${f.field}`) ?? f.field}
                    {": "}
                    <mark className="rounded bg-warning/20 px-1">{f.match}</mark>
                  </li>
                ))}
              </ul>
            </>
          )}
        </section>
        {p ? <PersonaStatusActions expertId={expertId} status={p.status} blocked={p.findings.length > 0} canApprove={canApprove} action={statusAction} /> : null}
        {p ? (
          <section className="flex flex-col gap-2 rounded-xl border p-4">
            <h3 className="text-sm font-medium">{t("panelAdmin.persona.promptTitle", { version: p.promptVersion })}</h3>
            <p className="text-xs text-muted-foreground">{t("panelAdmin.persona.promptHint")}</p>
            <pre className="max-h-96 overflow-auto rounded-lg bg-muted/50 p-3 text-xs whitespace-pre-wrap">{p.systemPrompt}</pre>
          </section>
        ) : null}
      </aside>
    </div>
  );
}
