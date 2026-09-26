import Link from "next/link";

import { GatePassForm } from "@/components/molecules/gate-pass-form";
import { AssessmentCreateForm } from "@/components/organisms/scoring/assessment-create-form";
import { DomainProfile } from "@/components/organisms/scoring/domain-profile";
import { ProfileManager } from "@/components/organisms/scoring/profile-manager";
import { RecomputePanel } from "@/components/organisms/scoring/recompute-panel";
import { ScoreCalculator } from "@/components/organisms/scoring/score-calculator";
import { GateEvaluationCard } from "@/components/organisms/gate-evaluation-card";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { isMockAi } from "@/lib/ai/models";
import { can } from "@/lib/auth/roles";
import { db } from "@/lib/db/client";
import { getArtifactHierarchy } from "@/lib/db/repository/artifact";
import { evaluateScoringGateFor, getScoringWeights, listInstitutionProfiles, planAssessment } from "@/lib/db/repository/scoring-runs";
import { formatDateTime } from "@/lib/format";
import type { ScoringResult } from "@/lib/method/types";

import { passGateAction } from "../gate-actions";
import { createAssessmentAction, saveProfileAction, uploadRecomputeReportAction } from "../scoring/scoring-actions";
import type { SectionContext } from "./types";

export async function AssessmentHeaderView({ t, user, versionId }: SectionContext) {
  if (!versionId) return null;
  const canRun = can(user.role, "simulation:run");
  const prisma = await db();
  const [profiles, plan, models] = await Promise.all([
    listInstitutionProfiles(),
    planAssessment(versionId),
    prisma.modelProfile.findMany({ where: { provider: { approved: true, enabled: true } }, include: { provider: { select: { label: true } } }, orderBy: { label: "asc" } }),
  ]);
  return (
    <div className="grid gap-4 xl:grid-cols-2">
      <Card>
        <CardHeader>
          <CardTitle>{t("scoringSim.profilesTitle")}</CardTitle>
          <CardDescription>{t("scoringSim.profilesHint")}</CardDescription>
        </CardHeader>
        <CardContent>
          <ProfileManager rows={profiles.map((p) => ({ id: p.id, label: p.label, description: p.description, used: p._count.assessments }))} action={saveProfileAction} canWrite={canRun} />
        </CardContent>
      </Card>
      {canRun ? (
        <Card>
          <CardHeader>
            <CardTitle>{t("scoringSim.createTitle")}</CardTitle>
            <CardDescription>{t("scoringSim.createHint")}</CardDescription>
          </CardHeader>
          <CardContent>
            <AssessmentCreateForm
              profiles={profiles.map((p) => ({ id: p.id, label: p.label }))}
              models={models.map((m) => ({ id: m.id, label: `${m.provider.label} · ${m.label}` }))}
              indicators={plan.indicators}
              blocked={plan.blocked}
              mockAi={isMockAi()}
              action={createAssessmentAction}
            />
          </CardContent>
        </Card>
      ) : null}
    </div>
  );
}

export async function ProfileSectionView({ t, user, versionId }: SectionContext) {
  if (!versionId) return null;
  const prisma = await db();
  const [evaluation, gates, assessments, hierarchy] = await Promise.all([
    evaluateScoringGateFor(versionId),
    prisma.gateRecord.findMany({ where: { versionId, gate: { in: ["G5_AHP", "G6_SCORING"] } } }),
    prisma.assessment.findMany({ where: { versionId, status: "COMPLETED" }, orderBy: { createdAt: "asc" } }),
    getArtifactHierarchy(versionId),
  ]);
  const g5 = gates.find((g) => g.gate === "G5_AHP");
  const g6 = gates.find((g) => g.gate === "G6_SCORING");
  const g6Status = g6?.status ?? "PENDING";
  const canPass = can(user.role, "gate:pass") && evaluation.passed && g5?.status === "PASSED" && g6Status !== "PASSED";
  const last = evaluation.lastCheck;
  return (
    <>
      <GateEvaluationCard
        evaluation={evaluation}
        title={t("scoringSim.g6Title")}
        hint={t("scoringSim.g6Hint")}
        recordStatus={g6Status}
        decidedAt={g6?.decidedAt?.toISOString() ?? null}
        action={canPass ? <GatePassForm gate="G6_SCORING" gateLabel="G6" action={passGateAction} /> : undefined}
      />
      <Card>
        <CardHeader>
          <CardTitle>{t("scoringSim.recomputeTitle")}</CardTitle>
        </CardHeader>
        <CardContent>
          <RecomputePanel
            exportSha={evaluation.exportSha256}
            lastCheck={last ? { ok: last.ok, diffCount: last.diffCount, at: formatDateTime(last.createdAt, t.locale), stale: last.exportSha256 !== evaluation.exportSha256 } : null}
            canUpload={can(user.role, "simulation:run")}
            action={uploadRecomputeReportAction}
          />
        </CardContent>
      </Card>
      {assessments.length === 0 ? <p className="text-sm text-muted-foreground">{t("scoringSim.noProfile")}</p> : null}
      {assessments.map((a) => (
        <Card key={a.id}>
          <CardHeader>
            <CardTitle>
              <Link href={`/scoring/asesmen/${a.id}`} className="underline underline-offset-4">
                {a.institutionLabel}
              </Link>
            </CardTitle>
            <CardDescription>{a.assessorRef}</CardDescription>
          </CardHeader>
          <CardContent>
            <DomainProfile result={a.rollup as unknown as ScoringResult} domains={hierarchy.map((d) => ({ code: d.code, name: d.name }))} />
          </CardContent>
        </Card>
      ))}
    </>
  );
}

export async function CalculatorView({ t, versionId }: SectionContext) {
  if (!versionId) return null;
  const [hierarchy, weights] = await Promise.all([getArtifactHierarchy(versionId), getScoringWeights(versionId)]);
  return (
    <Card>
      <CardHeader>
        <CardTitle>{t("scoringSim.calculatorTitle")}</CardTitle>
        <CardDescription>{t("scoringSim.calculatorHint")}</CardDescription>
      </CardHeader>
      <CardContent>
        <ScoreCalculator
          domains={hierarchy.map((d) => ({ code: d.code, name: d.name, aspects: d.aspects.map((a) => ({ code: a.code, name: a.name, indicators: a.indicators.map((i) => ({ code: i.code, name: i.name })) })) }))}
          weights={weights ? { sessionLabel: weights.sessionId.slice(-6), domain: weights.domain, aspect: weights.aspect } : null}
        />
      </CardContent>
    </Card>
  );
}
