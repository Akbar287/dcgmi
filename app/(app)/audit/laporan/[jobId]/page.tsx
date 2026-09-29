import Link from "next/link";
import { notFound } from "next/navigation";

import { Notice } from "@/components/molecules/notice";
import { ReportRoom } from "@/components/organisms/report/report-room";
import { SectionTemplate } from "@/components/templates/section-template";
import { can } from "@/lib/auth/roles";
import { requirePermission } from "@/lib/auth/session";
import { getReportJob } from "@/lib/db/repository/report-jobs";
import { getTranslator } from "@/lib/i18n/server";

import { advanceReportAction, buildReportAction, chapterOpAction, editChapterAction } from "../../report-actions";

export default async function ReportPage({ params }: PageProps<"/audit/laporan/[jobId]">) {
  const user = await requirePermission("console:read");
  const { jobId } = await params;
  const t = await getTranslator();
  const job = await getReportJob(jobId);
  if (!job) notFound();
  return (
    <SectionTemplate
      eyebrow={t("nav.modules.audit")}
      title={t("report.title", { version: job.versionLabel })}
      description={t("report.description")}
      actions={
        <Link href="/audit/reproduksi" className="text-sm underline underline-offset-4">
          {t("nav.sections.audit.reproduksi")}
        </Link>
      }
      notices={
        <>
          <Notice tone="warning">{t("banner.simulatedDetail")}</Notice>
          <Notice>{t("report.aiNotice", { model: job.modelId })}</Notice>
        </>
      }
    >
      <ReportRoom
        job={job}
        canApprove={can(user.role, "gate:pass")}
        canEdit={can(user.role, "artifact:write")}
        advance={advanceReportAction}
        edit={editChapterAction}
        op={chapterOpAction}
        build={buildReportAction}
      />
    </SectionTemplate>
  );
}
