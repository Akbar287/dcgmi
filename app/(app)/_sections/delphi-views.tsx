import Link from "next/link";

import { GatePassForm } from "@/components/molecules/gate-pass-form";
import { Notice } from "@/components/molecules/notice";
import { FeedbackView } from "@/components/organisms/delphi/feedback-view";
import { RatingMatrix } from "@/components/organisms/delphi/rating-matrix";
import { LockForm } from "@/components/organisms/delphi/lock-form";
import { RealRoundCreateForm } from "@/components/organisms/delphi/real-round";
import { RoundCreateForm } from "@/components/organisms/delphi/round-create-form";
import { GateEvaluationCard } from "@/components/organisms/gate-evaluation-card";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { isMockAi } from "@/lib/ai/models";
import { can } from "@/lib/auth/roles";
import { db } from "@/lib/db/client";
import { evaluateContentLockFor, lockedLabel } from "@/lib/db/repository/content-lock";
import { evaluateDelphiGateFor } from "@/lib/db/repository/delphi-gate";
import { getDelphiRoundView, getRoundFeedback, planNextRound } from "@/lib/db/repository/delphi-rounds";
import { listPanelsForEditor } from "@/lib/db/repository/panel-admin";

import { createDelphiRoundAction, createRealRoundAction, lockContentAction } from "../delphi/delphi-actions";
import { passGateAction } from "../gate-actions";
import type { SectionContext } from "./types";

export async function RoundCreateView(ctx: SectionContext) {
  return (
    <div className="grid gap-4 xl:grid-cols-2">
      {await SimRoundCreate(ctx)}
      {await RealRoundCreate(ctx)}
    </div>
  );
}

async function RealRoundCreate({ t, user, versionId }: SectionContext) {
  if (!versionId || !can(user.role, "instrument:manage")) return null;
  const prisma = await db();
  const [plan, panels, last, pakar] = await Promise.all([
    planNextRound(versionId, "REAL"),
    listPanelsForEditor(),
    prisma.delphiRound.findFirst({ where: { versionId, dataOrigin: "REAL" }, orderBy: { roundNumber: "desc" }, select: { settings: true } }),
    prisma.user.findMany({ where: { role: "PAKAR", active: true, panelCode: { not: null } }, select: { panelCode: true }, orderBy: { panelCode: "asc" } }),
  ]);
  const prevCodes = ((last?.settings as { seatCodes?: string[] } | null)?.seatCodes ?? []) as string[];
  return (
    <Card>
      <CardHeader>
        <CardTitle>{t("delphiReal.title")}</CardTitle>
        <CardDescription>{t("delphiReal.hint")}</CardDescription>
      </CardHeader>
      <CardContent>
        <RealRoundCreateForm
          panels={panels.filter((p) => p.preset === "DELPHI_8").map((p) => ({ id: p.id, name: p.name }))}
          defaultCodes={prevCodes}
          knownCodes={pakar.map((u) => u.panelCode!)}
          plan={{ roundNumber: plan.roundNumber, items: plan.scopeCodes.length, blocked: plan.blocked }}
          action={createRealRoundAction}
        />
      </CardContent>
    </Card>
  );
}

async function SimRoundCreate({ t, user, versionId }: SectionContext) {
  if (!versionId || !can(user.role, "simulation:run")) return null;
  const [plan, panels] = await Promise.all([planNextRound(versionId), listPanelsForEditor()]);
  return (
    <Card>
      <CardHeader>
        <CardTitle>{t("delphiSim.createTitle")}</CardTitle>
        <CardDescription>{t("delphiSim.createHint")}</CardDescription>
      </CardHeader>
      <CardContent>
        <RoundCreateForm
          panels={panels.filter((p) => p.preset === "DELPHI_8").map((p) => ({ id: p.id, name: p.name, ready: p.validation.ready }))}
          plan={{ roundNumber: plan.roundNumber, items: plan.scopeCodes.length, calls: plan.estimatedCalls, blocked: plan.blocked, warnings: plan.warnings }}
          mockAi={isMockAi()}
          action={createDelphiRoundAction}
        />
      </CardContent>
    </Card>
  );
}

async function latestRound(versionId: string, where: { status?: "COMPLETED" } = {}) {
  const prisma = await db();
  return prisma.delphiRound.findFirst({ where: { versionId, ...where }, orderBy: { roundNumber: "desc" }, select: { id: true, roundNumber: true } });
}

async function roundLinks(versionId: string, current: string, t: SectionContext["t"]) {
  const prisma = await db();
  const rounds = await prisma.delphiRound.findMany({ where: { versionId }, orderBy: { roundNumber: "asc" }, select: { id: true, roundNumber: true } });
  return (
    <div className="flex flex-wrap gap-3 text-sm">
      {rounds.map((r) => (
        <Link key={r.id} href={`/delphi/ronde/${r.id}`} className={r.id === current ? "font-medium underline underline-offset-4" : "underline underline-offset-4 text-muted-foreground"}>
          {t("delphiSim.openRound")} R{r.roundNumber}
        </Link>
      ))}
    </div>
  );
}

