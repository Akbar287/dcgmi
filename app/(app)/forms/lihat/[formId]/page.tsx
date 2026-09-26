import { notFound } from "next/navigation";

import { Notice } from "@/components/molecules/notice";
import { GenericRunner } from "@/components/organisms/generic-runner/generic-runner";
import { requirePermission } from "@/lib/auth/session";
import { loadForm } from "@/lib/db/repository/form-builder";
import { getTranslator } from "@/lib/i18n/server";

// SPECIFICATION §4.2 pratinjau: the runner exactly as respondents see it, nothing stored.
export default async function FormPreviewPage({ params }: PageProps<"/forms/lihat/[formId]">) {
  await requirePermission("console:read");
  const { formId } = await params;
  const t = await getTranslator();
  const loaded = await loadForm(formId);
  if (!loaded) notFound();
  return (
    <div className="flex flex-col gap-4">
      <Notice>{t("builder.previewHint")}</Notice>
      <GenericRunner form={loaded.def} initialAnswers={{}} mode="PREVIEW" />
    </div>
  );
}
