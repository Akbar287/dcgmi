"use client";

import { FormDialog } from "@/components/molecules/form-dialog";
import { Button } from "@/components/ui/button";
import { Field, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Textarea } from "@/components/ui/textarea";
import type { ActionResult } from "@/lib/action-result";
import { useT } from "@/lib/i18n/client";

type Action = (state: ActionResult<unknown> | null, formData: FormData) => Promise<ActionResult<unknown> | null>;

interface Identity {
  id: string;
  panelCode: string;
  fullName: string;
  email: string | null;
  institution: string | null;
  note: string | null;
}

function IdentityDialog({ identity, action }: { identity?: Identity; action: Action }) {
  const t = useT();
  const id = identity?.id ?? "new";
  const input = (name: keyof Identity, label: string, required = false) => (
    <Field>
      <FieldLabel htmlFor={`${id}-${name}`}>{label}</FieldLabel>
      <Input id={`${id}-${name}`} name={name} required={required} defaultValue={(identity?.[name] as string | null) ?? ""} autoComplete="off" />
    </Field>
  );
  return (
    <FormDialog
      title={identity ? t("panelAdmin.identity.editTitle", { code: identity.panelCode }) : t("panelAdmin.identity.newTitle")}
      trigger={<Button variant={identity ? "ghost" : "default"} size="sm">{identity ? t("panelAdmin.edit") : t("panelAdmin.identity.add")}</Button>}
      action={action}
    >
      {identity ? <input type="hidden" name="id" value={identity.id} /> : null}
      <div className="grid gap-4 sm:grid-cols-2">
        {input("panelCode", t("panelAdmin.experts.panelCode"), true)}
        {input("fullName", t("panelAdmin.identity.fullName"), true)}
        {input("email", t("panelAdmin.identity.email"))}
        {input("institution", t("panelAdmin.identity.institution"))}
      </div>
      <Field>
        <FieldLabel htmlFor={`${id}-note`}>{t("panelAdmin.identity.note")}</FieldLabel>
        <Textarea id={`${id}-note`} name="note" defaultValue={identity?.note ?? ""} />
      </Field>
    </FormDialog>
  );
}

export function IdentityTable({ identities, saveAction, deleteAction }: { identities: Identity[]; saveAction: Action; deleteAction: Action }) {
  const t = useT();
  return (
    <div className="flex flex-col gap-3">
      <div>
        <IdentityDialog action={saveAction} />
      </div>
      {identities.length === 0 ? (
        <p className="text-sm text-muted-foreground">{t("panelAdmin.identity.none")}</p>
      ) : (
        <div className="overflow-x-auto rounded-2xl border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>{t("panelAdmin.experts.panelCode")}</TableHead>
                <TableHead>{t("panelAdmin.identity.fullName")}</TableHead>
                <TableHead>{t("panelAdmin.identity.email")}</TableHead>
                <TableHead>{t("panelAdmin.identity.institution")}</TableHead>
                <TableHead className="text-right">
                  <span className="sr-only">{t("columns.action")}</span>
                </TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {identities.map((i) => (
                <TableRow key={i.id}>
                  <TableCell className="font-mono">{i.panelCode}</TableCell>
                  <TableCell>{i.fullName}</TableCell>
                  <TableCell>{i.email ?? "—"}</TableCell>
                  <TableCell>{i.institution ?? "—"}</TableCell>
                  <TableCell className="text-right whitespace-nowrap">
                    <IdentityDialog identity={i} action={saveAction} />
                    <FormDialog
                      title={t("panelAdmin.identity.confirmDelete", { code: i.panelCode })}
                      trigger={<Button variant="ghost" size="sm" className="text-destructive">{t("panelAdmin.identity.delete")}</Button>}
                      action={deleteAction}
                      submitLabel={t("panelAdmin.identity.delete")}
                    >
                      <input type="hidden" name="id" value={i.id} />
                    </FormDialog>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}
    </div>
  );
}
