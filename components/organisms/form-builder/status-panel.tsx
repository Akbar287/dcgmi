"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";

import { StatusBadge } from "@/components/atoms/status-badge";
import { Notice } from "@/components/molecules/notice";
import { Button } from "@/components/ui/button";
import type { ActionResult } from "@/lib/action-result";
import { useT } from "@/lib/i18n/client";

type Status = "DRAFT" | "DRY_RUN" | "HOLD" | "ACTIVE" | "CLOSED";

export function StatusPanel({
  formId,
  status,
  allowed,
  issues,
  action,
}: {
  formId: string;
  status: string;
  allowed: Status[];
  issues: string[];
  action: (formId: string, to: Status) => Promise<ActionResult>;
}) {
  const t = useT();
  const router = useRouter();
  const [pending, start] = useTransition();
  const [error, setError] = useState<{ message: string; details: string[] } | null>(null);
  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap items-center gap-2">
        <StatusBadge value={status} label={t.maybe(`enums.${status}`) ?? status} />
        {allowed.map((to) => (
          <Button
            key={to}
            size="sm"
            variant={to === "ACTIVE" ? "default" : "outline"}
            disabled={pending}
            onClick={() =>
              start(async () => {
                const r = await action(formId, to);
                setError(r.ok ? null : { message: r.error.message, details: Array.isArray(r.error.details) ? (r.error.details as string[]) : [] });
                router.refresh();
              })
            }
          >
            {t("builder.setStatus", { status: t.maybe(`enums.${to}`) ?? to })}
          </Button>
        ))}
      </div>
      <p className="text-xs text-muted-foreground">{t("builder.statusHint")}</p>
      {error ? (
        <Notice tone="warning" title={error.message}>
          <ul className="list-disc pl-4 font-mono text-xs">
            {error.details.map((d) => (
              <li key={d}>{d}</li>
            ))}
          </ul>
        </Notice>
      ) : null}
      <div>
        <p className="text-sm font-medium">{t("builder.checkTitle")}</p>
        {issues.length === 0 ? (
          <p className="text-xs text-muted-foreground">{t("builder.checkOk")}</p>
        ) : (
          <ul className="mt-1 list-disc pl-4 font-mono text-xs text-warning">
            {issues.map((i) => (
              <li key={i}>{i}</li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
