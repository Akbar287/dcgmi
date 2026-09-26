import { StatusBadge } from "@/components/atoms/status-badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { getTranslator } from "@/lib/i18n/server";
import { GATE_ORDER } from "@/lib/method/gates";

import type { GateState } from "./app-topbar";

export async function GateTimeline({ gates }: { gates: GateState[] }) {
  const t = await getTranslator();
  const statusByGate = new Map(gates.map((g) => [g.gate, g.status]));

  return (
    <Card>
      <CardHeader>
        <CardTitle>{t("dashboard.gateTimeline")}</CardTitle>
        <CardDescription>{t("dashboard.gateTimelineHint")}</CardDescription>
      </CardHeader>
      <CardContent>
        <ol className="grid gap-2 sm:grid-cols-2 lg:grid-cols-7">
          {GATE_ORDER.map((gate, i) => {
            const status = statusByGate.get(gate) ?? "PENDING";
            return (
              <li key={gate} className="flex flex-col gap-2 rounded-xl border p-3">
                <span className="font-mono text-xs text-muted-foreground">{gate}</span>
                <span className="font-medium">
                  {i + 1}. {t(`gates.${gate}`)}
                </span>
                <StatusBadge value={status} label={t.maybe(`enums.${status}`) ?? status} />
              </li>
            );
          })}
        </ol>
      </CardContent>
    </Card>
  );
}
