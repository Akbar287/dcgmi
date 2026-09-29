"use client";

import { useRouter } from "next/navigation";
import { useRef, useState, useTransition } from "react";

import { StatusBadge } from "@/components/atoms/status-badge";
import { ActionForm } from "@/components/molecules/action-form";
import { Notice } from "@/components/molecules/notice";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import type { ActionResult } from "@/lib/action-result";
import { formatDateTime } from "@/lib/format";
import { useT } from "@/lib/i18n/client";
import type { ChapterKey, ChapterState } from "@/lib/report/chapters";

type FormAction<T = null> = (s: ActionResult<T> | null, f: FormData) => Promise<ActionResult<T> | null>;

export function ReportRoom({
  job,
  canApprove,
  canEdit,
  advance,
  edit,
  op,
  build,
}: {
  job: { id: string; status: string; modelId: string; chapters: ChapterState[]; pages: number | null; pdfSha256: string | null; error: string | null };
  canApprove: boolean;
  canEdit: boolean;
  advance: (id: string) => Promise<ActionResult<{ kind: string; error?: string }>>;
  edit: FormAction;
  op: (id: string, key: ChapterKey, op: "APPROVE" | "REGENERATE") => Promise<ActionResult>;
  build: FormAction<{ pages: number; sha256: string }>;
}) {
  const t = useT();
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const stop = useRef(false);
  const pendingCount = job.chapters.filter((c) => c.status === "PENDING").length;
  const approved = job.chapters.filter((c) => c.status === "APPROVED").length;

  const narrate = async () => {
    setBusy(true);
    setMessage(null);
    stop.current = false;
    for (;;) {
      const r = await advance(job.id);
      router.refresh();
      if (!r.ok) {
        setMessage(r.error.message);
        break;
      }
      if (r.data.kind === "FAILED") {
        setMessage(t("report.failed", { error: r.data.error ?? "" }));
        break;
      }
      if (r.data.kind === "REVIEW" || stop.current) break;
    }
    setBusy(false);
  };

  return (
    <div className="flex flex-col gap-4">
      <Card>
        <CardContent className="flex flex-col gap-3 pt-6">
          <div className="flex flex-wrap items-center gap-3">
            <StatusBadge value={job.status} label={t.maybe(`report.status.${job.status}`) ?? job.status} />
            <span className="text-sm tabular-nums text-muted-foreground">{t("report.progress", { approved, total: job.chapters.length, model: job.modelId })}</span>
            <div className="ml-auto flex gap-2">
              <Button size="sm" disabled={busy || pendingCount === 0} onClick={() => void narrate()}>
                {busy ? t("report.narrating") : t("report.narrate", { n: pendingCount })}
              </Button>
              {busy ? (
                <Button size="sm" variant="ghost" onClick={() => (stop.current = true)}>
                  {t("pipeline.pause")}
                </Button>
              ) : null}
            </div>
          </div>
          {message ? <Notice tone="warning">{message}</Notice> : null}
          {job.error ? <Notice tone="warning">{job.error}</Notice> : null}
          {job.status === "COMPLETED" && job.pdfSha256 ? (
            <div className="flex flex-wrap items-center gap-3">
              <a href={`/api/report/${job.id}`} download className="rounded-4xl bg-primary px-4 py-2 text-sm font-medium text-primary-foreground">
                {t("report.download", { pages: job.pages ?? 0 })}
              </a>
              <a href={`/api/report/${job.id}/docx`} download className="rounded-4xl border px-4 py-2 text-sm font-medium">
                {t("report.downloadDocx")}
              </a>
              <span className="break-all font-mono text-xs text-muted-foreground">SHA-256 {job.pdfSha256}</span>
            </div>
          ) : approved === job.chapters.length ? (
            <ActionForm action={build} submitLabel={t("report.build")}>
              <input type="hidden" name="jobId" value={job.id} />
              <p className="text-xs text-muted-foreground">{t("report.buildHint")}</p>
            </ActionForm>
          ) : (
            <p className="text-xs text-muted-foreground">{t("report.approveAll")}</p>
          )}
        </CardContent>
      </Card>
      {job.chapters.map((c, i) => (
        <Card key={c.key}>
          <CardHeader>
            <CardTitle className="flex flex-wrap items-center gap-2">
              {i + 1}. {c.title}
              <StatusBadge value={c.status === "APPROVED" ? "ACCEPTED" : c.status === "DRAFT" ? "PENDING" : "QUEUED"} label={t(`report.chapter.${c.status}`)} />
              {c.edited ? <span className="text-xs font-normal text-muted-foreground">{t("report.edited")}</span> : null}
            </CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col gap-3">
            {c.error ? <Notice tone="warning">{c.error}</Notice> : null}
            {c.narrative ? (
              canEdit ? (
                <ActionForm action={edit} submitLabel={t("report.saveEdit")} submitVariant="outline" successLabel={t("editor.saved")}>
                  <input type="hidden" name="jobId" value={job.id} />
                  <input type="hidden" name="key" value={c.key} />
                  <Textarea name="narrative" defaultValue={c.narrative} rows={10} className="text-sm" aria-label={c.title} />
                </ActionForm>
              ) : (
                <p className="whitespace-pre-line text-sm">{c.narrative}</p>
              )
            ) : (
              <p className="text-sm text-muted-foreground">{t("report.notYet")}</p>
            )}
            <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
              {c.generatedAt ? <span>{t("report.generated", { at: formatDateTime(c.generatedAt, t.locale) })}</span> : null}
              {c.approvedAt ? <span>· {t("report.approvedAt", { at: formatDateTime(c.approvedAt, t.locale) })}</span> : null}
              <span className="ml-auto flex gap-2">
                {c.narrative && c.status !== "APPROVED" && canApprove ? (
                  <Button size="sm" disabled={pending} onClick={() => start(async () => { const r = await op(job.id, c.key, "APPROVE"); if (!r.ok) setMessage(r.error.message); router.refresh(); })}>
                    {t("report.approve")}
                  </Button>
                ) : null}
                {c.status !== "PENDING" ? (
                  <Button size="sm" variant="ghost" disabled={pending} onClick={() => start(async () => { await op(job.id, c.key, "REGENERATE"); router.refresh(); })}>
                    {t("report.regenerate")}
                  </Button>
                ) : null}
              </span>
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
