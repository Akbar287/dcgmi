import { CheckmarkCircle02Icon, TestTube01Icon } from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";

import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

export type DataOrigin = "SIMULATED" | "REAL";

export function isDataOrigin(value: unknown): value is DataOrigin {
  return value === "SIMULATED" || value === "REAL";
}

// The label is the enum itself in every locale so exported screenshots stay
// unambiguous (docs/07 P1, P5).
export function OriginBadge({ origin, className }: { origin: DataOrigin; className?: string }) {
  const simulated = origin === "SIMULATED";
  return (
    <Badge
      variant="outline"
      data-origin={origin}
      className={cn(
        "font-mono tracking-wide",
        simulated
          ? "border-simulated-foreground/30 bg-simulated text-simulated-foreground"
          : "border-success/30 bg-success/10 text-success",
        className,
      )}
    >
      <HugeiconsIcon
        icon={simulated ? TestTube01Icon : CheckmarkCircle02Icon}
        strokeWidth={2}
        aria-hidden="true"
        data-icon="inline-start"
      />
      {origin}
    </Badge>
  );
}
