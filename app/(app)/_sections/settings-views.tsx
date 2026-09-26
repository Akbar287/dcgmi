import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { AHP_SEAT_PAIRWISE, AHP_SEAT_REVIEW } from "@/lib/ai/prompts/ahp";
import { DELPHI_SEAT_RATE } from "@/lib/ai/prompts/delphi";
import { FGD_FACILITATOR_PRESENT, FGD_NOTETAKER_EXTRACT, FGD_SEAT_ARGUE, FGD_SEAT_CROSSTALK, FGD_SEAT_VOTE } from "@/lib/ai/prompts/fgd";
import { SCORING_ASSESSOR_EVIDENCE } from "@/lib/ai/prompts/scoring";
import { GATEWAY_ENV_KEY, isMockAi } from "@/lib/ai/models";
import { db } from "@/lib/db/client";
import { formatDateTime } from "@/lib/format";

import type { SectionContext } from "./types";

const PROMPTS = [FGD_FACILITATOR_PRESENT, FGD_SEAT_ARGUE, FGD_SEAT_CROSSTALK, FGD_SEAT_VOTE, FGD_NOTETAKER_EXTRACT, DELPHI_SEAT_RATE, AHP_SEAT_PAIRWISE, AHP_SEAT_REVIEW, SCORING_ASSESSOR_EVIDENCE];

export async function GeneralSettingsView({ t }: SectionContext) {
  const rows: [string, React.ReactNode][] = [
    [t("settingsInfo.mockAi"), isMockAi() ? <Badge key="m">MOCK_AI=1</Badge> : <Badge key="m" variant="destructive">{t("settingsInfo.live")}</Badge>],
    [t("settingsInfo.gateway"), process.env[GATEWAY_ENV_KEY] ? t("enums.CONFIGURED") : t("enums.NOT_CONFIGURED")],
    [t("settingsInfo.concurrency"), process.env.AI_MAX_CONCURRENCY ?? "4"],
    [t("settingsInfo.environment"), process.env.NODE_ENV ?? "—"],
  ];
  return (
    <>
      <Card>
        <CardHeader>
          <CardTitle>{t("settingsInfo.runtime")}</CardTitle>
          <CardDescription>{t("settingsInfo.runtimeHint")}</CardDescription>
        </CardHeader>
        <CardContent>
          <dl className="grid gap-2 text-sm sm:grid-cols-2">
            {rows.map(([k, v]) => (
              <div key={k} className="flex justify-between gap-3 rounded-lg bg-muted/40 px-3 py-2">
                <dt className="text-muted-foreground">{k}</dt>
                <dd>{v}</dd>
              </div>
            ))}
          </dl>
        </CardContent>
      </Card>
      <Card>
        <CardHeader>
          <CardTitle>{t("settingsInfo.prompts")}</CardTitle>
          <CardDescription>{t("settingsInfo.promptsHint")}</CardDescription>
        </CardHeader>
        <CardContent>
          <ul className="grid gap-1 text-sm sm:grid-cols-2">
            {PROMPTS.map((p) => (
              <li key={p.id} className="flex justify-between gap-3 font-mono text-xs">
                <span>{p.id}</span>
                <span className="text-muted-foreground">v{p.version}</span>
              </li>
            ))}
          </ul>
        </CardContent>
      </Card>
    </>
  );
}

export async function RetentionView({ t }: SectionContext) {
  const prisma = await db();
  const counts = await Promise.all([
    prisma.fgdSession.groupBy({ by: ["dataOrigin"], _count: true }).then((r) => ["FgdSession", r] as const),
    prisma.delphiRating.groupBy({ by: ["dataOrigin"], _count: true }).then((r) => ["DelphiRating", r] as const),
    prisma.ahpSession.groupBy({ by: ["dataOrigin"], _count: true }).then((r) => ["AhpSession", r] as const),
    prisma.assessment.groupBy({ by: ["dataOrigin"], _count: true }).then((r) => ["Assessment", r] as const),
    prisma.modelCall.groupBy({ by: ["dataOrigin"], _count: true }).then((r) => ["ModelCall", r] as const),
  ]);
  const [audit, oldest] = await Promise.all([prisma.auditEvent.count(), prisma.auditEvent.findFirst({ orderBy: { createdAt: "asc" }, select: { createdAt: true } })]);
  return (
    <Card>
      <CardHeader>
        <CardTitle>{t("settingsInfo.retentionTitle")}</CardTitle>
        <CardDescription>{t("settingsInfo.retentionPolicy")}</CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-3">
        <div className="overflow-x-auto rounded-2xl border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>{t("settingsInfo.model")}</TableHead>
                <TableHead className="text-right">SIMULATED</TableHead>
                <TableHead className="text-right">REAL</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {counts.map(([name, rows]) => (
                <TableRow key={name}>
                  <TableCell className="font-mono text-xs">{name}</TableCell>
                  <TableCell className="text-right tabular-nums">{rows.find((r) => r.dataOrigin === "SIMULATED")?._count ?? 0}</TableCell>
                  <TableCell className="text-right tabular-nums">{rows.find((r) => r.dataOrigin === "REAL")?._count ?? 0}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
        <p className="text-xs text-muted-foreground">{t("settingsInfo.auditCount", { n: audit, since: oldest ? formatDateTime(oldest.createdAt, t.locale) : "—" })}</p>
      </CardContent>
    </Card>
  );
}

export async function DatabaseView({ t }: SectionContext) {
  const prisma = await db();
  const migrations = await prisma.$queryRaw<{ migration_name: string; finished_at: Date | null }[]>`SELECT migration_name, finished_at FROM "_prisma_migrations" ORDER BY started_at`;
  const [versions, indicators, users] = await Promise.all([prisma.artifactVersion.count(), prisma.indicator.count(), prisma.user.count()]);
  return (
    <>
      <Card>
        <CardHeader>
          <CardTitle>{t("settingsInfo.dbTitle")}</CardTitle>
          <CardDescription>{t("settingsInfo.dbHint")}</CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-3 text-sm">
          <p className="tabular-nums">{t("settingsInfo.dbCounts", { versions, indicators, users })}</p>
          <pre className="overflow-x-auto rounded-lg bg-muted/40 p-3 text-xs">{`pnpm db:seed        # baseline A1.0 (8–15–43) — idempoten\npnpm exec prisma migrate deploy\npnpm db:studio`}</pre>
        </CardContent>
      </Card>
      <Card>
        <CardHeader>
          <CardTitle>{t("settingsInfo.migrations", { n: migrations.length })}</CardTitle>
        </CardHeader>
        <CardContent>
          <ul className="flex flex-col gap-1 font-mono text-xs">
            {migrations.map((m) => (
              <li key={m.migration_name} className="flex justify-between gap-3">
                <span>{m.migration_name}</span>
                <span className="text-muted-foreground">{m.finished_at ? formatDateTime(m.finished_at, t.locale) : t("settingsInfo.pending")}</span>
              </li>
            ))}
          </ul>
        </CardContent>
      </Card>
    </>
  );
}
