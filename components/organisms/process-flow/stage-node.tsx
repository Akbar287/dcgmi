"use client";

import { CheckmarkCircle02Icon, LockKeyIcon, Target01Icon } from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";

import { cn } from "@/lib/utils";
import { useT } from "@/lib/i18n/client";

import type { StageView } from "./types";

const ICON = { DONE: CheckmarkCircle02Icon, CURRENT: Target01Icon, UPCOMING: LockKeyIcon } as const;

export function StageNode({
  stage,
  index,
  selected,
  isNext,
  onSelect,
}: {
  stage: StageView;
  index: number;
  selected: boolean;
  isNext: boolean;
  onSelect: () => void;
}) {
  const t = useT();
  const statusText = stage.status === "DONE" ? t("process.done") : stage.status === "CURRENT" ? t("process.current") : isNext ? t("process.next") : t("process.upcoming");
  return (
    <button
      type="button"
      onClick={onSelect}
      aria-pressed={selected}
      className={cn(
        "flex w-full min-w-30 flex-col gap-1.5 rounded-xl border p-3 text-left transition-colors outline-none focus-visible:ring-2 focus-visible:ring-ring motion-reduce:transition-none",
        stage.status === "CURRENT" && "border-info/50 bg-info/5",
        stage.status === "DONE" && "border-success/40 bg-success/5",
        stage.status === "UPCOMING" && "bg-muted/30",
        selected && "ring-2 ring-primary/60",
      )}
    >
      <span className="flex items-center justify-between gap-2 text-[11px] text-muted-foreground">
        <span className="font-mono">{index + 1}</span>
        <span className="flex items-center gap-1">
          <HugeiconsIcon
            icon={ICON[stage.status]}
            strokeWidth={2}
            aria-hidden="true"
            className={cn("size-3.5", stage.status === "DONE" && "text-success", stage.status === "CURRENT" && "text-info")}
          />
          {statusText}
        </span>
      </span>
      <span className="text-sm font-medium leading-tight">{stage.title}</span>
      <span className="text-xs text-muted-foreground">{stage.version}</span>
    </button>
  );
}
