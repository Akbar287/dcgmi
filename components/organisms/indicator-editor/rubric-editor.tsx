"use client";

import { useState } from "react";

import { ActionForm } from "@/components/molecules/action-form";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import type { ActionResult } from "@/lib/action-result";
import { checkRubric, type EvidenceInput } from "@/lib/artifact/rubric-check";
import { useT } from "@/lib/i18n/client";
import { cn } from "@/lib/utils";

import { EditMetaFields, type EditContext } from "./edit-meta-fields";

type Action = (s: ActionResult<unknown> | null, f: FormData) => Promise<ActionResult<unknown> | null>;

export interface RubricRow {
  level: number;
  label: string;
  descriptor: string;
}

/** Five side-by-side levels with the docs/06 §4 checks evaluated as the researcher types. */
export function RubricEditor({
  indicatorId,
  levels,
  initial,
  evidence,
  ctx,
  action,
  readOnly,
  defaultTask,
}: {
  indicatorId: string;
  levels: number[];
  initial: RubricRow[];
  evidence: EvidenceInput[];
  ctx: EditContext;
  action: Action;
  readOnly: boolean;
  defaultTask?: string | null;
}) {
  const t = useT();
  const [rows, setRows] = useState<RubricRow[]>(() =>
    levels.map((level) => initial.find((r) => r.level === level) ?? { level, label: "", descriptor: "" }),
  );
  const issues = checkRubric(rows, evidence);
  const flagged = new Set(issues.filter((i) => i.blocking && i.level !== undefined).map((i) => i.level));
  const set = (level: number, patch: Partial<RubricRow>) => setRows((rs) => rs.map((r) => (r.level === level ? { ...r, ...patch } : r)));

  const grid = (
    <div className="grid gap-3 md:grid-cols-5">
      {rows.map((r) => (
        <div key={r.level} className={cn("flex flex-col gap-2 rounded-xl border p-3", flagged.has(r.level) && "border-destructive/60")}>
          <span className="text-xs font-medium tabular-nums text-muted-foreground">Level {r.level}</span>
          <Input
            name={`label-${r.level}`}
            aria-label={`${t("editor.levelLabel")} ${r.level}`}
            placeholder={t("editor.levelLabel")}
            value={r.label}
            onChange={(e) => set(r.level, { label: e.target.value })}
            readOnly={readOnly}
          />
          <Textarea
            name={`descriptor-${r.level}`}
            aria-label={`${t("editor.levelDescriptor")} ${r.level}`}
            value={r.descriptor}
            onChange={(e) => set(r.level, { descriptor: e.target.value })}
            rows={8}
            readOnly={readOnly}
            className="text-sm"
          />
        </div>
      ))}
    </div>
  );

  const checks = (
    <div className="rounded-xl bg-muted/40 p-3 text-sm" aria-live="polite">
      <p className="mb-1 font-medium">{t("editor.rubricCheck")}</p>
      {issues.length === 0 ? (
        <p className="text-muted-foreground">{t("editor.rubricOk")}</p>
      ) : (
        <ul className="flex flex-col gap-0.5">
          {issues.map((i, n) => (
            <li key={n} className={i.blocking ? "text-destructive" : "text-muted-foreground"}>
              {t(`editor.issues.${i.code}`, { level: i.level ?? "" })}
            </li>
          ))}
        </ul>
      )}
    </div>
  );

  if (readOnly) {
    return (
      <div className="flex flex-col gap-3">
        {grid}
        {checks}
      </div>
    );
  }
  return (
    <ActionForm action={action} submitLabel={t("editor.save")} successLabel={t("editor.saved")}>
      <input type="hidden" name="indicatorId" value={indicatorId} />
      {grid}
      {checks}
      <EditMetaFields ctx={ctx} idPrefix="rubric" defaultTask={defaultTask} />
    </ActionForm>
  );
}
