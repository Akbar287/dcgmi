import { Download04Icon } from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";

import { CodeText } from "@/components/atoms/code-text";
import { OriginBadge } from "@/components/atoms/origin-badge";
import { StatusBadge } from "@/components/atoms/status-badge";
import { FormOpenToggle } from "@/components/molecules/form-open-toggle";
import { buttonVariants } from "@/components/ui/button";
import { Card, CardAction, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import type { ActionResult } from "@/lib/action-result";
import { formatDateTime } from "@/lib/format";
import { getTranslator } from "@/lib/i18n/server";

export interface PreReviewFormSummary {
  id: string;
  slug: string;
  title: string;
  status: string;
  sourceSha256: string | null;
  signature: string;
  sourceFile: string;
  testEvidence: string;
  openedAt: string | null;
  closedAt: string | null;
  codes: { code: string; state: "NONE" | "DRAFT" | "SUBMITTED" }[];
  submitted: number;
  declined: number;
}

const CODE_TONE = { NONE: "neutral", DRAFT: "warning", SUBMITTED: "success" } as const;

export async function PreReviewFormCard({
  form,
  issues,
  canManage,
  toggleAction,
}: {
  form: PreReviewFormSummary;
  issues: string[];
  canManage: boolean;
  toggleAction: (state: ActionResult | null, formData: FormData) => Promise<ActionResult | null>;
}) {
  const t = await getTranslator();
  const ready = issues.length === 0;
  const isOpen = form.status === "ACTIVE";
  const meta: [string, React.ReactNode][] = [
    [t("preReview.source"), form.sourceFile],
    [t("preReview.dataHash"), <CodeText key="d">{form.sourceSha256}</CodeText>],
    [t("preReview.signature"), <CodeText key="s">{form.signature}</CodeText>],
    [t("preReview.testEvidence"), form.testEvidence],
    [t("preReview.openedAt"), form.openedAt ? formatDateTime(form.openedAt, t.locale) : t("common.none")],
    [t("preReview.closedAt"), form.closedAt ? formatDateTime(form.closedAt, t.locale) : t("common.none")],
  ];

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex flex-wrap items-center gap-2">
          {form.title}
          <StatusBadge value={form.status} label={t.maybe(`enums.${form.status}`) ?? form.status} />
          <OriginBadge origin="REAL" />
        </CardTitle>
        <CardDescription>
          <CodeText>/pakar/{form.slug}</CodeText>
        </CardDescription>
        {canManage ? (
          <CardAction className="flex flex-wrap items-start gap-2">
            <FormOpenToggle formId={form.id} isOpen={isOpen} disabled={!isOpen && !ready} action={toggleAction} />
            <a href={`/api/forms/${form.slug}/export`} className={buttonVariants({ variant: "outline", size: "sm" })}>
              <HugeiconsIcon icon={Download04Icon} strokeWidth={2} aria-hidden="true" data-icon="inline-start" />
              {t("preReview.export")}
            </a>
          </CardAction>
        ) : null}
      </CardHeader>
      <CardContent className="grid gap-6 lg:grid-cols-2">
        <dl className="grid grid-cols-[9rem_1fr] gap-x-3 gap-y-2 text-sm">
          {meta.map(([k, v]) => (
            <div key={k} className="contents">
              <dt className="text-muted-foreground">{k}</dt>
              <dd className="min-w-0 break-all">{v}</dd>
            </div>
          ))}
        </dl>
        <div className="flex flex-col gap-4">
          <section className="flex flex-col gap-2">
            <h3 className="flex items-center gap-2 text-sm font-medium">
              {t("preReview.readiness")}
              <StatusBadge value={ready ? "PASSED" : "FAILED"} label={ready ? t("preReview.ready") : t("preReview.notReady")} />
            </h3>
            {ready ? (
              <p className="text-sm text-muted-foreground">{t("preReview.contentOk")}</p>
            ) : (
              <ul className="list-disc pl-5 text-sm text-destructive">
                {issues.map((i) => (
                  <li key={i}>{i}</li>
                ))}
              </ul>
            )}
          </section>
          <section className="flex flex-col gap-2">
            <h3 className="text-sm font-medium">{t("preReview.codes")}</h3>
            <ul className="flex flex-wrap gap-2">
              {form.codes.map((c) => (
                <li key={c.code}>
                  <StatusBadge value={c.state} tone={CODE_TONE[c.state]} label={`${c.code} · ${t(`runner.states.${c.state}`)}`} />
                </li>
              ))}
            </ul>
            <p className="text-xs text-muted-foreground">
              {t("preReview.submitted")}: {form.submitted} · {t("preReview.declined")}: {form.declined}
            </p>
          </section>
        </div>
      </CardContent>
    </Card>
  );
}
