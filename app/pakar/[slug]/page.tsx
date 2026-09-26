import { Cancel01Icon, UserIcon } from "@hugeicons/core-free-icons";

import { EmptyState } from "@/components/molecules/empty-state";
import { FormRunner } from "@/components/organisms/form-runner/form-runner";
import { ResponseReceipt } from "@/components/organisms/response-receipt";
import { requirePermission } from "@/lib/auth/session";
import { loadFormBySlug } from "@/lib/db/repository/form-builder";
import { getResponseForCode, getRunnerForm } from "@/lib/db/repository/pre-review";
import { findPanelCode } from "@/lib/db/repository/users";
import { getTranslator } from "@/lib/i18n/server";
import type { Answers } from "@/lib/instruments/pre-review/types";

import { declineAction, saveDraftAction, submitAction } from "./actions";
import { GenericPakarRunner } from "./generic-runner-page";

function metaNumber(meta: unknown, key: string): number | null {
  const v = typeof meta === "object" && meta !== null ? (meta as Record<string, unknown>)[key] : undefined;
  return typeof v === "number" ? v : null;
}

export default async function PreReviewRunnerPage({ params }: PageProps<"/pakar/[slug]">) {
  const { slug } = await params;
  const user = await requirePermission("instrument:fill");
  const t = await getTranslator();
  const code = await findPanelCode(user.id);
  if (!code) return <EmptyState icon={UserIcon} title={t("runner.noCodeTitle")} description={t("runner.noCodeBody")} />;

  const generic = await loadFormBySlug(slug);
  if (generic) return <GenericPakarRunner slug={slug} code={code} loaded={generic} />;

  const form = await getRunnerForm(slug);
  const response = form ? await getResponseForCode(form.id, code) : null;

  // A submitted response stays viewable as a receipt even after the form closes.
  if (form && response?.completed && response.submittedAt) {
    return (
      <ResponseReceipt
        expertCode={code}
        submittedAt={response.submittedAt.toISOString()}
        durationMs={metaNumber(response.meta, "durationMs")}
        message={form.snapshot.confirmationMessage}
      />
    );
  }
  if (!form || form.status !== "ACTIVE" || !form.snapshot.data.experts.includes(code)) {
    return <EmptyState icon={Cancel01Icon} title={t("runner.unavailableTitle")} description={t("runner.unavailableBody")} />;
  }

  const { snapshot } = form;
  return (
    <FormRunner
      definition={{
        slug,
        title: snapshot.title,
        description: snapshot.description,
        expertCode: code,
        plan: snapshot.plan,
        options: snapshot.data.options,
        indicatorNames: Object.fromEntries(snapshot.data.items.map((x) => [x.id, x.indicator])),
      }}
      initialAnswers={(response?.answers as Answers | undefined) ?? {}}
      initialPage={metaNumber(response?.meta, "pageIndex") ?? 0}
      actions={{ saveDraft: saveDraftAction, submit: submitAction, decline: declineAction }}
    />
  );
}
