import { RunDesigner } from "@/components/organisms/pipeline/run-designer";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { isMockAi } from "@/lib/ai/models";
import { can } from "@/lib/auth/roles";
import { db } from "@/lib/db/client";
import { listPanelsForEditor } from "@/lib/db/repository/panel-admin";
import { listInstitutionProfiles } from "@/lib/db/repository/scoring-runs";

import { createRunAction } from "../runs/pipeline-actions";
import type { SectionContext } from "./types";

export async function RunDesignerView({ t, user, versionId }: SectionContext) {
  if (!versionId || !can(user.role, "simulation:run")) return null;
  const prisma = await db();
  const [version, g1, panels, models, profiles] = await Promise.all([
    prisma.artifactVersion.findUniqueOrThrow({ where: { id: versionId }, select: { label: true } }),
    prisma.gateRecord.findUnique({ where: { versionId_gate: { versionId, gate: "G1_BASELINE" } } }),
    listPanelsForEditor(),
    prisma.modelProfile.findMany({ where: { provider: { approved: true, enabled: true } }, include: { provider: { select: { label: true } } }, orderBy: { label: "asc" } }),
    listInstitutionProfiles(),
  ]);
  const ready = (preset: string[]) => panels.filter((p) => preset.includes(p.preset) && p.validation.ready).map((p) => ({ id: p.id, label: p.name }));
  const fgd = ready(["FGD_6"]);
  const delphi = ready(["DELPHI_8"]);
  const ahp = ready(["FGD_6", "DELPHI_8"]);
  const missing = [!fgd.length && t("pipeline.fgdPanel"), !delphi.length && t("pipeline.delphiPanel"), !profiles.length && t("pipeline.profiles")].filter(Boolean).join(", ");
  const blocked = g1?.status !== "PASSED" ? t("pipeline.needsG1") : missing ? t("pipeline.missing", { what: missing }) : null;
  return (
    <Card>
      <CardHeader>
        <CardTitle>{t("pipeline.designTitle")}</CardTitle>
        <CardDescription>{t("pipeline.designHint")}</CardDescription>
      </CardHeader>
      <CardContent>
        <RunDesigner
          version={version.label}
          fgdPanels={fgd}
          delphiPanels={delphi}
          ahpPanels={ahp}
          models={models.map((m) => ({ id: m.id, label: `${m.provider.label} · ${m.label}` }))}
          profiles={profiles.map((p) => ({ id: p.id, label: p.label }))}
          blocked={blocked}
          mockAi={isMockAi()}
          action={createRunAction}
        />
      </CardContent>
    </Card>
  );
}
