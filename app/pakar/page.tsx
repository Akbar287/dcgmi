import { InboxIcon, UserIcon } from "@hugeicons/core-free-icons";
import Link from "next/link";

import { StatusBadge } from "@/components/atoms/status-badge";
import { EmptyState } from "@/components/molecules/empty-state";
import { Notice } from "@/components/molecules/notice";
import { PageHeading } from "@/components/molecules/page-heading";
import { buttonVariants } from "@/components/ui/button";
import { Card, CardAction, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { requirePermission } from "@/lib/auth/session";
import { listFormsForCode } from "@/lib/db/repository/pre-review";
import { findPanelCode } from "@/lib/db/repository/users";
import { getTranslator } from "@/lib/i18n/server";

export const metadata = { title: "Ruang Pakar" };

const TONE = { NONE: "neutral", DRAFT: "warning", SUBMITTED: "success" } as const;

export default async function PakarPage() {
  const user = await requirePermission("instrument:fill");
  const t = await getTranslator();
  const code = await findPanelCode(user.id);
  const forms = code ? await listFormsForCode(code) : [];

  return (
    <>
      <PageHeading title={t("pakar.title")} description={t("pakar.greeting", { name: user.name ?? user.email })} />
      <Notice>{t("pakar.isolation")}</Notice>
      {!code ? (
        <EmptyState icon={UserIcon} title={t("runner.noCodeTitle")} description={t("runner.noCodeBody")} />
      ) : forms.length === 0 ? (
        <EmptyState icon={InboxIcon} title={t("pakar.noAssignmentTitle")} description={t("pakar.noAssignmentBody")} />
      ) : (
        <section className="flex flex-col gap-3" aria-label={t("runner.myForms")}>
          <h2 className="text-sm font-medium text-muted-foreground">
            {t("runner.myForms")} · {t("runner.assignedCode")}: <span className="font-mono text-foreground">{code}</span>
          </h2>
          {forms.map((f) => (
            <Card key={f.slug} size="sm">
              <CardHeader>
                <CardTitle>{f.title}</CardTitle>
                <CardDescription>
                  <StatusBadge value={f.state} tone={TONE[f.state as keyof typeof TONE]} label={t(`runner.states.${f.state as keyof typeof TONE}`)} />
                </CardDescription>
                <CardAction>
                  <Link href={`/pakar/${f.slug}`} className={buttonVariants({ size: "sm", variant: f.state === "SUBMITTED" ? "outline" : "default" })}>
                    {f.state === "SUBMITTED" ? t("runner.viewReceipt") : f.state === "DRAFT" ? t("runner.continueForm") : t("runner.openForm")}
                  </Link>
                </CardAction>
              </CardHeader>
            </Card>
          ))}
        </section>
      )}
    </>
  );
}
