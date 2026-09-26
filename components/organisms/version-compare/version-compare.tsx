"use client";

import { useState, useTransition } from "react";

import { CodeText } from "@/components/atoms/code-text";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Field, FieldLabel } from "@/components/ui/field";
import { NativeSelect, NativeSelectOption } from "@/components/ui/native-select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import type { ActionResult } from "@/lib/action-result";
import type { DiffEntry } from "@/lib/artifact/diff";
import { useT } from "@/lib/i18n/client";

export function VersionCompare({
  versions,
  initial,
  action,
}: {
  versions: { id: string; label: string }[];
  initial: { fromId: string; toId: string; entries: DiffEntry[] };
  action: (fromId: string, toId: string) => Promise<ActionResult<DiffEntry[]>>;
}) {
  const t = useT();
  const [fromId, setFrom] = useState(initial.fromId);
  const [toId, setTo] = useState(initial.toId);
  const [entries, setEntries] = useState(initial.entries);
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();

  const run = () =>
    start(async () => {
      const r = await action(fromId, toId);
      if (r.ok) {
        setEntries(r.data);
        setError(null);
      } else setError(r.error.message);
    });

  const select = (id: string, value: string, onChange: (v: string) => void, label: string) => (
    <Field className="w-auto">
      <FieldLabel htmlFor={id}>{label}</FieldLabel>
      <NativeSelect id={id} value={value} onChange={(e) => onChange(e.target.value)}>
        {versions.map((v) => (
          <NativeSelectOption key={v.id} value={v.id}>
            {v.label}
          </NativeSelectOption>
        ))}
      </NativeSelect>
    </Field>
  );

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-end gap-3">
        {select("cmp-from", fromId, setFrom, t("compare.from"))}
        {select("cmp-to", toId, setTo, t("compare.to"))}
        <Button onClick={run} disabled={pending}>
          {t("compare.run")}
        </Button>
        <span className="text-sm text-muted-foreground" role="status">
          {t("compare.summary", { count: entries.length })}
        </span>
      </div>
      {error ? <p className="text-sm text-destructive">{error}</p> : null}
      {entries.length === 0 ? (
        <p className="text-sm text-muted-foreground">{t("compare.none")}</p>
      ) : (
        <div className="overflow-x-auto rounded-2xl border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>{t("columns.code")}</TableHead>
                <TableHead>{t("columns.kind")}</TableHead>
                <TableHead>{t("columns.name")}</TableHead>
                <TableHead>{t("columns.description")}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {entries.map((e, i) => (
                <TableRow key={`${e.code}-${e.kind}-${i}`}>
                  <TableCell>
                    <CodeText>{e.code}</CodeText>
                  </TableCell>
                  <TableCell>
                    <Badge variant={e.kind === "REMOVED" ? "destructive" : e.kind === "ADDED" ? "default" : "secondary"}>{t(`compare.kinds.${e.kind}`)}</Badge>
                  </TableCell>
                  <TableCell className="max-w-xs">{e.name}</TableCell>
                  <TableCell className="max-w-xl text-sm whitespace-pre-line text-muted-foreground">{e.detail}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}
    </div>
  );
}
