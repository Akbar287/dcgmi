"use client";

import { Badge } from "@/components/ui/badge";
import { useT } from "@/lib/i18n/client";

import type { RoomSelected } from "./types";

export function TranscriptPanel({ selected }: { selected: RoomSelected | null }) {
  const t = useT();
  if (!selected) return <p className="text-sm text-muted-foreground">{t("fgdSim.room.noItem")}</p>;
  const lines = selected.utterances.filter((u) => u.kind !== "VOTE_REASON" && u.kind !== "NOTE");
  return (
    <div className="flex flex-col gap-3">
      <header>
        <p className="text-xs text-muted-foreground">{selected.stageTitle}</p>
        <h3 className="font-heading text-base font-semibold">{selected.title}</h3>
      </header>
      {selected.error ? <p className="rounded-lg bg-destructive/10 p-2 text-sm text-destructive">{t("fgdSim.room.failed", { error: selected.error })}</p> : null}
      <ol className="flex max-h-[60vh] flex-col gap-3 overflow-y-auto pr-1" aria-label={t("fgdSim.room.transcript")}>
        {lines.map((u) => (
          <li key={u.id} className="rounded-xl border p-3">
            <div className="mb-1 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
              <span className="font-medium text-foreground">{u.speaker}</span>
              <Badge variant="secondary">{t.maybe(`fgdSim.room.kinds.${u.kind}`) ?? u.kind}</Badge>
              {u.modelId ? <span className="font-mono">{u.modelId}</span> : null}
              {u.latencyMs !== null ? <span className="tabular-nums">{u.latencyMs} ms</span> : null}
            </div>
            <p className="text-sm whitespace-pre-line">{u.content}</p>
          </li>
        ))}
      </ol>
    </div>
  );
}
