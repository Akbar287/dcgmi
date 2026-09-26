import Link from "next/link";
import { notFound } from "next/navigation";

import { OriginBadge } from "@/components/atoms/origin-badge";
import { StatusBadge } from "@/components/atoms/status-badge";
import { Notice } from "@/components/molecules/notice";
import { AssessmentRunner } from "@/components/organisms/scoring/assessment-runner";
import { DomainProfile } from "@/components/organisms/scoring/domain-profile";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { SectionTemplate } from "@/components/templates/section-template";
import { requirePermission } from "@/lib/auth/session";
import { getAssessmentView } from "@/lib/db/repository/scoring-runs";
import { getTranslator } from "@/lib/i18n/server";
import type { ScoringResult } from "@/lib/method/types";

import { assessmentControlAction, runNextScoreAction } from "../../scoring-actions";

export default async function AssessmentPage({ params }: PageProps<"/scoring/asesmen/[assessmentId]">) {
  await requirePermission("simulation:run");
  const { assessmentId } = await params;
  const t = await getTranslator();
  const view = await getAssessmentView(assessmentId);
  if (!view) notFound();
  const { assessment: a, version, total, domains, scores } = view;
  const rollup = a.rollup as unknown as ScoringResult | null;
  const tokens = scores.reduce((n, s) => [n[0] + (s.tokensIn ?? 0), n[1] + (s.tokensOut ?? 0)], [0, 0]);

  return (
    <SectionTemplate
      eyebrow={t("nav.modules.scoring")}
      title={a.institutionLabel}
      description={t("scoringSim.room.meta", { version: version.label, assessor: a.assessorRef, seed: a.seed })}
      actions={
        <Link href="/scoring/asesmen" className="text-sm underline underline-offset-4">
          {t("nav.sections.scoring.asesmen")}
        </Link>
      }
      notices={
        <>
          <Notice tone="warning">{t("banner.simulatedDetail")}</Notice>
          <Notice>{t("notices.scoringProvisional")}</Notice>
        </>
      }
    >
      <Card>
        <CardContent className="flex flex-col gap-3 pt-6">
          <div className="flex flex-wrap items-center gap-3 text-xs text-muted-foreground">
            <OriginBadge origin={a.dataOrigin} />
            <span className="tabular-nums">{t("delphiSim.room.calls", { calls: scores.length, tin: tokens[0], tout: tokens[1] })}</span>
          </div>
          <AssessmentRunner assessmentId={a.id} status={a.status} done={scores.length} total={total} error={a.error} runAction={runNextScoreAction} controlAction={assessmentControlAction} />
        </CardContent>
      </Card>

      {rollup ? (
        <Card>
          <CardContent className="pt-6">
            <DomainProfile result={rollup} domains={domains} />
          </CardContent>
        </Card>
      ) : null}

      <Card>
        <CardHeader>
          <CardTitle>{t("scoringSim.room.scores")}</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto rounded-2xl border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>{t("columns.indicator")}</TableHead>
                  <TableHead>{t("columns.level")}</TableHead>
                  <TableHead>{t("scoringSim.room.cap")}</TableHead>
                  <TableHead>{t("columns.missingKind")}</TableHead>
                  <TableHead>{t("scoringSim.room.locator")}</TableHead>
                  <TableHead>{t("columns.rationale")}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {scores.map((s) => (
                  <TableRow key={s.id}>
                    <TableCell>
                      <span className="font-mono text-xs">{s.indicator.code}</span>
                      <span className="block max-w-48 truncate text-xs text-muted-foreground">{s.indicator.name}</span>
                    </TableCell>
                    <TableCell className="tabular-nums">{s.level ?? "—"}</TableCell>
                    <TableCell className="tabular-nums text-muted-foreground">{s.levelCap ?? "—"}</TableCell>
                    <TableCell>{s.missingKind === "NONE" ? "—" : <StatusBadge value={s.missingKind} label={t.maybe(`enums.${s.missingKind}`) ?? s.missingKind} />}</TableCell>
                    <TableCell className="max-w-64 text-xs">{s.evidenceLocator ? `“${s.evidenceLocator}”` : "—"}</TableCell>
                    <TableCell className="max-w-72 text-xs text-muted-foreground">{s.rationale}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      {a.profile ? (
        <Card>
          <CardHeader>
            <CardTitle>{t("scoringSim.room.profileText")}</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="whitespace-pre-line text-sm text-muted-foreground">{a.profile.description}</p>
          </CardContent>
        </Card>
      ) : null}
    </SectionTemplate>
  );
}
