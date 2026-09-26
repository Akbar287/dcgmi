"use client";

import { useRouter } from "next/navigation";
import { useRef, useState } from "react";

import { StatusBadge } from "@/components/atoms/status-badge";
import { Notice } from "@/components/molecules/notice";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import type { ActionResult } from "@/lib/action-result";
import type { AhpRunOutcome } from "@/lib/ahp/run-matrix";
import { useT } from "@/lib/i18n/client";

export function AhpSessionRunner({
  sessionId,
  status,
  done,
  total,
  error,
  runAction,
  controlAction,
}: {
  sessionId: string;
  status: string;
  done: number;
  total: number;
  error: string | null;
  runAction: (id: string) => Promise<ActionResult<AhpRunOutcome>>;
  controlAction: (id: string, action: "PAUSE" | "RETRY") => Promise<ActionResult>;
}) {
  const t = useT();
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const stop = useRef(false);
  const active = ["QUEUED", "RUNNING", "PAUSED"].includes(status);

  // One seat matrix per server call; every call is a checkpoint (docs/01).
  const run = async (loop: boolean) => {
    setBusy(true);
    setMessage(null);
    stop.current = false;
    for (;;) {
      const r = await runAction(sessionId);
      router.refresh();
      if (!r.ok) {
        setMessage(r.error.message);
        break;
      }
      if (r.data.kind === "FAILED") setMessage(t("ahpSim.room.failed", { error: r.data.error }));
      if (!(loop && !stop.current && r.data.kind === "MATRIX_DONE")) break;
    }
    setBusy(false);
  };

  const control = async (action: "PAUSE" | "RETRY") => {
    stop.current = true;
    await controlAction(sessionId, action);
    router.refresh();
  };

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap items-center gap-3">
        <StatusBadge value={status} label={t.maybe(`enums.${status}`) ?? status} />
        <span className="text-sm tabular-nums text-muted-foreground">{t("ahpSim.room.progress", { done, total })}</span>
        <div className="ml-auto flex flex-wrap gap-2">
          <Button size="sm" disabled={!active || busy} onClick={() => void run(false)}>
            {busy ? t("ahpSim.room.running") : t("ahpSim.room.runNext")}
          </Button>
          <Button size="sm" variant="outline" disabled={!active || busy} onClick={() => void run(true)}>
            {t("ahpSim.room.runAuto")}
          </Button>
          <Button size="sm" variant="ghost" disabled={!busy} onClick={() => void control("PAUSE")}>
            {t("ahpSim.room.pause")}
          </Button>
          {status === "FAILED" ? (
            <Button size="sm" variant="outline" onClick={() => void control("RETRY")}>
              {t("ahpSim.room.retry")}
            </Button>
          ) : null}
        </div>
      </div>
      <Progress value={total ? Math.round((done / total) * 100) : 0} aria-label={t("ahpSim.room.progress", { done, total })} />
      {message ? <Notice tone="warning">{message}</Notice> : null}
      {!message && error && status === "FAILED" ? <Notice tone="warning">{t("ahpSim.room.failed", { error })}</Notice> : null}
      {status === "COMPLETED" ? <Notice>{t("ahpSim.room.done")}</Notice> : null}
      {status === "COMPLETED" && error ? <Notice tone="warning">{error}</Notice> : null}
    </div>
  );
}
