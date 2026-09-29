"use client";

import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";

import { useT } from "@/lib/i18n/client";
import { cn } from "@/lib/utils";

interface LiveCall {
  id: string;
  createdAt: string;
  promptId: string;
  modelId: string;
  tokensIn: number | null;
  tokensOut: number | null;
  latencyMs: number | null;
  costUsd: number | null;
  ok: boolean;
  error: string | null;
}

/**
 * Live call feed over SSE (/api/events): each model call appears as the ledger
 * records it; a status change refreshes the server-rendered page (throttled),
 * so a second viewer follows a run without pressing anything.
 */
export function LiveFeed({ refKey }: { refKey: string }) {
  const t = useT();
  const router = useRouter();
  const [calls, setCalls] = useState<LiveCall[]>([]);
  const [state, setState] = useState<"connecting" | "live" | "ended" | "retrying">("connecting");
  const [status, setStatus] = useState<{ status: string; progress: string } | null>(null);
  const lastRefresh = useRef(0);

  useEffect(() => {
    const es = new EventSource(`/api/events?ref=${encodeURIComponent(refKey)}`);
    const refresh = () => {
      const now = Date.now();
      if (now - lastRefresh.current > 2000) {
        lastRefresh.current = now;
        router.refresh();
      }
    };
    es.onopen = () => setState("live");
    es.onerror = () => setState((s) => (s === "ended" ? s : "retrying"));
    es.addEventListener("status", (e) => {
      setStatus(JSON.parse((e as MessageEvent).data));
      refresh();
    });
    es.addEventListener("call", (e) => setCalls((c) => [JSON.parse((e as MessageEvent).data) as LiveCall, ...c].slice(0, 25)));
    es.addEventListener("end", () => {
      setState("ended");
      es.close();
      refresh();
    });
    es.addEventListener("gone", () => {
      setState("ended");
      es.close();
    });
    return () => es.close();
  }, [refKey, router]);

  return (
    <div className="flex flex-col gap-2 rounded-xl border p-3" aria-live="polite">
      <div className="flex flex-wrap items-center gap-2 text-xs">
        <span className={cn("size-2 rounded-full", state === "live" ? "bg-success" : state === "ended" ? "bg-muted-foreground" : "bg-warning")} aria-hidden="true" />
        <span className="font-medium">{t(`live.states.${state}`)}</span>
        {status ? (
          <span className="tabular-nums text-muted-foreground">
            {status.status} · {status.progress}
          </span>
        ) : null}
      </div>
      {calls.length === 0 ? (
        <p className="text-xs text-muted-foreground">{t("live.none")}</p>
      ) : (
        <ol className="flex max-h-48 flex-col gap-0.5 overflow-y-auto font-mono text-[11px]">
          {calls.map((c) => (
            <li key={c.id} className={cn("flex flex-wrap justify-between gap-2", !c.ok && "text-destructive")}>
              <span className="truncate">
                {new Date(c.createdAt).toLocaleTimeString(t.locale)} · {c.promptId} · {c.modelId}
              </span>
              <span className="tabular-nums text-muted-foreground">
                {c.tokensIn ?? "?"}/{c.tokensOut ?? "?"} · {c.latencyMs ?? "?"} ms · {c.costUsd === null ? "$?" : `$${c.costUsd.toFixed(5)}`}
              </span>
            </li>
          ))}
        </ol>
      )}
    </div>
  );
}
