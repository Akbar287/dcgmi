import { DatabaseIcon, Layers01Icon } from "@hugeicons/core-free-icons";

import { EmptyState } from "@/components/molecules/empty-state";
import { GatePassForm } from "@/components/molecules/gate-pass-form";
import { BaselineHealth } from "@/components/organisms/baseline-health";
import { GateEvaluationCard } from "@/components/organisms/gate-evaluation-card";
import { GateTimeline } from "@/components/organisms/gate-timeline";
import { SectionTemplate } from "@/components/templates/section-template";
import { can } from "@/lib/auth/roles";
import { requirePermission } from "@/lib/auth/session";
import { getArtifactSnapshot, listGateRecords } from "@/lib/db/repository/artifact";
import { tryQuery } from "@/lib/db/result";
import { getTranslator } from "@/lib/i18n/server";
import { evaluateBaselineGate, GATE_ORDER, type GateKey } from "@/lib/method/gates";

import { getActiveVersionId } from "./_lib/active-version";
import { passGateAction } from "./gate-actions";

export default async function DashboardPage() {
  const user = await requirePermission("console:read");
  const t = await getTranslator();

  const data = await tryQuery(async () => {
    const versionId = await getActiveVersionId();
    if (!versionId) return null;
    const [snapshot, gates] = await Promise.all([getArtifactSnapshot(versionId), listGateRecords(versionId)]);
    return { snapshot, gates };
  });

  let content: React.ReactNode;
  if (!data.ok) {
    content = <EmptyState icon={DatabaseIcon} title={t("db.unavailableTitle")} description={t("db.unavailableBody")} />;
  } else if (!data.data) {
    content = (
      <EmptyState icon={Layers01Icon} title={t("dashboard.noVersionTitle")} description={t("dashboard.noVersionBody")} />
    );
  } else {
    const { snapshot, gates } = data.data;
    const gateStates = gates
      .filter((g): g is typeof g & { gate: GateKey } => (GATE_ORDER as string[]).includes(g.gate))
      .map((g) => ({ gate: g.gate, status: g.status }));
    const evaluation = evaluateBaselineGate(snapshot);
    const g1 = gates.find((g) => g.gate === "G1_BASELINE");
    const g1Status = g1?.status ?? "PENDING";
    const canPass = can(user.role, "gate:pass") && evaluation.passed && g1Status !== "PASSED";
    content = (
      <>
        <GateTimeline gates={gateStates} />
        <GateEvaluationCard
          evaluation={evaluation}
          title={t("dashboard.baselineGate")}
          recordStatus={g1Status}
          decidedAt={g1?.decidedAt?.toISOString() ?? null}
          action={canPass ? <GatePassForm gate="G1_BASELINE" gateLabel="G1" action={passGateAction} /> : undefined}
        />
        <BaselineHealth snapshot={snapshot} />
      </>
    );
  }

  return (
    <SectionTemplate title={t("dashboard.title")} description={t("dashboard.description")}>
      {content}
    </SectionTemplate>
  );
}
