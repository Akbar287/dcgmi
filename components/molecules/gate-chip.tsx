import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { TONE_CLASS, toneFor } from "@/components/atoms/status-badge";
import { cn } from "@/lib/utils";

// Compact gate marker for the topbar: number + short state text, never color only.
export function GateChip({
  index,
  label,
  status,
  statusLabel,
  versionLabel,
}: {
  index: number;
  label: string;
  status: string;
  statusLabel: string;
  /** Version on the process line where this gate stands. */
  versionLabel?: string;
}) {
  const where = versionLabel ? ` · ${versionLabel}` : "";
  return (
    <Tooltip>
      <TooltipTrigger
        render={
          <span
            tabIndex={0}
            className={cn(
              "inline-flex h-6 shrink-0 items-center gap-1 rounded-full whitespace-nowrap border px-2 text-[11px] font-medium tabular-nums outline-none focus-visible:ring-2 focus-visible:ring-ring",
              TONE_CLASS[toneFor(status)],
            )}
          />
        }
      >
        G{index}
        <span className="sr-only">
          {label}: {statusLabel}
          {where}
        </span>
        <span aria-hidden="true" className="hidden xl:inline">
          · {statusLabel}
        </span>
      </TooltipTrigger>
      <TooltipContent>
        {label} — {statusLabel}
        {where}
      </TooltipContent>
    </Tooltip>
  );
}
