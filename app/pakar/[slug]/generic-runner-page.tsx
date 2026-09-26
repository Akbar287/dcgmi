import { Cancel01Icon } from "@hugeicons/core-free-icons";

import { EmptyState } from "@/components/molecules/empty-state";
import { GenericRunner } from "@/components/organisms/generic-runner/generic-runner";
import { ResponseReceipt } from "@/components/organisms/response-receipt";
import { getResponse, type loadForm } from "@/lib/db/repository/form-builder";
import { delphiFeedbackForCode } from "@/lib/db/repository/delphi-real";
import type { Answers } from "@/lib/forms/types";
import { getTranslator } from "@/lib/i18n/server";

import { genericSaveAction, genericSubmitAction } from "./generic-actions";

export async function GenericPakarRunner({ slug, code, loaded }: { slug: string; code: string; loaded: NonNullable<Awaited<ReturnType<typeof loadForm>>> }) {
  const t = await getTranslator();
  const response = await getResponse(loaded.def.id, code);
  if (response?.completed && response.submittedAt) {
    const meta = (response.meta ?? {}) as { durationMs?: number };
    return <ResponseReceipt expertCode={code} submittedAt={response.submittedAt.toISOString()} durationMs={meta.durationMs ?? null} message={t("runner.submittedTitle")} />;
  }
  if (loaded.row.status !== "ACTIVE" || !loaded.settings.respondents.includes(code)) {
    return <EmptyState icon={Cancel01Icon} title={t("runner.unavailableTitle")} description={t("runner.unavailableBody")} />;
  }
  // Delphi R2/R3: this expert's own previous score plus anonymous group statistics (§3.13.2).
  const feedback = loaded.settings.kind === "DELPHI" ? await delphiFeedbackForCode(loaded.settings, code) : undefined;
  return (
    <GenericRunner
      form={loaded.def}
      initialAnswers={(response?.answers as Answers | undefined) ?? {}}
      mode="LIVE"
      feedback={feedback}
      actions={{ save: genericSaveAction.bind(null, slug), submit: genericSubmitAction.bind(null, slug) }}
    />
  );
}
