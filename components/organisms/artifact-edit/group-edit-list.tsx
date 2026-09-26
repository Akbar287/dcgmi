"use client";

import { FormDialog } from "@/components/molecules/form-dialog";
import { EditMetaFields, type RevisionTaskOption } from "@/components/organisms/indicator-editor/edit-meta-fields";
import { Button } from "@/components/ui/button";
import { Field, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import type { ActionResult } from "@/lib/action-result";
import { useT } from "@/lib/i18n/client";

type Action = (s: ActionResult<unknown> | null, f: FormData) => Promise<ActionResult<unknown> | null>;

export interface GroupRow {
  id: string;
  code: string;
  name: string;
  rationale: string | null;
  sdgTags?: string[];
}

/** Name/rationale (and SDG tags for domains) edits of a DRAFT version. */
export function GroupEditList({ type, rows, tasks, action }: { type: "Domain" | "Aspect"; rows: GroupRow[]; tasks: RevisionTaskOption[]; action: Action }) {
  const t = useT();
  return (
    <ul className="grid gap-2 sm:grid-cols-2 xl:grid-cols-3">
      {rows.map((r) => (
        <li key={r.id} className="flex items-center justify-between gap-3 rounded-xl border px-3 py-2">
          <span className="min-w-0 truncate text-sm">
            <span className="font-mono text-xs">{r.code}</span> {r.name}
          </span>
          <FormDialog title={`${t("editor.editGroup")} ${r.code}`} trigger={<Button size="sm" variant="outline">{t("editor.editGroup")}</Button>} action={action}>
            <input type="hidden" name="type" value={type} />
            <input type="hidden" name="id" value={r.id} />
            <Field>
              <FieldLabel htmlFor={`g-${r.id}-name`}>{t("editor.groupName")}</FieldLabel>
              <Input id={`g-${r.id}-name`} name="name" defaultValue={r.name} required minLength={2} maxLength={300} />
            </Field>
            <Field>
              <FieldLabel htmlFor={`g-${r.id}-rat`}>{t("editor.rationale")}</FieldLabel>
              <Textarea id={`g-${r.id}-rat`} name="rationale" defaultValue={r.rationale ?? ""} rows={4} maxLength={4000} />
            </Field>
            {r.sdgTags ? (
              <Field>
                <FieldLabel htmlFor={`g-${r.id}-sdg`}>{t("editor.sdgTags")}</FieldLabel>
                <Input id={`g-${r.id}-sdg`} name="sdgTags" defaultValue={r.sdgTags.join(", ")} />
              </Field>
            ) : null}
            <EditMetaFields ctx={{ code: r.code, exception: false, tasks: tasks }} idPrefix={`g-${r.id}`} />
          </FormDialog>
        </li>
      ))}
    </ul>
  );
}
