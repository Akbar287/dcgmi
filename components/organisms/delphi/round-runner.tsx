"use client";

import { useRouter } from "next/navigation";
import { useRef, useState } from "react";

import { StatusBadge } from "@/components/atoms/status-badge";
import { Notice } from "@/components/molecules/notice";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import type { ActionResult } from "@/lib/action-result";
import type { DelphiRunOutcome } from "@/lib/delphi/run-round";
import { useT } from "@/lib/i18n/client";

export function RoundRunner({
  roundId,
  status,
  finalized,
  done,
  total,
  error,
  runAction,
  controlAction,
}: {
  roundId: string;
  status: string;
  finalized: boolean;
  done: number;
  total: number;
  error: string | null;
  runAction: (roundId: string) => Promise<ActionResult<DelphiRunOutcome>>;
  controlAction: (roundId: string, action: "PAUSE" | "RETRY") => Promise<ActionResult>;
}) {
  const t = useT();
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const stop = useRef(false);
  const active = !finalized && ["QUEUED", "RUNNING", "PAUSED"].includes(status);

  // One item per server call: each call is a checkpoint (docs/01).
  const run = async (loop: boolean) => {
    setBusy(true);
    setMessage(null);
    stop.current = false;
    for (;;) {
      const r = await runAction(roundId);
      router.refresh();
      if (!r.ok) {
        setMessage(r.error.message);
        break;
      }
      if (r.data.kind === "DEVIATION") setMessage(t("delphiSim.room.deviation", { error: r.data.error }));
      if (!(loop && !stop.current && r.data.kind === "ITEM_DONE")) break;
    }
    setBusy(false);
  };

  const control = async (action: "PAUSE" | "RETRY") => {
    stop.current = true;
    await controlAction(roundId, action);
    router.refresh();
  };

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap items-center gap-3">
        <StatusBadge value={status} label={t.maybe(`enums.${status}`) ?? status} />
        <span className="text-sm tabular-nums text-muted-foreground">{t("delphiSim.room.progress", { done, total })}</span>
        <div className="ml-auto flex flex-wrap gap-2">
          <Button size="sm" disabled={!active || busy} onClick={() => void run(false)}>
            {busy ? t("delphiSim.room.running") : t("delphiSim.room.runNext")}
          </Button>
          <Button size="sm" variant="outline" disabled={!active || busy} onClick={() => void run(true)}>
            {t("delphiSim.room.runAuto")}
          </Button>
          <Button size="sm" variant="ghost" disabled={!busy} onClick={() => void control("PAUSE")}>
            {t("delphiSim.room.pause")}
          </Button>
          {status === "FAILED" && !finalized ? (
            <Button size="sm" variant="outline" onClick={() => void control("RETRY")}>
              {t("delphiSim.room.retry")}
            </Button>
          ) : null}
        </div>
      </div>
      <Progress value={total ? Math.round((done / total) * 100) : 0} aria-label={t("delphiSim.room.progress", { done, total })} />
      {message ? <Notice tone="warning">{message}</Notice> : null}
      {!message && error && status === "FAILED" ? <Notice tone="warning">{t("delphiSim.room.deviation", { error })}</Notice> : null}
      {status === "COMPLETED" && !finalized ? <Notice>{t("delphiSim.room.done")}</Notice> : null}
    </div>
  );
}
