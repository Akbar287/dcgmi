"use client";

import { useCallback, useEffect, useRef, useState } from "react";

import type { AutosaveState } from "@/components/molecules/autosave-indicator";
import type { Answers } from "@/lib/instruments/pre-review/types";

const DEBOUNCE_MS = 1_200;

/**
 * Saves the draft shortly after the respondent stops typing and on demand
 * (page changes). Only the latest snapshot is ever sent; a failed save keeps
 * the answers in memory and warns before leaving the page.
 */
export function useAutosave(
  save: (answers: Answers, pageIndex: number) => Promise<{ ok: boolean; savedAt?: string }>,
  enabled: boolean,
) {
  const [state, setState] = useState<AutosaveState>({ kind: "idle" });
  const pending = useRef<{ answers: Answers; pageIndex: number } | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const inFlight = useRef<Promise<void> | null>(null);

  const flush = useCallback(async () => {
    if (timer.current) clearTimeout(timer.current);
    timer.current = null;
    if (inFlight.current) await inFlight.current;
    const next = pending.current;
    if (!next || !enabled) return;
    pending.current = null;
    setState({ kind: "saving" });
    inFlight.current = save(next.answers, next.pageIndex)
      .then((r) => {
        if (r.ok && r.savedAt) setState({ kind: "saved", at: r.savedAt });
        else {
          pending.current ??= next;
          setState({ kind: "error" });
        }
      })
      .catch(() => {
        pending.current ??= next;
        setState({ kind: "error" });
      })
      .finally(() => {
        inFlight.current = null;
      });
    await inFlight.current;
  }, [enabled, save]);

  const schedule = useCallback(
    (answers: Answers, pageIndex: number) => {
      if (!enabled) return;
      pending.current = { answers, pageIndex };
      if (timer.current) clearTimeout(timer.current);
      timer.current = setTimeout(() => void flush(), DEBOUNCE_MS);
    },
    [enabled, flush],
  );

  useEffect(() => {
    const warn = (event: BeforeUnloadEvent) => {
      if (pending.current || inFlight.current) event.preventDefault();
    };
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, []);

  return { state, schedule, flush, cancel: () => (pending.current = null) };
}
