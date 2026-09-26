import type { ReactNode } from "react";

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

export function StatCard({
  label,
  value,
  hint,
  status,
}: {
  label: string;
  value: ReactNode;
  hint?: string;
  status?: ReactNode;
}) {
  return (
    <Card size="sm">
      <CardHeader>
        <CardDescription>{label}</CardDescription>
        <CardTitle className="text-3xl tabular-nums">{value}</CardTitle>
      </CardHeader>
      {hint || status ? (
        <CardContent className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
          {status}
          {hint ? <span>{hint}</span> : null}
        </CardContent>
      ) : null}
    </Card>
  );
}
