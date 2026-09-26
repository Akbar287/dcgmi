import { SquareLock01Icon } from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";

import { Badge } from "@/components/ui/badge";

// R1-V1.7 CH-08: C20b and C42 are controlled exceptions; the badge carries the
// explanation as its accessible description.
export function ControlledExceptionBadge({ label, description }: { label: string; description: string }) {
  return (
    <Badge variant="outline" title={description} className="border-warning/40 bg-warning/10 text-warning">
      <HugeiconsIcon icon={SquareLock01Icon} strokeWidth={2} aria-hidden="true" data-icon="inline-start" />
      {label}
      <span className="sr-only">: {description}</span>
    </Badge>
  );
}
