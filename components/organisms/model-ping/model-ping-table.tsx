"use client";

import { useState } from "react";

import { StatusBadge } from "@/components/atoms/status-badge";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import type { ActionResult } from "@/lib/action-result";
import type { PingResult } from "@/lib/ai/ping";
import { useT } from "@/lib/i18n/client";

export function ModelPingTable({
  models,
  action,
}: {
  models: { id: string; label: string; modelId: string; envKeyName: string; approved: boolean; enabled: boolean }[];
  action: (modelProfileId: string) => Promise<ActionResult<PingResult>>;
}) {
  const t = useT();
  const [results, setResults] = useState<Record<string, PingResult | { ok: false; mode: "LIVE"; error: string }>>({});
  const [busy, setBusy] = useState<string | null>(null);

  const run = async (id: string) => {
    setBusy(id);
    const r = await action(id);
    setResults((prev) => ({ ...prev, [id]: r.ok ? r.data : { ok: false, mode: "LIVE", error: r.error.message } }));
    setBusy(null);
  };

  const describe = (r: PingResult) =>
    !r.ok
      ? t("panelAdmin.ping.failed", { error: r.error })
      : r.mode === "MOCK"
        ? `${t("panelAdmin.ping.mockOk")} · ${r.checks.join(" · ")}`
        : t("panelAdmin.ping.liveOk", { ms: r.latencyMs, tin: r.inputTokens ?? "?", tout: r.outputTokens ?? "?" });

  return (
    <div className="overflow-x-auto rounded-2xl border">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>{t("columns.model")}</TableHead>
            <TableHead>{t("columns.modelId")}</TableHead>
            <TableHead>{t("columns.envKey")}</TableHead>
            <TableHead>{t("columns.approved")}</TableHead>
            <TableHead>{t("columns.status")}</TableHead>
            <TableHead className="text-right">
              <span className="sr-only">{t("columns.action")}</span>
            </TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {models.map((m) => {
            const r = results[m.id];
            return (
              <TableRow key={m.id}>
                <TableCell>{m.label}</TableCell>
                <TableCell className="font-mono text-xs">{m.modelId}</TableCell>
                <TableCell className="font-mono text-xs">{m.envKeyName}</TableCell>
                <TableCell>{m.approved && m.enabled ? t("common.yes") : t("common.no")}</TableCell>
                <TableCell aria-live="polite" className="max-w-md text-sm">
                  {r ? <StatusBadge value={r.ok ? "PASSED" : "FAILED"} label={describe(r)} className="h-auto whitespace-normal text-left" /> : "—"}
                </TableCell>
                <TableCell className="text-right">
                  <Button size="sm" variant="outline" disabled={busy !== null} onClick={() => void run(m.id)}>
                    {busy === m.id ? t("panelAdmin.ping.testing") : t("panelAdmin.ping.test")}
                  </Button>
                </TableCell>
              </TableRow>
            );
          })}
        </TableBody>
      </Table>
    </div>
  );
}
