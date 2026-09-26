import Link from "next/link";

import { StatusBadge } from "@/components/atoms/status-badge";
import { ExpertTable } from "@/components/organisms/expert-manager/expert-table";
import { IdentityTable } from "@/components/organisms/identity-manager/identity-table";
import { ModelPingTable } from "@/components/organisms/model-ping/model-ping-table";
import { PanelCard } from "@/components/organisms/seat-editor/panel-card";
import { PanelRolesForm } from "@/components/organisms/seat-editor/panel-roles-form";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { listExpertsForAdmin, listIdentitiesForAdmin, listModelOptions, listPanelsForEditor } from "@/lib/db/repository/panel-admin";

import { deleteIdentityAction, saveExpertAction, saveIdentityAction } from "../experts/expert-actions";
import { pingModelAction, setPanelRolesAction, updateSeatAction } from "../panel/panel-actions";
import type { SectionContext } from "./types";

export async function ExpertRegistryView() {
  return <ExpertTable experts={await listExpertsForAdmin()} action={saveExpertAction} />;
}

export async function PersonaListView({ t }: SectionContext) {
  const experts = await listExpertsForAdmin();
  if (experts.length === 0) return <p className="text-sm text-muted-foreground">{t("panelAdmin.experts.none")}</p>;
  return (
    <div className="overflow-x-auto rounded-2xl border">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>{t("panelAdmin.experts.panelCode")}</TableHead>
            <TableHead>{t("panelAdmin.experts.field")}</TableHead>
            <TableHead>{t("panelAdmin.experts.persona")}</TableHead>
            <TableHead className="text-right">
              <span className="sr-only">{t("columns.action")}</span>
            </TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {experts.map((e) => (
            <TableRow key={e.id}>
              <TableCell className="font-mono">{e.panelCode}</TableCell>
              <TableCell>{t(`enums.${e.field}`)}</TableCell>
              <TableCell>
                {e.personaStatus ? (
                  <StatusBadge value={e.personaStatus} label={t.maybe(`enums.${e.personaStatus}`) ?? e.personaStatus} />
                ) : (
                  t("panelAdmin.persona.noPersona")
                )}
              </TableCell>
              <TableCell className="text-right">
                <Link href={`/experts/persona/${e.id}`} className="text-sm underline underline-offset-4">
                  {t("panelAdmin.experts.openPersona")}
                </Link>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}

export async function IdentityView() {
  return <IdentityTable identities={await listIdentitiesForAdmin()} saveAction={saveIdentityAction} deleteAction={deleteIdentityAction} />;
}

export async function SeatEditorView() {
  const [panels, experts, models] = await Promise.all([listPanelsForEditor(), listExpertsForAdmin(), listModelOptions()]);
  const expertOptions = experts.map((e) => ({ id: e.id, panelCode: e.panelCode, field: e.field, personaStatus: e.personaStatus }));
  const modelOptions = models.map((m) => ({ id: m.id, label: m.label }));
  return (
    <div className="flex flex-col gap-6">
      {panels.map((p) => (
        <PanelCard
          key={p.id}
          name={p.name}
          preset={p.preset}
          validation={p.validation}
          experts={expertOptions}
          models={modelOptions}
          action={updateSeatAction}
          roles={
            <PanelRolesForm
              configId={p.id}
              facilitatorModelId={p.facilitatorModelId}
              notetakerModelId={p.notetakerModelId}
              models={modelOptions}
              action={setPanelRolesAction}
            />
          }
          seats={p.seats.map((s) => ({
            id: s.id,
            seatIndex: s.seatIndex,
            label: s.label,
            field: s.field,
            isNewMember: s.isNewMember,
            expertId: s.expert?.id ?? null,
            modelId: s.model.id,
            temperature: s.temperature,
            seed: s.seed,
          }))}
        />
      ))}
    </div>
  );
}

export async function ConnectionTestView() {
  const models = await listModelOptions();
  return <ModelPingTable models={models} action={pingModelAction} />;
}
