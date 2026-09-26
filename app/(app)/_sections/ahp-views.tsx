import { GatePassForm } from "@/components/molecules/gate-pass-form";
import { AhpSessionCreateForm } from "@/components/organisms/ahp/session-create-form";
import { GateEvaluationCard } from "@/components/organisms/gate-evaluation-card";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { defaultScenarios, scenariosToText } from "@/lib/ahp/scenarios";
import { isMockAi } from "@/lib/ai/models";
import { can } from "@/lib/auth/roles";
import { db } from "@/lib/db/client";
import { evaluateAhpGateFor, planAhpSession } from "@/lib/db/repository/ahp-sessions";
import { listPanelsForEditor } from "@/lib/db/repository/panel-admin";

import { createAhpSessionAction } from "../ahp/ahp-actions";
import { passGateAction } from "../gate-actions";
import type { SectionContext } from "./types";

export async function AhpConfigView({ t, user, versionId }: SectionContext) {
  if (!versionId) return null;
  const prisma = await db();
  const [plan, panels, evaluation, gates] = await Promise.all([
    planAhpSession(versionId),
    listPanelsForEditor(),
    evaluateAhpGateFor(versionId),
    prisma.gateRecord.findMany({ where: { versionId, gate: { in: ["G4_CONTENT_LOCK", "G5_AHP"] } } }),
  ]);
  const g4 = gates.find((g) => g.gate === "G4_CONTENT_LOCK");
  const g5 = gates.find((g) => g.gate === "G5_AHP");
  const g5Status = g5?.status ?? "PENDING";
  const canPass = can(user.role, "gate:pass") && evaluation.passed && g4?.status === "PASSED" && g5Status !== "PASSED";
  return (
    <>
      {evaluation.sessionId ? (
        <GateEvaluationCard
          evaluation={evaluation}
          title={t("ahpSim.g5Title")}
          hint={t("ahpSim.g5Hint")}
          recordStatus={g5Status}
          decidedAt={g5?.decidedAt?.toISOString() ?? null}
          action={canPass ? <GatePassForm gate="G5_AHP" gateLabel="G5" action={passGateAction} /> : undefined}
        />
      ) : null}
      {can(user.role, "simulation:run") ? (
        <Card>
          <CardHeader>
            <CardTitle>{t("ahpSim.createTitle")}</CardTitle>
            <CardDescription>{t("ahpSim.createHint")}</CardDescription>
          </CardHeader>
          <CardContent>
            <AhpSessionCreateForm
              panels={panels
                .filter((p) => ["FGD_6", "DELPHI_8"].includes(p.preset))
                .map((p) => ({ id: p.id, name: p.name, ready: p.validation.ready, seats: p.seats.map((s) => ({ seatIndex: s.seatIndex, label: s.label, field: s.field })) }))}
              groups={plan.groups.map((g) => ({ key: g.key, level: g.level, size: g.elements.length }))}
              defaultScenarios={scenariosToText(defaultScenarios(plan.domainCodes))}
              blocked={plan.blocked}
              mockAi={isMockAi()}
              action={createAhpSessionAction}
            />
          </CardContent>
        </Card>
      ) : null}
    </>
  );
}
