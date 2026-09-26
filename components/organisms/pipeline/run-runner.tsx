"use client";

import { useRouter } from "next/navigation";
import { useRef, useState } from "react";

import { Notice } from "@/components/molecules/notice";
import { Button } from "@/components/ui/button";
import type { ActionResult } from "@/lib/action-result";
import { useT } from "@/lib/i18n/client";
import type { AdvanceOutcome } from "@/lib/pipeline/advance";

export function RunRunner({
  runId,
  status,
  mode,
  advanceAction,
  controlAction,
}: {
  runId: string;
  status: string;
  mode: string;
  advanceAction: (id: string) => Promise<ActionResult<AdvanceOutcome>>;
  controlAction: (id: string, action: "PAUSE" | "CANCEL" | "RETRY") => Promise<ActionResult>;
}) {
  const t = useT();
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const stop = useRef(false);
  const active = ["QUEUED", "RUNNING", "PAUSED"].includes(status);

  // One unit of work per call; waits and STEP boundaries end the loop (docs/01).
  const run = async () => {
    setBusy(true);
    setMessage(null);
    stop.current = false;
    for (let n = 1; ; n++) {
      const r = await advanceAction(runId);
      if (!r.ok) {
        setMessage(r.error.message);
        break;
      }
      const o = r.data;
      if (o.kind === "FAILED") setMessage(t("pipeline.failed", { error: o.error }));
      const again = !stop.current && (o.kind === "WORKED" || (o.kind === "STEP_DONE" && mode === "AUTO"));
      if (!again) break;
      if (n % 5 === 0) router.refresh();
    }
    router.refresh();
    setBusy(false);
  };

  const control = async (action: "PAUSE" | "CANCEL" | "RETRY") => {
    stop.current = true;
    await controlAction(runId, action);
    router.refresh();
  };

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap gap-2">
        <Button size="sm" disabled={!active || busy} onClick={() => void run()}>
          {busy ? t("pipeline.running") : status === "QUEUED" ? t("pipeline.start") : t("pipeline.resume")}
        </Button>
        <Button size="sm" variant="ghost" disabled={!busy} onClick={() => void control("PAUSE")}>
          {t("pipeline.pause")}
        </Button>
        {status === "FAILED" ? (
          <Button size="sm" variant="outline" onClick={() => void control("RETRY")}>
            {t("pipeline.retry")}
          </Button>
        ) : null}
        {active || status === "FAILED" ? (
          <Button size="sm" variant="ghost" className="text-destructive" disabled={busy} onClick={() => void control("CANCEL")}>
            {t("pipeline.cancel")}
          </Button>
        ) : null}
      </div>
      {message ? <Notice tone="warning">{message}</Notice> : null}
    </div>
  );
}
