import { TestTube01Icon } from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";
import type { ReactNode } from "react";

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

export function AuthTemplate({
  appName,
  tagline,
  title,
  description,
  children,
}: {
  appName: string;
  tagline: string;
  title: string;
  description: string;
  children: ReactNode;
}) {
  return (
    <main className="flex min-h-svh flex-1 items-center justify-center bg-muted/40 p-4">
      <div className="flex w-full max-w-sm flex-col gap-6">
        <div className="flex items-center gap-3">
          <span className="flex size-10 items-center justify-center rounded-xl bg-simulated text-simulated-foreground">
            <HugeiconsIcon icon={TestTube01Icon} strokeWidth={2} aria-hidden="true" />
          </span>
          <div className="flex flex-col leading-tight">
            <span className="font-semibold">{appName}</span>
            <span className="text-xs text-muted-foreground">{tagline}</span>
          </div>
        </div>
        <Card>
          <CardHeader>
            <CardTitle className="text-xl">{title}</CardTitle>
            <CardDescription>{description}</CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col gap-4">{children}</CardContent>
        </Card>
      </div>
    </main>
  );
}
