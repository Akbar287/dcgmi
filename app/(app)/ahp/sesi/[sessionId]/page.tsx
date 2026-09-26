import Link from "next/link";
import { notFound } from "next/navigation";

import { OriginBadge } from "@/components/atoms/origin-badge";
import { StatusBadge } from "@/components/atoms/status-badge";
import { Notice } from "@/components/molecules/notice";
import { AhpSessionRunner } from "@/components/organisms/ahp/session-runner";
import { WeightTable } from "@/components/organisms/ahp/weight-table";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { SectionTemplate } from "@/components/templates/section-template";
import { requirePermission } from "@/lib/auth/session";
import { getAhpSessionView, groupKey } from "@/lib/db/repository/ahp-sessions";
import { formatNumber } from "@/lib/format";
import { getTranslator } from "@/lib/i18n/server";
import { aggregateGeometric } from "@/lib/method/ahp";
import type { Matrix } from "@/lib/method/types";

import { ahpSessionControlAction, runNextAhpMatrixAction } from "../../ahp-actions";

export default async function AhpSessionPage({ params }: PageProps<"/ahp/sesi/[sessionId]">) {
  await requirePermission("simulation:run");
  const { sessionId } = await params;
  const t = await getTranslator();
  const view = await getAhpSessionView(sessionId);
  if (!view) notFound();
  const { session, groups, latest } = view;
  const done = latest.filter((m) => m.status !== "PENDING").length;
  const tokens = session.matrices.reduce((n, m) => [n[0] + (m.tokensIn ?? 0), n[1] + (m.tokensOut ?? 0)], [0, 0]);

  return (
    <SectionTemplate
      eyebrow={t("nav.modules.ahp")}
      title={`AHP · ${session.version.label}`}
      description={t("ahpSim.room.meta", { version: session.version.label, seed: session.seed, panel: session.config.name, aggregation: session.aggregation })}
      actions={
        <Link href="/ahp/konfigurasi" className="text-sm underline underline-offset-4">
          {t("nav.sections.ahp.konfigurasi")}
        </Link>
      }
      notices={
        <>
          <Notice tone="warning">{t("banner.simulatedDetail")}</Notice>
          <Notice tone="warning">{t("notices.ahpReturned", { crMax: 0.1 })}</Notice>
        </>
      }
    >
      <Card>
        <CardContent className="flex flex-col gap-3 pt-6">
          <div className="flex flex-wrap items-center gap-3 text-xs text-muted-foreground">
            <OriginBadge origin={session.dataOrigin} />
            <span className="tabular-nums">
              {t("delphiSim.room.calls", { calls: session.matrices.reduce((n, m) => n + ((m.pairs as unknown[] | null)?.length ?? 0), 0), tin: tokens[0], tout: tokens[1] })}
            </span>
          </div>
          <AhpSessionRunner
            sessionId={session.id}
            status={session.status}
            done={done}
            total={latest.length}
            error={session.error}
            runAction={runNextAhpMatrixAction}
            controlAction={ahpSessionControlAction}
          />
        </CardContent>
      </Card>

      {groups.map((g) => {
        const rows = latest.filter((m) => groupKey(m.level, m.parentCode) === g.key);
        const accepted = rows.filter((m) => m.status === "ACCEPTED" && m.cells);
        const agg = session.status === "COMPLETED" && accepted.length ? aggregateGeometric(accepted.map((m) => ({ seatIndex: m.seatIndex, matrix: m.cells as unknown as Matrix }))) : null;
        const weights = session.weights.filter((w) => groupKey(w.level, w.parentCode) === g.key);
        return (
          <Card key={g.key}>
            <CardHeader>
              <CardTitle>
                {g.label} <span className="font-mono text-xs text-muted-foreground">{g.key}</span>
              </CardTitle>
              <CardDescription>
                {t("ahpSim.room.weightsHint")}
                {agg ? ` · ${t("ahpSim.room.seatsIncluded", { seats: agg.includedSeats.join(", ") })} · ${t("ahpSim.room.crAgg", { cr: agg.cr.toFixed(4) })}` : ""}
              </CardDescription>
            </CardHeader>
            <CardContent className="flex flex-col gap-4">
              {session.status === "COMPLETED" ? (
                weights.some((w) => w.seatIndex === null) ? (
                  <WeightTable
                    rows={g.elements.map((e) => ({
                      code: e.code,
                      name: e.name,
                      aggregate: weights.find((w) => w.seatIndex === null && w.targetCode === e.code)?.weight ?? null,
                      individual: weights.filter((w) => w.seatIndex !== null && w.targetCode === e.code && rows.some((r) => r.seatIndex === w.seatIndex && r.status === "ACCEPTED")).map((w) => w.weight),
                    }))}
                  />
                ) : (
                  <Notice tone="warning">{t("ahpSim.room.noAggregate")}</Notice>
                )
              ) : null}
              <div className="overflow-x-auto rounded-2xl border">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>{t("columns.seat")}</TableHead>
                      <TableHead>{t("ahpSim.room.attempt")}</TableHead>
                      <TableHead>{t("columns.lambdaMax")}</TableHead>
                      <TableHead>{t("columns.cr")}</TableHead>
                      <TableHead>{t("columns.status")}</TableHead>
                      <TableHead>{t("ahpSim.room.returnedPairs")}</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {session.matrices
                      .filter((m) => groupKey(m.level, m.parentCode) === g.key)
                      .map((m) => (
                        <TableRow key={m.id}>
                          <TableCell>#{m.seatIndex}</TableCell>
                          <TableCell className="tabular-nums">{m.attempt}</TableCell>
                          <TableCell className="tabular-nums">{m.lambdaMax === null ? "—" : formatNumber(m.lambdaMax, t.locale, 4)}</TableCell>
                          <TableCell className="tabular-nums">{m.cr === null ? "—" : formatNumber(m.cr, t.locale, 4)}</TableCell>
                          <TableCell>
                            <StatusBadge value={m.status} label={t.maybe(`ahpSim.status.${m.status}`) ?? m.status} />
                          </TableCell>
                          <TableCell className="text-xs">
                            {((m.returnedPairs as { i: number; j: number; ratio: number }[] | null) ?? []).map((p) => (
                              <Badge key={`${p.i}-${p.j}`} variant="secondary" className="mr-1 font-mono">
                                {m.elements[p.i]}–{m.elements[p.j]}
                              </Badge>
                            ))}
                          </TableCell>
                        </TableRow>
                      ))}
                  </TableBody>
                </Table>
              </div>
            </CardContent>
          </Card>
        );
      })}

      {session.sensitivity.length ? (
        <Card>
          <CardHeader>
            <CardTitle>{t("ahpSim.room.sensitivity")}</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto rounded-2xl border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>{t("columns.name")}</TableHead>
                    <TableHead>{t("ahpSim.room.rankBefore")}</TableHead>
                    <TableHead>{t("ahpSim.room.rankAfter")}</TableHead>
                    <TableHead>{t("ahpSim.room.rankChanged")}</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {session.sensitivity.map((s) => {
                    const r = s.result as { rankBefore: string[]; rankAfter: string[] };
                    return (
                      <TableRow key={s.id}>
                        <TableCell className="font-mono text-xs">{s.name}</TableCell>
                        <TableCell className="font-mono text-xs">{r.rankBefore.join(" > ")}</TableCell>
                        <TableCell className="font-mono text-xs">{r.rankAfter.join(" > ")}</TableCell>
                        <TableCell>{s.rankChanged ? <Badge variant="destructive">{t("common.yes")}</Badge> : t("common.no")}</TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>
      ) : null}
    </SectionTemplate>
  );
}
