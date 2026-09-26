"use client";

import { useRouter } from "next/navigation";
import { useRef, useState } from "react";

import { StatusBadge } from "@/components/atoms/status-badge";
import { Notice } from "@/components/molecules/notice";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type { ActionResult } from "@/lib/action-result";
import type { RunOutcome } from "@/lib/fgd/run-item";
import { useT } from "@/lib/i18n/client";

import { AgendaPanel } from "./agenda-panel";
import { DecisionPanel } from "./decision-panel";
import { SeatPanel } from "./seat-panel";
import { TranscriptPanel } from "./transcript-panel";
import type { RoomView } from "./types";

export function SessionRoom({
  room,
  runAction,
  controlAction,
}: {
  room: RoomView;
  runAction: (sessionId: string) => Promise<ActionResult<RunOutcome>>;
  controlAction: (sessionId: string, action: "PAUSE" | "CANCEL" | "RETRY_FAILED") => Promise<ActionResult>;
}) {
  const t = useT();
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<{ tone: "info" | "warning"; text: string } | null>(null);
  const stop = useRef(false);
  const active = ["QUEUED", "RUNNING", "PAUSED"].includes(room.status);

  // Client-driven loop over one-component server steps: every step is a checkpoint,
  // so a closed tab or an error never leaves a half-written component (docs/01).
  const run = async (loop: boolean) => {
    setBusy(true);
    setMessage(null);
    stop.current = false;
    for (;;) {
      const r = await runAction(room.sessionId);
      router.refresh();
      if (!r.ok) {
        setMessage({ tone: "warning", text: r.error.message });
        break;
      }
      const o = r.data;
      if (o.kind === "FAILED") setMessage({ tone: "warning", text: t("fgdSim.room.failed", { error: o.error }) });
      if (o.kind === "STOPPED_SPECIAL") setMessage({ tone: "warning", text: t("fgdSim.room.stoppedSpecial") });
      if (o.kind === "SESSION_DONE") setMessage({ tone: "info", text: t("fgdSim.room.sessionDone") });
      if (o.kind === "STAGE_DONE" && room.mode === "STEP") setMessage({ tone: "info", text: t("fgdSim.room.stageDone") });
      const keepGoing = loop && !stop.current && (o.kind === "ITEM_DONE" || (o.kind === "STAGE_DONE" && room.mode === "AUTO"));
      if (!keepGoing) break;
    }
    setBusy(false);
  };

  const control = async (action: "PAUSE" | "CANCEL" | "RETRY_FAILED") => {
    stop.current = true;
    await controlAction(room.sessionId, action);
    router.refresh();
  };

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center gap-2">
        <StatusBadge value={room.status} label={t.maybe(`enums.${room.status}`) ?? room.status} />
        <span className="text-xs text-muted-foreground">{t("fgdSim.room.meta", { version: room.versionLabel, seed: room.seed, mode: room.mode })}</span>
        <span className="text-xs text-muted-foreground tabular-nums">{t("fgdSim.room.calls", { calls: room.calls, tin: room.tokensIn, tout: room.tokensOut })}</span>
        <div className="ml-auto flex flex-wrap gap-2">
          <Button size="sm" disabled={!active || busy} onClick={() => void run(false)}>
            {busy ? t("fgdSim.room.running") : t("fgdSim.room.runNext")}
          </Button>
          <Button size="sm" variant="outline" disabled={!active || busy} onClick={() => void run(true)}>
            {t("fgdSim.room.runAuto")}
          </Button>
          <Button size="sm" variant="ghost" disabled={!busy} onClick={() => void control("PAUSE")}>
            {t("fgdSim.room.pause")}
          </Button>
          {room.status === "FAILED" ? (
            <Button size="sm" variant="outline" onClick={() => void control("RETRY_FAILED")}>
              {t("fgdSim.room.retry")}
            </Button>
          ) : null}
          <Button size="sm" variant="ghost" className="text-destructive" disabled={!active && room.status !== "FAILED"} onClick={() => void control("CANCEL")}>
            {t("fgdSim.room.cancel")}
          </Button>
        </div>
      </div>
      {message ? <Notice tone={message.tone}>{message.text}</Notice> : null}
      <div className="grid gap-4 xl:grid-cols-[18rem_minmax(0,1fr)_20rem]">
        <Card size="sm">
          <CardHeader>
            <CardTitle className="text-sm">{t("fgdSim.room.agenda")}</CardTitle>
          </CardHeader>
          <CardContent>
            <AgendaPanel sessionId={room.sessionId} stages={room.stages} selectedId={room.selected?.id ?? null} />
          </CardContent>
        </Card>
        <Card size="sm">
          <CardHeader>
            <CardTitle className="text-sm">{t("fgdSim.room.transcript")}</CardTitle>
          </CardHeader>
          <CardContent>
            <TranscriptPanel selected={room.selected} />
          </CardContent>
        </Card>
        <Card size="sm">
          <CardHeader>
            <CardTitle className="text-sm">{t("fgdSim.room.seats")}</CardTitle>
          </CardHeader>
          <CardContent>
            <SeatPanel seats={room.seats} selected={room.selected} />
          </CardContent>
        </Card>
      </div>
      <Card size="sm">
        <CardHeader>
          <CardTitle className="text-sm">{t("fgdSim.room.decision")}</CardTitle>
        </CardHeader>
        <CardContent>
          <DecisionPanel selected={room.selected} />
        </CardContent>
      </Card>
    </div>
  );
}
