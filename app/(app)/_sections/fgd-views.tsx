import Link from "next/link";

import { StatusBadge } from "@/components/atoms/status-badge";
import { GatePassForm } from "@/components/molecules/gate-pass-form";
import { Notice } from "@/components/molecules/notice";
import { DeriveForm } from "@/components/organisms/apply/derive-form";
import { RevisionTaskRow } from "@/components/organisms/apply/revision-task-row";
import { SpecialResolution } from "@/components/organisms/apply/special-resolution";
import { AdoptionRow } from "@/components/organisms/fgd/adoption-row";
import { SessionCreateForm } from "@/components/organisms/fgd/session-create-form";
import { GateEvaluationCard } from "@/components/organisms/gate-evaluation-card";
import { GatewayModels } from "@/components/organisms/gateway-models";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { GATEWAY_ENV_KEY, GATEWAY_FAMILIES, isMockAi } from "@/lib/ai/models";
import { can } from "@/lib/auth/roles";
import { db } from "@/lib/db/client";
import { getArtifactHierarchy } from "@/lib/db/repository/artifact";
import { evaluateFgdGateFor, listSpecialDiscussions } from "@/lib/db/repository/fgd-gate";
import { listSuggestionsForAdoption } from "@/lib/db/repository/fgd-sessions";
import { listPanelsForEditor } from "@/lib/db/repository/panel-admin";
import { listRevisionTasks, suggestDerivedLabel } from "@/lib/db/repository/version-derive";
import { formatDateTime } from "@/lib/format";
import { AGENDA_CORONG_11 } from "@/lib/fgd/agenda";

import { passGateAction } from "../gate-actions";
import { deriveVersionAction, markRevisionTaskAction, resolveSpecialAction } from "../fgd/apply-actions";
import { createFgdSessionAction, saveAdoptionAction } from "../fgd/fgd-actions";
import { addGatewayModelAction, loadGatewayCatalogAction } from "../panel/panel-actions";
import type { SectionContext } from "./types";

export async function FgdCreateView({ t, versionId }: SectionContext) {
  if (!versionId) return null;
  const prisma = await db();
  const [panels, hierarchy, g1] = await Promise.all([
    listPanelsForEditor(),
    getArtifactHierarchy(versionId),
    prisma.gateRecord.findUnique({ where: { versionId_gate: { versionId, gate: "G1_BASELINE" } } }),
  ]);
  return (
    <Card>
      <CardHeader>
        <CardTitle>{t("fgdSim.createTitle")}</CardTitle>
        <CardDescription>{t("fgdSim.createHint")}</CardDescription>
      </CardHeader>
      <CardContent>
        <SessionCreateForm
          panels={panels.filter((p) => p.preset === "FGD_6").map((p) => ({ id: p.id, name: p.name, ready: p.validation.ready, seats: p.seats.length }))}
          domains={hierarchy}
          gatePassed={g1?.status === "PASSED"}
          mockAi={isMockAi()}
          action={createFgdSessionAction}
        />
      </CardContent>
    </Card>
  );
}

