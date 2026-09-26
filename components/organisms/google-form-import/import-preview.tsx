"use client";

import { CodeText } from "@/components/atoms/code-text";
import { StatusBadge, type StatusTone } from "@/components/atoms/status-badge";
import { Notice } from "@/components/molecules/notice";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { formatDateTime } from "@/lib/format";
import type { ImportPreview as Preview, RowStatus } from "@/lib/instruments/pre-review/gform-import/preview";
import { useT } from "@/lib/i18n/client";

const TONE: Record<RowStatus, StatusTone> = { READY: "success", DECLINED: "info", ALREADY_IMPORTED: "neutral", BLOCKED: "warning" };

export function ImportPreview({ preview, fileSha256, fileName }: { preview: Preview; fileSha256: string; fileName: string }) {
  const t = useT();
  const status = (s: RowStatus) => t.maybe(`gformImport.status_${s}`) ?? s;

  return (
    <div className="flex flex-col gap-4">
      <dl className="grid gap-x-4 gap-y-1.5 text-sm sm:grid-cols-[10rem_1fr]">
        <dt className="text-muted-foreground">{t("gformImport.file")}</dt>
        <dd>{fileName}</dd>
        <dt className="text-muted-foreground">{t("gformImport.fileHash")}</dt>
        <dd>
          <CodeText className="break-all">{fileSha256}</CodeText>
        </dd>
        <dt className="text-muted-foreground">{t("gformImport.sheet")}</dt>
        <dd>{preview.sheetName ?? t("common.none")}</dd>
        <dt className="text-muted-foreground">{t("gformImport.columns")}</dt>
        <dd className="tabular-nums">{t("gformImport.columnsValue", { matched: preview.matchedColumns, total: preview.totalQuestions })}</dd>
      </dl>
      <p className="text-xs text-muted-foreground">{t("gformImport.timezone")}</p>

      {preview.fileIssues.length > 0 ? (
        <Notice tone="warning" title={t("gformImport.fileIssues")}>
          <ul className="list-disc pl-4">
            {preview.fileIssues.map((i) => (
              <li key={i}>{i}</li>
            ))}
          </ul>
        </Notice>
      ) : null}
      {preview.fileWarnings.length > 0 ? (
        <Notice title={t("gformImport.fileWarnings")}>
          <ul className="list-disc pl-4">
            {preview.fileWarnings.map((i) => (
              <li key={i}>{i}</li>
            ))}
          </ul>
        </Notice>
      ) : null}
      {preview.missingTitles.length > 0 ? (
        <details className="rounded-xl border p-3 text-sm">
          <summary className="cursor-pointer font-medium">
            {t("gformImport.missingTitles")} ({preview.missingTitles.length})
          </summary>
          <ul className="mt-2 list-disc pl-5 text-muted-foreground">
            {preview.missingTitles.map((m) => (
              <li key={m}>{m}</li>
            ))}
          </ul>
        </details>
      ) : null}
      {preview.extraHeaders.length > 0 ? (
        <details className="rounded-xl border p-3 text-sm">
          <summary className="cursor-pointer font-medium">
            {t("gformImport.extraHeaders")} ({preview.extraHeaders.length})
          </summary>
          <ul className="mt-2 list-disc pl-5 text-muted-foreground">
            {preview.extraHeaders.map((m) => (
              <li key={m}>{m}</li>
            ))}
          </ul>
        </details>
      ) : null}

      {preview.rows.length > 0 ? (
        <section className="flex flex-col gap-2">
          <div className="flex flex-wrap items-center gap-2">
            <h3 className="text-sm font-medium">{t("gformImport.rowsTitle")}</h3>
            {(Object.keys(preview.counts) as RowStatus[]).map((s) => (
              <StatusBadge key={s} value={s} tone={TONE[s]} label={`${status(s)}: ${preview.counts[s]}`} />
            ))}
          </div>
          {preview.counts.BLOCKED > 0 ? <p className="text-xs text-muted-foreground">{t("gformImport.heldNote")}</p> : null}
          <div className="overflow-x-auto rounded-2xl border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>{t("gformImport.row")}</TableHead>
                  <TableHead>{t("gformImport.timestamp")}</TableHead>
                  <TableHead>{t("gformImport.code")}</TableHead>
                  <TableHead>{t("gformImport.consent")}</TableHead>
                  <TableHead>{t("gformImport.answered")}</TableHead>
                  <TableHead>{t("gformImport.status")}</TableHead>
                  <TableHead>{t("gformImport.qc")}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {preview.rows.map((r) => (
                  <TableRow key={r.rowNumber}>
                    <TableCell className="tabular-nums">{r.rowNumber}</TableCell>
                    <TableCell className="whitespace-nowrap tabular-nums">{r.timestamp ? formatDateTime(r.timestamp, t.locale) : t("common.none")}</TableCell>
                    <TableCell className="font-mono">{r.code || t("common.none")}</TableCell>
                    <TableCell>{r.consent || t("common.none")}</TableCell>
                    <TableCell className="tabular-nums">
                      {r.answered}/{preview.totalQuestions}
                    </TableCell>
                    <TableCell>
                      <div className="flex flex-col items-start gap-1">
                        <StatusBadge value={r.status} tone={TONE[r.status]} label={status(r.status)} />
                        {r.reason ? <span className="text-xs text-muted-foreground">{t.maybe(`gformImport.reason_${r.reason}`) ?? r.reason}</span> : null}
                      </div>
                    </TableCell>
                    <TableCell>
                      {r.qc.length === 0 ? (
                        t("gformImport.qcNone")
                      ) : (
                        <details>
                          <summary className="cursor-pointer text-sm">{t("gformImport.qcDetail", { n: r.qc.length })}</summary>
                          <ul className="mt-1 max-h-40 overflow-y-auto font-mono text-xs">
                            {r.qc.map((q) => (
                              <li key={`${q.code}:${q.key}`}>
                                {q.code} · {q.key}
                              </li>
                            ))}
                          </ul>
                        </details>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </section>
      ) : null}
    </div>
  );
}
