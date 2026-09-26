import { Shield01Icon, TestTube01Icon, UserIcon } from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";

import { Badge } from "@/components/ui/badge";

const ICON = { ADMIN: Shield01Icon, TESTER: TestTube01Icon, PAKAR: UserIcon } as const;

export function RoleBadge({ role, label }: { role: keyof typeof ICON; label: string }) {
  return (
    <Badge variant="outline" data-role={role}>
      <HugeiconsIcon icon={ICON[role]} strokeWidth={2} aria-hidden="true" data-icon="inline-start" />
      {label}
    </Badge>
  );
}
