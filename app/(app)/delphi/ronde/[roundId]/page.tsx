import Link from "next/link";
import { notFound } from "next/navigation";

import { OriginBadge } from "@/components/atoms/origin-badge";
import { ActionForm } from "@/components/molecules/action-form";
import { Notice } from "@/components/molecules/notice";
import { ItemReviewRow } from "@/components/organisms/delphi/item-review-row";
import { RatingMatrix } from "@/components/organisms/delphi/rating-matrix";
import { RealRoundPanel } from "@/components/organisms/delphi/real-round";
import { RoundRunner } from "@/components/organisms/delphi/round-runner";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { SectionTemplate } from "@/components/templates/section-template";
import { LiveFeed } from "@/components/organisms/live-feed";
import { can } from "@/lib/auth/roles";
import { requirePermission } from "@/lib/auth/session";
import { realRoundStatus } from "@/lib/db/repository/delphi-real";
import { getDelphiRoundView } from "@/lib/db/repository/delphi-rounds";
import { formatDateTime } from "@/lib/format";
import { getTranslator } from "@/lib/i18n/server";

import { computeRealRoundAction, delphiRoundControlAction, finalizeDelphiRoundAction, reviewDelphiItemAction, runNextDelphiItemAction } from "../../delphi-actions";

export default async function DelphiRoundPage({ params }: PageProps<"/delphi/ronde/[roundId]">) {
  const user = await requirePermission("console:read");
  const { roundId } = await params;
  const t = await getTranslator();
  const view = await getDelphiRoundView(roundId);
  if (!view) notFound();
  const { round, items } = view;
  const finalized = round.finalizedAt !== null;
  const canReview = can(user.role, "artifact:write") && round.status === "COMPLETED" && !finalized;
  const done = items.filter((i) => i.result).length;
  const real = round.dataOrigin === "REAL" ? await realRoundStatus(round.id) : null;
  const tokensIn = round.ratings.reduce((n, r) => n + (r.tokensIn ?? 0), 0);
  const tokensOut = round.ratings.reduce((n, r) => n + (r.tokensOut ?? 0), 0);

  return (
    <SectionTemplate
      eyebrow={t("nav.modules.delphi")}
      title={`Delphi R${round.roundNumber}`}
      description={t("delphiSim.room.meta", { version: round.version.label, round: round.roundNumber, seed: round.seed, panel: round.config.name })}
      actions={
        <Link href="/delphi/ronde" className="text-sm underline underline-offset-4">
          {t("nav.sections.delphi.ronde")}
        </Link>
      }
      notices={
        <>
          {round.dataOrigin === "REAL" ? <Notice>{t("preReview.realNotice")}</Notice> : <Notice tone="warning">{t("banner.simulatedDetail")}</Notice>}
          <Notice>{t("notices.delphiDenominator")}</Notice>
        </>
      }
    >
      <Card>
        <CardContent className="flex flex-col gap-3 pt-6">
          <div className="flex flex-wrap items-center gap-3 text-xs text-muted-foreground">
            <OriginBadge origin={round.dataOrigin} />
            <span className="tabular-nums">{t("delphiSim.room.calls", { calls: round.ratings.length, tin: tokensIn, tout: tokensOut })}</span>
            {round.scaleSCviAve !== null ? <span className="tabular-nums">{t("delphiSim.sCvi", { value: round.scaleSCviAve.toFixed(3) })}</span> : null}
            {finalized ? <span>{t("delphiSim.room.finalized", { at: formatDateTime(round.finalizedAt!, t.locale) })}</span> : null}
          </div>
          {round.dataOrigin === "REAL" && real ? (
            <RealRoundPanel roundId={round.id} form={real.form} seats={real.seats} canCompute={can(user.role, "artifact:write")} finalized={finalized} action={computeRealRoundAction} />
          ) : null}
          {round.dataOrigin === "REAL" ? null : <RoundRunner
            roundId={round.id}
            status={round.status}
            finalized={finalized}
            done={done}
            total={items.length}
            error={round.error}
            runAction={runNextDelphiItemAction}
            controlAction={delphiRoundControlAction}
          />}
          {round.dataOrigin === "REAL" && round.status === "FAILED" && round.error ? <Notice tone="warning">{t("delphiSim.room.deviation", { error: round.error })}</Notice> : null}
        </CardContent>
      </Card>

      <LiveFeed refKey={`DelphiRound:${round.id}`} />
      <Card>
        <CardHeader>
          <CardTitle>{t("delphiSim.room.results")}</CardTitle>
          <CardDescription>{t("notices.delphiDenominator")}</CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-4">
          <div className="overflow-x-auto rounded-2xl border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>{t("columns.indicator")}</TableHead>
                  <TableHead>{t("columns.iCvi")}</TableHead>
                  <TableHead>{t("columns.median")}</TableHead>
                  <TableHead>{t("columns.iqr")}</TableHead>
                  <TableHead>{t("columns.decision")}</TableHead>
                  <TableHead>{t("columns.clarityFlags")}</TableHead>
                  <TableHead>{t("delphiSim.review.note")}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {items
                  .filter((i) => i.result)
                  .map((i) => (
                    <ItemReviewRow
                      key={i.code}
                      canReview={canReview}
                      action={reviewDelphiItemAction}
                      row={{
                        resultId: i.result!.id,
                        code: i.code,
                        name: i.name,
                        iCvi: i.result!.iCvi,
                        validRaters: i.result!.validRaters,
                        median: i.result!.median,
                        iqr: i.result!.iqr,
                        decision: i.result!.decision,
                        reason: i.result!.reason,
                        clarityFlags: i.result!.clarityFlags,
                        clarityNotes: i.ratings.filter((r) => r.clarityFlag && r.clarityNote).map((r) => r.clarityNote!),
                        clarityCritical: i.result!.clarityCritical,
                        constructConflict: i.result!.constructConflict,
                        researcherNote: i.result!.researcherNote,
                      }}
                    />
                  ))}
              </TableBody>
            </Table>
          </div>
          {canReview ? (
            <ActionForm action={finalizeDelphiRoundAction} submitLabel={t("delphiSim.review.finalize")}>
              <input type="hidden" name="roundId" value={round.id} />
              <p className="text-sm text-muted-foreground">{t("delphiSim.review.finalizeHint")}</p>
            </ActionForm>
          ) : null}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>{t("delphiSim.room.matrix")}</CardTitle>
        </CardHeader>
        <CardContent>
          <RatingMatrix
            seats={round.config.seats.map((s) => ({ seatIndex: s.seatIndex, label: s.label, isNewMember: s.isNewMember }))}
            items={items.map((i) => ({ code: i.code, ratings: i.ratings }))}
          />
        </CardContent>
      </Card>
    </SectionTemplate>
  );
}
