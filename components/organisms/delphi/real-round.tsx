"use client";

import { ActionForm } from "@/components/molecules/action-form";
import { Notice } from "@/components/molecules/notice";
import { Field, FieldDescription, FieldLabel } from "@/components/ui/field";
import { NativeSelect, NativeSelectOption } from "@/components/ui/native-select";
import { Textarea } from "@/components/ui/textarea";
import type { ActionResult } from "@/lib/action-result";
import { useT } from "@/lib/i18n/client";

export function RealRoundCreateForm({
  panels,
  defaultCodes,
  knownCodes,
  plan,
  action,
}: {
  panels: { id: string; name: string }[];
  defaultCodes: string[];
  knownCodes: string[];
  plan: { roundNumber: number; items: number; blocked: string[] };
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
  return (
    <ActionForm action={action} submitLabel={t("delphiReal.create")}>
      <p className="text-sm tabular-nums">{t("delphiReal.plan", { round: plan.roundNumber, items: plan.items })}</p>
      <Field>
        <FieldLabel htmlFor="real-panel">{t("delphiReal.seats")}</FieldLabel>
        <NativeSelect id="real-panel" name="configId" className="w-full">
          {panels.map((p) => (
            <NativeSelectOption key={p.id} value={p.id}>
              {p.name}
            </NativeSelectOption>
          ))}
        </NativeSelect>
      </Field>
      <Field>
        <FieldLabel htmlFor="real-codes">{t("delphiReal.codes")}</FieldLabel>
        <Textarea id="real-codes" name="seatCodes" defaultValue={defaultCodes.join("\n")} rows={8} className="font-mono text-xs" required />
        <FieldDescription>{t("delphiReal.codesHint", { known: knownCodes.join(", ") || "—" })}</FieldDescription>
      </Field>
    </ActionForm>
  );
}

export function RealRoundPanel({
  roundId,
  form,
  seats,
  canCompute,
  finalized,
  action,
}: {
  roundId: string;
  form: { id: string; slug: string; status: string } | null;
  seats: { seatIndex: number; code: string; state: string }[];
  canCompute: boolean;
  finalized: boolean;
  action: (s: ActionResult<{ done: number; deviation: string | null }> | null, f: FormData) => Promise<ActionResult<{ done: number; deviation: string | null }> | null>;
}) {
  const t = useT();
  return (
    <div className="flex flex-col gap-3">
      <p className="text-sm">
        {t("delphiReal.form")}:{" "}
        {form ? (
          <a className="underline underline-offset-4" href={`/forms/sunting/${form.id}`}>
            {form.slug} · {t.maybe(`enums.${form.status}`) ?? form.status}
          </a>
        ) : (
          "—"
        )}
      </p>
      <p className="text-xs text-muted-foreground">{t("delphiReal.flow")}</p>
      <ul className="grid gap-1 sm:grid-cols-4">
        {seats.map((s) => (
          <li key={s.seatIndex} className="flex justify-between rounded-lg border px-2 py-1 text-xs">
            <span>
              {t("delphiSim.feedback.seat")} {s.seatIndex} · <span className="font-mono">{s.code}</span>
            </span>
            <span className={s.state === "SUBMITTED" ? "text-success" : "text-muted-foreground"}>{t(`runner.states.${s.state as "NONE"}`)}</span>
          </li>
        ))}
      </ul>
      {canCompute && !finalized ? (
        <ActionForm action={action} submitLabel={t("delphiReal.compute")} submitVariant="outline" successLabel={t("editor.saved")}>
          <input type="hidden" name="roundId" value={roundId} />
          {form?.status !== "CLOSED" ? <p className="text-xs text-muted-foreground">{t("delphiReal.closeFirst")}</p> : null}
        </ActionForm>
      ) : null}
    </div>
  );
}
