"use client";

import { Alert02Icon, CheckmarkCircle02Icon, Loading03Icon } from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";

import { cn } from "@/lib/utils";

export type AutosaveState = { kind: "idle" } | { kind: "saving" } | { kind: "saved"; at: string } | { kind: "error" };

export function AutosaveIndicator({ state, labels }: { state: AutosaveState; labels: { saving: string; saved: string; failed: string } }) {
  if (state.kind === "idle") return null;
  const icon = state.kind === "saving" ? Loading03Icon : state.kind === "saved" ? CheckmarkCircle02Icon : Alert02Icon;
  const text = state.kind === "saving" ? labels.saving : state.kind === "saved" ? labels.saved : labels.failed;
  return (
    <p
      role="status"
      aria-live="polite"
      className={cn("flex items-center gap-1.5 text-xs", state.kind === "error" ? "text-destructive" : "text-muted-foreground")}
    >
      <HugeiconsIcon
        icon={icon}
        strokeWidth={2}
        aria-hidden="true"
        className={cn("size-3.5", state.kind === "saving" && "animate-spin motion-reduce:animate-none")}
      />
      {text}
    </p>
  );
}
