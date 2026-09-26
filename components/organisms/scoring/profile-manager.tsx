"use client";

import { FormDialog } from "@/components/molecules/form-dialog";
import { Button } from "@/components/ui/button";
import { Field, FieldDescription, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import type { ActionResult } from "@/lib/action-result";
import { useT } from "@/lib/i18n/client";

export interface ProfileRow {
  id: string;
  label: string;
  description: string;
  used: number;
}

function ProfileFields({ row }: { row?: ProfileRow }) {
  const t = useT();
  const id = row?.id ?? "new";
  return (
    <>
      {row ? <input type="hidden" name="id" value={row.id} /> : null}
      <Field>
        <FieldLabel htmlFor={`pf-label-${id}`}>{t("scoringSim.profileLabel")}</FieldLabel>
        <Input id={`pf-label-${id}`} name="label" defaultValue={row?.label ?? "[FIKTIF] "} required minLength={3} maxLength={120} />
      </Field>
      <Field>
        <FieldLabel htmlFor={`pf-desc-${id}`}>{t("scoringSim.profileDescription")}</FieldLabel>
        <Textarea id={`pf-desc-${id}`} name="description" defaultValue={row?.description ?? ""} required minLength={40} maxLength={20000} rows={10} />
        <FieldDescription>{t("scoringSim.profileDescriptionHint")}</FieldDescription>
      </Field>
    </>
  );
}

export function ProfileManager({ rows, action, canWrite }: { rows: ProfileRow[]; action: (s: ActionResult | null, f: FormData) => Promise<ActionResult | null>; canWrite: boolean }) {
  const t = useT();
  return (
    <div className="flex flex-col gap-3">
      {rows.length === 0 ? <p className="text-sm text-muted-foreground">{t("scoringSim.profileNone")}</p> : null}
      <ul className="grid gap-2 md:grid-cols-2">
        {rows.map((r) => (
          <li key={r.id} className="flex flex-col gap-1 rounded-xl border p-3">
            <div className="flex items-start justify-between gap-2">
              <span className="text-sm font-medium">{r.label}</span>
              {canWrite && r.used === 0 ? (
                <FormDialog title={r.label} trigger={<Button size="sm" variant="outline">{t("editor.editGroup")}</Button>} action={action}>
                  <ProfileFields row={r} />
                </FormDialog>
              ) : (
                <span className="text-xs text-muted-foreground">{t("scoringSim.profileUsed", { n: r.used })}</span>
              )}
            </div>
            <p className="line-clamp-3 whitespace-pre-line text-xs text-muted-foreground">{r.description}</p>
          </li>
        ))}
      </ul>
      {canWrite ? (
        <FormDialog title={t("scoringSim.profileNew")} trigger={<Button className="self-start" variant="outline">{t("scoringSim.profileNew")}</Button>} action={action}>
          <ProfileFields />
        </FormDialog>
      ) : null}
    </div>
  );
}