export async function MatrixView({ t, versionId }: SectionContext) {
  if (!versionId) return null;
  const latest = await latestRound(versionId);
  if (!latest) return <p className="text-sm text-muted-foreground">{t("delphiSim.matrixNone")}</p>;
  const view = (await getDelphiRoundView(latest.id))!;
  return (
    <Card>
      <CardHeader>
        <CardTitle>
          {t("delphiSim.room.matrix")} · R{latest.roundNumber}
        </CardTitle>
        <CardDescription>{await roundLinks(versionId, latest.id, t)}</CardDescription>
      </CardHeader>
      <CardContent>
        <RatingMatrix
          seats={view.round.config.seats.map((s) => ({ seatIndex: s.seatIndex, label: s.label, isNewMember: s.isNewMember }))}
          items={view.items.map((i) => ({ code: i.code, ratings: i.ratings }))}
        />
      </CardContent>
    </Card>
  );
}

export async function FeedbackSectionView({ t, versionId }: SectionContext) {
  if (!versionId) return null;
  const latest = await latestRound(versionId, { status: "COMPLETED" });
  if (!latest) return <p className="text-sm text-muted-foreground">{t("delphiSim.feedback.none")}</p>;
  const fb = (await getRoundFeedback(latest.id))!;
  return (
    <Card>
      <CardHeader>
        <CardTitle>{t("delphiSim.feedback.title", { round: latest.roundNumber })}</CardTitle>
        <CardDescription>{t("delphiSim.feedback.hint")}</CardDescription>
      </CardHeader>
      <CardContent>
        <FeedbackView seats={Array.from({ length: fb.round.panelSize }, (_, i) => i + 1)} items={fb.items} />
      </CardContent>
    </Card>
  );
}

export async function DelphiGateView(ctx: SectionContext) {
  return (
    <>
      {await G3Card(ctx)}
      {await LockCard(ctx)}
    </>
  );
}

async function LockCard({ t, user, versionId }: SectionContext) {
  if (!versionId) return null;
  const prisma = await db();
  const [version, evaluation, g4, labels] = await Promise.all([
    prisma.artifactVersion.findUniqueOrThrow({ where: { id: versionId }, select: { label: true, status: true, parentId: true, children: { where: { status: "CONTENT_LOCKED" }, select: { label: true } } } }),
    evaluateContentLockFor(versionId),
    prisma.gateRecord.findUnique({ where: { versionId_gate: { versionId, gate: "G4_CONTENT_LOCK" } } }),
    prisma.artifactVersion.findMany({ select: { label: true } }),
  ]);
  if (!version.parentId) return null;
  const canLock = can(user.role, "gate:pass") && evaluation.passed && version.status === "DRAFT";
  return (
    <GateEvaluationCard
      evaluation={evaluation}
      title={t("lock.title")}
      hint={`${t("lock.hint")}${evaluation.excluded.length ? ` · ${t("lock.excluded", { codes: evaluation.excluded.map((e) => e.code).join(", ") })}` : ""}${version.children.length ? ` · ${version.children.map((c) => c.label).join(", ")}` : ""}`}
      recordStatus={version.status === "CONTENT_LOCKED" ? "PASSED" : (g4?.status ?? "PENDING")}
      decidedAt={g4?.decidedAt?.toISOString() ?? null}
      action={canLock ? <LockForm defaultLabel={lockedLabel(version.label, new Set(labels.map((l) => l.label)))} action={lockContentAction} /> : undefined}
    />
  );
}

async function G3Card({ t, user, versionId }: SectionContext) {
  if (!versionId) return null;
  const prisma = await db();
  const [evaluation, gates] = await Promise.all([
    evaluateDelphiGateFor(versionId),
    prisma.gateRecord.findMany({ where: { versionId, gate: { in: ["G2_FGD", "G3_DELPHI"] } } }),
  ]);
  const g2 = gates.find((g) => g.gate === "G2_FGD");
  const g3 = gates.find((g) => g.gate === "G3_DELPHI");
  const g3Status = g3?.status ?? "PENDING";
  const canPass = can(user.role, "gate:pass") && evaluation.passed && g2?.status === "PASSED" && g3Status !== "PASSED";
  return (
    <GateEvaluationCard
      evaluation={evaluation}
      title={t("delphiSim.g3Title")}
      hint={`${t("delphiSim.g3Hint")}${evaluation.sCviAve !== null ? ` · ${t("delphiSim.sCvi", { value: evaluation.sCviAve.toFixed(3) })}` : ""}`}
      recordStatus={g3Status}
      decidedAt={g3?.decidedAt?.toISOString() ?? null}
      action={canPass ? <GatePassForm gate="G3_DELPHI" gateLabel="G3" action={passGateAction} /> : g2?.status !== "PASSED" ? <Notice tone="locked">{t("delphiSim.g2First")}</Notice> : undefined}
    />
  );
}
