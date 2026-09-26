import { notFound } from "next/navigation";
import Link from "next/link";

import { Notice } from "@/components/molecules/notice";
import { PersonaEditor } from "@/components/organisms/persona-editor/persona-editor";
import { SectionTemplate } from "@/components/templates/section-template";
import { can } from "@/lib/auth/roles";
import { requirePermission } from "@/lib/auth/session";
import { getPersonaEditor } from "@/lib/db/repository/panel-admin";
import { getTranslator } from "@/lib/i18n/server";

import { savePersonaAction, setPersonaStatusAction } from "../../expert-actions";

export default async function PersonaEditorPage({ params }: PageProps<"/experts/persona/[expertId]">) {
  const user = await requirePermission("panel:manage");
  const { expertId } = await params;
  const t = await getTranslator();
  const data = await getPersonaEditor(expertId);
  if (!data) notFound();

  return (
    <SectionTemplate
      eyebrow={t("nav.modules.experts")}
      title={t("panelAdmin.persona.title", { code: data.expert.panelCode })}
      actions={
        <Link href="/experts/persona" className="text-sm underline underline-offset-4">
          {t("panelAdmin.persona.back")}
        </Link>
      }
      notices={
        <>
          <Notice>{t("notices.personaEthics")}</Notice>
          <Notice tone="locked">{t("panelAdmin.persona.manualNote")}</Notice>
        </>
      }
    >
      {/* Remount on status change so a stale "saved as draft" message never outlives its state. */}
      <PersonaEditor
        key={data.persona?.status ?? "none"}
        expertId={data.expert.id}
        panelCode={data.expert.panelCode}
        persona={data.persona}
        canApprove={can(user.role, "persona:approve")}
        saveAction={savePersonaAction}
        statusAction={setPersonaStatusAction}
      />
    </SectionTemplate>
  );
}
