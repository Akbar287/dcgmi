"use client";

import { useActionState } from "react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { NativeSelect, NativeSelectOption } from "@/components/ui/native-select";
import { TableCell, TableRow } from "@/components/ui/table";
import type { ActionResult } from "@/lib/action-result";
import { useT } from "@/lib/i18n/client";

export interface SeatRowData {
  id: string;
  seatIndex: number;
  label: string;
  field: string;
  isNewMember: boolean;
  expertId: string | null;
  modelId: string;
  temperature: number;
  seed: number | null;
}

export function SeatRow({
  seat,
  experts,
  models,
  action,
}: {
  seat: SeatRowData;
  experts: { id: string; panelCode: string; personaStatus: string | null }[];
  models: { id: string; label: string }[];
  action: (state: ActionResult | null, formData: FormData) => Promise<ActionResult | null>;
}) {
  const t = useT();
  const [state, formAction, pending] = useActionState(action, null);
  const formId = `seat-${seat.id}`;
  return (
    <TableRow>
      <TableCell>
        <div className="flex flex-col">
          <span className="font-medium">{seat.label}</span>
          <span className="text-xs text-muted-foreground">
            {t.maybe(`enums.${seat.field}`) ?? seat.field}
            {seat.isNewMember ? ` · ${t("panelAdmin.seats.newMember")}` : null}
          </span>
        </div>
      </TableCell>
      <TableCell>
        <form id={formId} key={`${seat.expertId}|${seat.modelId}|${seat.temperature}|${seat.seed}`} action={formAction}>
          <input type="hidden" name="seatId" value={seat.id} />
        </form>
        <NativeSelect form={formId} name="expertId" size="sm" defaultValue={seat.expertId ?? ""} aria-label={`${t("panelAdmin.seats.expert")} ${seat.label}`}>
          <NativeSelectOption value="">{t("panelAdmin.seats.unassigned")}</NativeSelectOption>
          {experts.map((e) => (
            <NativeSelectOption key={e.id} value={e.id}>
              {e.panelCode} · {t.maybe(`enums.${e.personaStatus ?? ""}`) ?? t("panelAdmin.persona.noPersona")}
            </NativeSelectOption>
          ))}
        </NativeSelect>
      </TableCell>
      <TableCell>
        <NativeSelect form={formId} name="modelProfileId" size="sm" defaultValue={seat.modelId} aria-label={`${t("panelAdmin.seats.model")} ${seat.label}`}>
          {models.map((m) => (
            <NativeSelectOption key={m.id} value={m.id}>
              {m.label}
            </NativeSelectOption>
          ))}
        </NativeSelect>
      </TableCell>
      <TableCell>
        <Input form={formId} name="temperature" type="number" step="0.1" min={0} max={2} defaultValue={seat.temperature} className="w-20" aria-label={`${t("panelAdmin.seats.temperature")} ${seat.label}`} />
      </TableCell>
      <TableCell>
        <Input form={formId} name="seed" type="number" min={0} defaultValue={seat.seed ?? ""} className="w-28" aria-label={`${t("panelAdmin.seats.seed")} ${seat.label}`} />
      </TableCell>
      <TableCell className="text-right">
        <Button form={formId} type="submit" size="sm" variant="outline" disabled={pending}>
          {pending ? t("panelAdmin.saving") : t("panelAdmin.save")}
        </Button>
        {state && !state.ok ? (
          <p role="alert" className="mt-1 max-w-56 text-xs text-destructive">
            {state.error.message}
          </p>
        ) : null}
      </TableCell>
    </TableRow>
  );
}
