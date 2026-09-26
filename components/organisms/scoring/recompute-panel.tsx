"use client";

import { ActionForm } from "@/components/molecules/action-form";
import { Field, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import type { ActionResult } from "@/lib/action-result";
import { useT } from "@/lib/i18n/client";

export function RecomputePanel({
  exportSha,
  lastCheck,
  canUpload,
  action,
}: {
  exportSha: string;
  lastCheck: { ok: boolean; diffCount: number; at: string; stale: boolean } | null;
  canUpload: boolean;
  action: (s: ActionResult | null, f: FormData) => Promise<ActionResult | null>;
}) {
  const t = useT();
  return (
    <div className="flex flex-col gap-3 text-sm">
      <p className="text-muted-foreground">{t("scoringSim.recomputeHint")}</p>
      <a href="/api/export/recompute" className="self-start rounded-4xl border px-4 py-2 text-sm font-medium hover:bg-muted" download>
        {t("scoringSim.download")}
      </a>
      <p className="break-all font-mono text-xs text-muted-foreground">{t("scoringSim.exportSha", { sha: exportSha })}</p>
      {lastCheck ? (
        <p className="text-xs">
          {t("scoringSim.lastCheck", {
            status: lastCheck.stale ? t("scoringSim.checkStale") : lastCheck.ok ? t("scoringSim.checkOk") : t("scoringSim.checkDiff"),
            diffs: lastCheck.diffCount,
            at: lastCheck.at,
          })}
        </p>
      ) : null}
      {canUpload ? (
        <ActionForm action={action} submitLabel={t("scoringSim.upload")} submitVariant="outline" resetOnSuccess>
          <Field>
            <FieldLabel htmlFor="rc-report">{t("scoringSim.report")}</FieldLabel>
            <Input id="rc-report" name="report" type="file" accept="application/json,.json" required />
          </Field>
        </ActionForm>
      ) : null}
    </div>
  );
}
