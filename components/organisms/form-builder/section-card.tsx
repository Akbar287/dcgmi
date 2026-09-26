"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";

import { ActionForm } from "@/components/molecules/action-form";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Field, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { NativeSelect, NativeSelectOption } from "@/components/ui/native-select";
import { Textarea } from "@/components/ui/textarea";
import type { ActionResult } from "@/lib/action-result";
import type { SectionDef } from "@/lib/forms/types";
import { useT } from "@/lib/i18n/client";

import { AddFieldButton, FieldDialog } from "./field-dialog";

type Op = "UP" | "DOWN" | "DELETE";

export function SectionCard({
  formId,
  section,
  sections,
  editable,
  saveSection,
  saveField,
  sectionOp,
  fieldOp,
}: {
  formId: string;
  section: SectionDef;
  sections: { order: number; title: string }[];
  editable: boolean;
  saveSection: (s: ActionResult | null, f: FormData) => Promise<ActionResult | null>;
  saveField: (s: ActionResult | null, f: FormData) => Promise<ActionResult | null>;
  sectionOp: (formId: string, sectionId: string, op: Op) => Promise<ActionResult>;
  fieldOp: (formId: string, fieldId: string, op: Op) => Promise<ActionResult>;
}) {
  const t = useT();
  const router = useRouter();
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const run = (fn: () => Promise<ActionResult>) =>
    start(async () => {
      const r = await fn();
      setError(r.ok ? null : r.error.message);
      router.refresh();
    });
  const nextValue = section.next === "NEXT" ? "NEXT" : String(section.next);
  return (
    <section className="flex flex-col gap-3 rounded-2xl border p-4" aria-label={t("builder.section", { n: section.order + 1 })}>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <span className="text-sm font-medium">
          {t("builder.section", { n: section.order + 1 })} · {section.title}
        </span>
        {editable ? (
          <div className="flex gap-1">
            <Button size="sm" variant="ghost" disabled={pending} onClick={() => run(() => sectionOp(formId, section.id, "UP"))}>
              {t("builder.up")}
            </Button>
            <Button size="sm" variant="ghost" disabled={pending} onClick={() => run(() => sectionOp(formId, section.id, "DOWN"))}>
              {t("builder.down")}
            </Button>
            <Button size="sm" variant="ghost" className="text-destructive" disabled={pending} onClick={() => run(() => sectionOp(formId, section.id, "DELETE"))}>
              {t("builder.deleteSection")}
            </Button>
          </div>
        ) : null}
      </div>
      {error ? (
        <p role="alert" className="text-sm text-destructive">
          {error}
        </p>
      ) : null}
      {editable ? (
        <ActionForm action={saveSection} submitLabel={t("builder.saveSection")} submitVariant="outline" className="rounded-xl bg-muted/30 p-3">
          <input type="hidden" name="formId" value={formId} />
          <input type="hidden" name="sectionId" value={section.id} />
          <div className="grid gap-3 sm:grid-cols-2">
            <Field>
              <FieldLabel htmlFor={`st-${section.id}`}>{t("builder.sectionTitle")}</FieldLabel>
              <Input id={`st-${section.id}`} name="title" defaultValue={section.title} required maxLength={200} />
            </Field>
            <Field>
              <FieldLabel htmlFor={`sn-${section.id}`}>{t("builder.next")}</FieldLabel>
              <NativeSelect id={`sn-${section.id}`} name="next" defaultValue={nextValue} className="w-full">
                <NativeSelectOption value="NEXT">{t("builder.nextDefault")}</NativeSelectOption>
                {sections.filter((s) => s.order !== section.order).map((s) => (
                  <NativeSelectOption key={s.order} value={String(s.order)}>
                    {t("builder.goTo", { n: s.order + 1 })} — {s.title}
                  </NativeSelectOption>
                ))}
                <NativeSelectOption value="SUBMIT">{t("builder.nextSubmit")}</NativeSelectOption>
              </NativeSelect>
            </Field>
          </div>
          <Field>
            <FieldLabel htmlFor={`sd-${section.id}`}>{t("builder.sectionDescription")}</FieldLabel>
            <Textarea id={`sd-${section.id}`} name="description" defaultValue={section.description ?? ""} rows={2} maxLength={5000} />
          </Field>
        </ActionForm>
      ) : null}
      <ol className="flex flex-col gap-2">
        {section.fields.map((f) => (
          <li key={f.id} className="flex flex-wrap items-center justify-between gap-2 rounded-xl border px-3 py-2">
            <div className="flex min-w-0 flex-col">
              <span className="truncate text-sm">
                {f.label} {f.required ? <span className="text-destructive">*</span> : null}
              </span>
              <span className="flex flex-wrap gap-1 text-xs text-muted-foreground">
                <Badge variant="secondary">{t(`builder.types.${f.type}`)}</Badge>
                <span className="font-mono">{f.key}</span>
                {f.branching ? <Badge variant="outline">↪ {Object.entries(f.branching).map(([o, v]) => `${o}→${v === "SUBMIT" ? "✓" : Number(v) + 1}`).join(", ")}</Badge> : null}
              </span>
            </div>
            {editable ? (
              <div className="flex gap-1">
                <FieldDialog formId={formId} sectionId={section.id} field={f} sections={sections} action={saveField} trigger={<Button size="sm" variant="outline">{t("builder.edit")}</Button>} />
                <Button size="sm" variant="ghost" disabled={pending} onClick={() => run(() => fieldOp(formId, f.id, "UP"))}>
                  ↑
                </Button>
                <Button size="sm" variant="ghost" disabled={pending} onClick={() => run(() => fieldOp(formId, f.id, "DOWN"))}>
                  ↓
                </Button>
                <Button size="sm" variant="ghost" className="text-destructive" disabled={pending} onClick={() => run(() => fieldOp(formId, f.id, "DELETE"))}>
                  {t("builder.deleteField")}
                </Button>
              </div>
            ) : null}
          </li>
        ))}
      </ol>
      {editable ? <AddFieldButton formId={formId} sectionId={section.id} sections={sections} action={saveField} /> : null}
    </section>
  );
}
