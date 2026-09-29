import { GatePassForm } from "@/components/molecules/gate-pass-form";
import { Notice } from "@/components/molecules/notice";
import { DeclarationForms, PilotCreateForm, PilotRunner } from "@/components/organisms/pilot/pilot-forms";
import { GateEvaluationCard } from "@/components/organisms/gate-evaluation-card";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { can } from "@/lib/auth/roles";
import { db } from "@/lib/db/client";
import { evaluatePilotGateFor } from "@/lib/db/repository/pilot";
import { listInstitutionProfiles } from "@/lib/db/repository/scoring-runs";
import { formatNumber } from "@/lib/format";
import { cn } from "@/lib/utils";

import { passGateAction } from "../gate-actions";
import { createPilotAction, declarePilotAction, runPilotStepAction } from "../scoring/scoring-actions";
import type { SectionContext } from "./types";

export async function PilotView({ t, user, versionId }: SectionContext) {
  if (!versionId) return null;
  const prisma = await db();
  const [evaluation, gates, profiles, models, runs] = await Promise.all([
    evaluatePilotGateFor(versionId),
    prisma.gateRecord.findMany({ where: { versionId, gate: { in: ["G6_SCORING", "G7_PILOT"] } } }),
    listInstitutionProfiles(),
    prisma.modelProfile.findMany({ where: { provider: { approved: true, enabled: true } }, include: { provider: { select: { label: true } } }, orderBy: { label: "asc" } }),
    prisma.pilotRun.findMany({ where: { versionId }, orderBy: { createdAt: "desc" }, take: 1 }),
  ]);
  const g6 = gates.find((g) => g.gate === "G6_SCORING");
  const g7 = gates.find((g) => g.gate === "G7_PILOT");
  const g7Status = g7?.status ?? "PENDING";
  const canPass = can(user.role, "gate:pass") && evaluation.passed && g6?.status === "PASSED" && g7Status !== "PASSED";
  const latest = runs[0];
  const pending = latest ? await prisma.assessment.count({ where: { pilotRunId: latest.id, status: { notIn: ["COMPLETED", "CANCELLED"] } } }) : 0;
  const fmt = (v: number | null, d = 3) => (v === null ? "—" : formatNumber(v, t.locale, d));
  return (
    <>
      <Notice tone="warning">{t("pilot.simulatedNotice")}</Notice>
      <GateEvaluationCard
        evaluation={evaluation}
        title={t("pilot.g7Title")}
        hint={t("pilot.g7Hint")}
        recordStatus={g7Status}
        decidedAt={g7?.decidedAt?.toISOString() ?? null}
        action={canPass ? <GatePassForm gate="G7_PILOT" gateLabel="G7" action={passGateAction} /> : g6?.status !== "PASSED" ? <Notice tone="locked">{t("pilot.g6First")}</Notice> : undefined}
      />
      <Card>
        <CardHeader>
          <CardTitle>{t("pilot.declarations")}</CardTitle>
          <CardDescription>{t("pilot.declarationsHint")}</CardDescription>
        </CardHeader>
        <CardContent>
          {can(user.role, "gate:pass") ? (
            <DeclarationForms ethics={evaluation.ethics} access={evaluation.access} action={declarePilotAction} />
          ) : (
            <p className="text-sm">
              {evaluation.ethics?.reference ?? "—"} · {evaluation.access?.note ?? "—"}
            </p>
          )}
        </CardContent>
      </Card>
      {can(user.role, "simulation:run") && g6?.status === "PASSED" ? (
        <Card>
          <CardHeader>
            <CardTitle>{t("pilot.createTitle")}</CardTitle>
            <CardDescription>{t("pilot.createHint")}</CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col gap-4">
            <PilotCreateForm profiles={profiles.map((p) => ({ id: p.id, label: p.label }))} models={models.map((m) => ({ id: m.id, label: `${m.provider.label} · ${m.label}` }))} action={createPilotAction} />
            {latest ? <PilotRunner runId={latest.id} pending={pending} action={runPilotStepAction} /> : null}
          </CardContent>
        </Card>
      ) : null}
      {evaluation.results.map((r) => (
        <Card key={`${r.runId}-${r.profile}`}>
          <CardHeader>
            <CardTitle>{r.profile}</CardTitle>
            <CardDescription>{r.status === "COMPLETED" ? t("pilot.compared", { n: r.compared, excluded: r.excluded }) : t("pilot.inProgress")}</CardDescription>
          </CardHeader>
          <CardContent className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_auto]">
            <dl className="grid grid-cols-2 gap-2 text-sm sm:grid-cols-3">
              {[
                [t("pilot.kappa"), fmt(r.kappa), r.kappa !== null && r.kappa >= 0.6],
                [t("pilot.agreement"), fmt(r.agreement), r.agreement >= 0.8],
                [`${t("pilot.completeness")} A`, fmt(r.completeness[0]), r.completeness[0] >= 0.9],
                [`${t("pilot.completeness")} B`, fmt(r.completeness[1]), r.completeness[1] >= 0.9],
                [`${t("pilot.traceability")} A`, fmt(r.traceability[0]), r.traceability[0] >= 1],
                [`${t("pilot.traceability")} B`, fmt(r.traceability[1]), r.traceability[1] >= 1],
              ].map(([k, v, ok]) => (
                <div key={String(k)} className="rounded-lg bg-muted/40 px-3 py-2">
                  <dt className="text-xs text-muted-foreground">{k}</dt>
                  <dd className={cn("tabular-nums font-medium", r.status === "COMPLETED" && !ok && "text-destructive")}>{v}</dd>
                </div>
              ))}
            </dl>
            <div>
              <p className="mb-1 text-xs text-muted-foreground">{t("pilot.confusion")}</p>
              <table className="border-separate border-spacing-0.5 text-xs tabular-nums">
                <thead>
                  <tr>
                    <th className="px-1 text-muted-foreground">A↓ B→</th>
                    {[1, 2, 3, 4, 5].map((l) => (
                      <th key={l} className="px-1.5 font-medium">{l}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {r.confusion.map((row, i) => (
                    <tr key={i}>
                      <th className="px-1.5 font-medium">{i + 1}</th>
                      {row.map((n, j) => (
                        <td key={j} className={cn("h-6 min-w-7 rounded text-center", i === j ? "bg-primary/20" : n ? "bg-warning/20" : "bg-muted/30")}>
                          {n || ""}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      ))}
    </>
  );
}
