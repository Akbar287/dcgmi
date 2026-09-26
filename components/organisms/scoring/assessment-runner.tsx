"use client";

import { useRouter } from "next/navigation";
import { useRef, useState } from "react";

import { StatusBadge } from "@/components/atoms/status-badge";
import { Notice } from "@/components/molecules/notice";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import type { ActionResult } from "@/lib/action-result";
import { useT } from "@/lib/i18n/client";
import type { ScoringRunOutcome } from "@/lib/scoring/run-item";

export function AssessmentRunner({
  assessmentId,
  status,
  done,
  total,
  error,
  runAction,
  controlAction,
}: {
  assessmentId: string;
  status: string;
  done: number;
  total: number;
  error: string | null;
  runAction: (id: string) => Promise<ActionResult<ScoringRunOutcome>>;
  controlAction: (id: string, action: "PAUSE" | "RETRY" | "CANCEL") => Promise<ActionResult>;
}) {
  const t = useT();
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const stop = useRef(false);
  const active = ["QUEUED", "RUNNING", "PAUSED"].includes(status);

  const run = async (loop: boolean) => {
    setBusy(true);
    setMessage(null);
    stop.current = false;
    for (;;) {
      const r = await runAction(assessmentId);
      router.refresh();
      if (!r.ok) {
        setMessage(r.error.message);
        break;
      }
      if (r.data.kind === "FAILED") setMessage(t("scoringSim.room.failed", { error: r.data.error }));
      if (!(loop && !stop.current && r.data.kind === "ITEM_DONE")) break;
    }
    setBusy(false);
  };

  const control = async (action: "PAUSE" | "RETRY" | "CANCEL") => {
    stop.current = true;
    await controlAction(assessmentId, action);
    router.refresh();
  };

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap items-center gap-3">
        <StatusBadge value={status} label={t.maybe(`enums.${status}`) ?? status} />
        <span className="text-sm tabular-nums text-muted-foreground">{t("scoringSim.room.progress", { done, total })}</span>
        <div className="ml-auto flex flex-wrap gap-2">
          <Button size="sm" disabled={!active || busy} onClick={() => void run(false)}>
            {busy ? t("scoringSim.room.running") : t("scoringSim.room.runNext")}
          </Button>
          <Button size="sm" variant="outline" disabled={!active || busy} onClick={() => void run(true)}>
            {t("scoringSim.room.runAuto")}
          </Button>
          <Button size="sm" variant="ghost" disabled={!busy} onClick={() => void control("PAUSE")}>
            {t("scoringSim.room.pause")}
          </Button>
          {status === "FAILED" ? (
            <Button size="sm" variant="outline" onClick={() => void control("RETRY")}>
              {t("scoringSim.room.retry")}
            </Button>
          ) : null}
          {active || status === "FAILED" ? (
            <Button size="sm" variant="ghost" className="text-destructive" disabled={busy} onClick={() => void control("CANCEL")}>
              {t("scoringSim.room.cancel")}
            </Button>
          ) : null}
        </div>
      </div>
      <Progress value={total ? Math.round((done / total) * 100) : 0} aria-label={t("scoringSim.room.progress", { done, total })} />
      {message ? <Notice tone="warning">{message}</Notice> : null}
      {!message && error && status === "FAILED" ? <Notice tone="warning">{t("scoringSim.room.failed", { error })}</Notice> : null}
    </div>
  );
}
