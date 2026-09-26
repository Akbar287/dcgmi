import { notFound } from "next/navigation";

import { Notice } from "@/components/molecules/notice";
import { GenericRunner } from "@/components/organisms/generic-runner/generic-runner";
import { requirePermission } from "@/lib/auth/session";
import { dryRunRef, getResponse, loadForm } from "@/lib/db/repository/form-builder";
import type { Answers } from "@/lib/forms/types";
import { formatDateTime } from "@/lib/format";
import { getTranslator } from "@/lib/i18n/server";

import { dryRunSaveAction, dryRunSubmitAction } from "../../builder-actions";

export default async function FormDryRunPage({ params }: PageProps<"/forms/uji/[formId]">) {
  const user = await requirePermission("artifact:write");
  const { formId } = await params;
  const t = await getTranslator();
  const loaded = await loadForm(formId);
  if (!loaded) notFound();
  if (loaded.row.status !== "DRY_RUN") return <Notice tone="locked">{t("builder.modes.DRY_RUN")}</Notice>;
  const response = await getResponse(formId, dryRunRef(user.id));
  if (response?.completed) {
    return <Notice>{t("runner.submittedAt", { time: formatDateTime(response.submittedAt!, t.locale) })} · {t("builder.dryRunBanner")}</Notice>;
  }
  return (
    <GenericRunner
      form={loaded.def}
      initialAnswers={(response?.answers as Answers | undefined) ?? {}}
      mode="DRY_RUN"
      banner={t("builder.dryRunBanner")}
      actions={{ save: dryRunSaveAction.bind(null, formId), submit: dryRunSubmitAction.bind(null, formId) }}
    />
  );
}