export async function FgdRoomListView({ t, versionId }: SectionContext) {
  if (!versionId) return null;
  const prisma = await db();
  const sessions = await prisma.fgdSession.findMany({
    where: { versionId },
    orderBy: { createdAt: "desc" },
    include: { config: { select: { name: true } }, _count: { select: { stages: true } } },
  });
  if (sessions.length === 0) return <p className="text-sm text-muted-foreground">{t("common.empty")}</p>;
  return (
    <div className="overflow-x-auto rounded-2xl border">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>{t("columns.createdAt")}</TableHead>
            <TableHead>{t("columns.config")}</TableHead>
            <TableHead>{t("columns.mode")}</TableHead>
            <TableHead>{t("columns.status")}</TableHead>
            <TableHead className="text-right">
              <span className="sr-only">{t("columns.action")}</span>
            </TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {sessions.map((s) => (
            <TableRow key={s.id}>
              <TableCell className="whitespace-nowrap">{formatDateTime(s.createdAt, t.locale)}</TableCell>
              <TableCell>{s.config.name}</TableCell>
              <TableCell>{s.mode}</TableCell>
              <TableCell>
                <StatusBadge value={s.status} label={t.maybe(`enums.${s.status}`) ?? s.status} />
              </TableCell>
              <TableCell className="text-right">
                <Link href={`/fgd/ruang/${s.id}`} className="text-sm underline underline-offset-4">
                  {t("fgdSim.openRoom")}
                </Link>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}

export function AgendaPresetView({ t }: SectionContext) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>{t("fgdSim.agendaTitle")}</CardTitle>
      </CardHeader>
      <CardContent>
        <ol className="flex flex-col gap-1.5 text-sm">
          {AGENDA_CORONG_11.map((s, i) => (
            <li key={s.key} className="flex flex-wrap gap-2">
              <span className="w-6 tabular-nums text-muted-foreground">{i + 1}.</span>
              <span className="font-medium">{s.title}</span>
              <span className="text-muted-foreground">— {t(`fgdSim.agendaScope.${s.scope}`)}</span>
            </li>
          ))}
        </ol>
      </CardContent>
    </Card>
  );
}

export async function AdoptionView({ t, versionId }: SectionContext) {
  if (!versionId) return null;
  const rows = await listSuggestionsForAdoption(versionId);
  if (rows.length === 0) return <p className="text-sm text-muted-foreground">{t("fgdSim.adoption.none")}</p>;
  return (
    <div className="overflow-x-auto rounded-2xl border">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>{t("columns.origin")}</TableHead>
            <TableHead>{t("columns.target")}</TableHead>
            <TableHead>{t("columns.action")}</TableHead>
            <TableHead>{t("columns.quote")}</TableHead>
            <TableHead>{t("fgdSim.adoption.adopted")}</TableHead>
            <TableHead>{t("fgdSim.adoption.reason")}</TableHead>
            <TableHead className="text-right">
              <span className="sr-only">{t("fgdSim.adoption.save")}</span>
            </TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {rows.map((r) => (
            <AdoptionRow
              key={r.id}
              action={saveAdoptionAction}
              row={{
                id: r.id,
                target: r.item.targetCode,
                stage: r.item.stage.title,
                seatIndex: r.seatIndex,
                action: r.action,
                quote: r.quote,
                rationale: r.rationale,
                adopted: r.adopted,
                reason: r.notAdoptedReason,
              }}
            />
          ))}
        </TableBody>
      </Table>
    </div>
  );
}

export async function GatewayView({ t }: SectionContext) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>{t("gateway.title")}</CardTitle>
        <CardDescription>{t("gateway.description")}</CardDescription>
      </CardHeader>
      <CardContent>
        <GatewayModels
          keySet={Boolean(process.env[GATEWAY_ENV_KEY])}
          conditionalFamilies={Object.entries(GATEWAY_FAMILIES)
            .filter(([, f]) => f.conditional)
            .map(([k]) => k)}
          addAction={addGatewayModelAction}
          catalogAction={loadGatewayCatalogAction}
        />
      </CardContent>
    </Card>
  );
}


