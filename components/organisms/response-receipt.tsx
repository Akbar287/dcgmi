import { CheckmarkCircle02Icon } from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { formatDateTime } from "@/lib/format";
import { getTranslator } from "@/lib/i18n/server";

export async function ResponseReceipt({
  expertCode,
  submittedAt,
  durationMs,
  message,
}: {
  expertCode: string;
  submittedAt: string;
  durationMs: number | null;
  message: string;
}) {
  const t = await getTranslator();
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <HugeiconsIcon icon={CheckmarkCircle02Icon} strokeWidth={2} aria-hidden="true" className="size-5 text-success" />
          {t("runner.submittedTitle")}
        </CardTitle>
        <CardDescription>
          {expertCode} · {t("runner.submittedAt", { time: formatDateTime(submittedAt, t.locale) })}
          {durationMs !== null ? ` · ${t("runner.duration", { minutes: Math.max(1, Math.round(durationMs / 60_000)) })}` : null}
        </CardDescription>
      </CardHeader>
      <CardContent>
        <p className="text-sm">{message}</p>
      </CardContent>
    </Card>
  );
}
