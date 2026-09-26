import { Alert02Icon, InformationCircleIcon, SquareLock01Icon } from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";
import type { ReactNode } from "react";

import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { cn } from "@/lib/utils";

type NoticeTone = "info" | "warning" | "locked";

const ICON = { info: InformationCircleIcon, warning: Alert02Icon, locked: SquareLock01Icon } as const;
const TONE = {
  info: "border-info/30 bg-info/5 [&>svg]:text-info",
  warning: "border-warning/40 bg-warning/5 [&>svg]:text-warning",
  locked: "border-border bg-muted/40 [&>svg]:text-muted-foreground",
} as const;

export function Notice({
  tone = "info",
  title,
  children,
  className,
}: {
  tone?: NoticeTone;
  title?: string;
  children: ReactNode;
  className?: string;
}) {
  return (
    <Alert className={cn(TONE[tone], className)}>
      <HugeiconsIcon icon={ICON[tone]} strokeWidth={2} aria-hidden="true" />
      {title ? <AlertTitle>{title}</AlertTitle> : null}
      <AlertDescription>{children}</AlertDescription>
    </Alert>
  );
}