/** SPECIFICATION §4.5 "Terapkan ke A1.1": G2 → special discussions → derive → revision tasks. */
export async function ApplyView({ t, user, versionId }: SectionContext) {
  if (!versionId) return null;
  const prisma = await db();
  const [version, gates, allLabels] = await Promise.all([
    prisma.artifactVersion.findUniqueOrThrow({ where: { id: versionId }, include: { parent: { select: { label: true } }, children: { select: { label: true } } } }),
    prisma.gateRecord.findMany({ where: { versionId, gate: { in: ["G1_BASELINE", "G2_FGD"] } } }),
    prisma.artifactVersion.findMany({ select: { label: true } }),
  ]);
  const canWrite = can(user.role, "artifact:write");
  const g1 = gates.find((g) => g.gate === "G1_BASELINE");
  const g2 = gates.find((g) => g.gate === "G2_FGD");
  const g2Status = g2?.status ?? "PENDING";
  const hasFgd = (await prisma.fgdSession.count({ where: { versionId } })) > 0;
  const sections: React.ReactNode[] = [];

  if (hasFgd || version.parentId) {
    const evaluation = await evaluateFgdGateFor(versionId);
    const canPass = can(user.role, "gate:pass") && evaluation.passed && g1?.status === "PASSED" && g2Status !== "PASSED";
    sections.push(
      <GateEvaluationCard
        key="g2"
        evaluation={evaluation}
        title={t("apply.g2Title")}
        hint={t("apply.g2Hint")}
        recordStatus={g2Status}
        decidedAt={g2?.decidedAt?.toISOString() ?? null}
        action={canPass ? <GatePassForm gate="G2_FGD" gateLabel="G2" action={passGateAction} /> : g1?.status !== "PASSED" ? <Notice tone="locked">{t("apply.g1First")}</Notice> : undefined}
      />,
    );
  }

  if (hasFgd) {
    const specials = await listSpecialDiscussions(versionId);
    sections.push(
      <Card key="special">
        <CardHeader>
          <CardTitle>{t("apply.specialTitle")}</CardTitle>
          <CardDescription>{t("apply.specialHint")}</CardDescription>
        </CardHeader>
        <CardContent>
          {specials.length === 0 ? (
            <p className="text-sm text-muted-foreground">{t("apply.specialNone")}</p>
          ) : (
            <ul className="flex flex-col gap-3">
              {specials.map((s) => (
                <SpecialResolution
                  key={s.id}
                  canWrite={canWrite}
                  action={resolveSpecialAction}
                  row={{
                    id: s.id,
                    stage: s.stage,
                    title: s.title,
                    tallyText: t("fgdSim.room.tally", {
                      TERIMA: s.tally.TERIMA ?? 0,
                      TERIMA_DENGAN_REVISI: s.tally.TERIMA_DENGAN_REVISI ?? 0,
                      TOLAK: s.tally.TOLAK ?? 0,
                      total: (s.tally.TERIMA ?? 0) + (s.tally.TERIMA_DENGAN_REVISI ?? 0) + (s.tally.TOLAK ?? 0),
                    }),
                    note: s.note,
                    resolutionNote: s.resolutionNote,
                    resolvedLabel: s.resolvedAt ? t("apply.resolvedAt", { at: formatDateTime(s.resolvedAt, t.locale) }) : null,
                  }}
                />
              ))}
            </ul>
          )}
        </CardContent>
      </Card>,
      <Card key="derive">
        <CardHeader>
          <CardTitle>{t("apply.deriveTitle")}</CardTitle>
          <CardDescription>{t("apply.deriveHint")}</CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-3">
          {version.children.length > 0 ? <p className="text-sm">{t("apply.children", { labels: version.children.map((c) => c.label).join(", ") })}</p> : null}
          {g2Status !== "PASSED" ? (
            <Notice tone="locked">{t("apply.deriveBlocked")}</Notice>
          ) : canWrite ? (
            <DeriveForm defaultLabel={suggestDerivedLabel(version.label, new Set(allLabels.map((l) => l.label)))} action={deriveVersionAction} />
          ) : null}
        </CardContent>
      </Card>,
    );
  }

  if (version.parentId) {
    const [tasks, indicators] = await Promise.all([
      listRevisionTasks(versionId),
      prisma.indicator.findMany({ where: { aspect: { domain: { versionId } } }, select: { id: true, code: true } }),
    ]);
    const byCode = new Map(indicators.map((i) => [i.code, i.id]));
    const done = tasks.filter((r) => r.appliedAt).length;
    const href = (r: (typeof tasks)[number]) =>
      r.targetType === "INDICATOR" && byCode.has(r.targetCode)
        ? `/artefak/sunting/${byCode.get(r.targetCode)}?task=${r.id}`
        : r.targetType === "DOMAIN"
          ? "/artefak/domain"
          : r.targetType === "ASPECT"
            ? "/artefak/aspek"
            : byCode.has(r.targetCode)
              ? `/artefak/sunting/${byCode.get(r.targetCode)}?task=${r.id}`
              : null;
    sections.push(
      <Card key="tasks">
        <CardHeader>
          <CardTitle>{t("apply.tasksTitle", { parent: version.parent?.label ?? "" })}</CardTitle>
          <CardDescription>
            {t("apply.tasksHint")} {tasks.length > 0 ? t("apply.tasksProgress", { done, total: tasks.length }) : null}
          </CardDescription>
        </CardHeader>
        <CardContent>
          {tasks.length === 0 ? (
            <p className="text-sm text-muted-foreground">{t("apply.tasksNone")}</p>
          ) : (
            <div className="overflow-x-auto rounded-2xl border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>{t("columns.origin")}</TableHead>
                    <TableHead>{t("columns.target")}</TableHead>
                    <TableHead>{t("columns.action")}</TableHead>
                    <TableHead>{t("columns.quote")}</TableHead>
                    <TableHead>{t("columns.status")}</TableHead>
                    <TableHead>
                      <span className="sr-only">{t("apply.edit")}</span>
                    </TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {tasks.map((r) => (
                    <RevisionTaskRow
                      key={r.id}
                      canWrite={canWrite && version.status === "DRAFT"}
                      action={markRevisionTaskAction}
                      row={{
                        id: r.id,
                        targetCode: r.targetCode,
                        stage: r.stage,
                        seatIndex: r.seatIndex,
                        action: r.action,
                        quote: r.quote,
                        rationale: r.rationale,
                        appliedLabel: r.appliedAt ? formatDateTime(r.appliedAt, t.locale) : null,
                        appliedNote: r.appliedNote,
                        editHref: href(r),
                      }}
                    />
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>,
    );
  }

  if (sections.length === 0) return <p className="text-sm text-muted-foreground">{t("apply.notDerived")}</p>;
  return <>{sections}</>;
}
