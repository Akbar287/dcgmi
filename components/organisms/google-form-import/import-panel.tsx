"use client";

import { FileUploadIcon } from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";
import { useRouter } from "next/navigation";
import { useState } from "react";

import { Notice } from "@/components/molecules/notice";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Field, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { NativeSelect, NativeSelectOption } from "@/components/ui/native-select";
import type { ActionResult } from "@/lib/action-result";
import type { ImportPreview as Preview } from "@/lib/instruments/pre-review/gform-import/preview";
import { useT } from "@/lib/i18n/client";

import { ImportPreview } from "./import-preview";

export interface PreviewPayload {
  preview: Preview;
  fileSha256: string;
  fileName: string;
}

export function GoogleFormImportPanel({
  forms,
  previewAction,
  commitAction,
}: {
  forms: { id: string; title: string; slug: string }[];
  previewAction: (formData: FormData) => Promise<ActionResult<PreviewPayload>>;
  commitAction: (formData: FormData) => Promise<ActionResult<{ imported: number; declined: number }>>;
}) {
  const t = useT();
  const router = useRouter();
  const [formId, setFormId] = useState(forms[0]?.id ?? "");
  const [file, setFile] = useState<File | null>(null);
  const [inputKey, setInputKey] = useState(0);
  const [result, setResult] = useState<PreviewPayload | null>(null);
  const [confirmed, setConfirmed] = useState(false);
  const [busy, setBusy] = useState<"preview" | "commit" | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState<string | null>(null);

  if (forms.length === 0) return <Notice>{t("gformImport.noForms")}</Notice>;

  const payload = (extra: Record<string, string> = {}) => {
    const data = new FormData();
    data.set("formId", formId);
    if (file) data.set("file", file);
    Object.entries(extra).forEach(([k, v]) => data.set(k, v));
    return data;
  };
  const message = (r: { error: { code: string; message: string } }) =>
    r.error.code === "VALIDATION_ERROR" || r.error.code === "CONFLICT" || r.error.code === "NOT_READY"
      ? r.error.message
      : (t.maybe(`errors.${r.error.code}`) ?? r.error.message);

  const preview = async () => {
    if (!file) return;
    setBusy("preview");
    setError(null);
    setDone(null);
    setConfirmed(false);
    const r = await previewAction(payload());
    setBusy(null);
    if (r.ok) setResult(r.data);
    else {
      setResult(null);
      setError(message(r));
    }
  };

  const commit = async () => {
    if (!file || !result) return;
    setBusy("commit");
    setError(null);
    const r = await commitAction(payload({ expectedSha256: result.fileSha256, confirmed: confirmed ? "yes" : "no" }));
    setBusy(null);
    if (!r.ok) return setError(message(r));
    setDone(t("gformImport.done", r.data));
    setResult(null);
    setFile(null);
    setConfirmed(false);
    setInputKey((k) => k + 1);
    router.refresh();
  };

  const importable = result ? result.preview.counts.READY + result.preview.counts.DECLINED : 0;
  const blockedFile = Boolean(result && result.preview.fileIssues.length > 0);

  return (
    <div className="flex flex-col gap-5">
      <div className="grid gap-4 md:grid-cols-[1fr_1fr_auto] md:items-end">
        <Field>
          <FieldLabel htmlFor="gform-form">{t("gformImport.form")}</FieldLabel>
          <NativeSelect id="gform-form" value={formId} onChange={(e) => (setFormId(e.target.value), setResult(null))} className="w-full">
            {forms.map((f) => (
              <NativeSelectOption key={f.id} value={f.id}>
                {f.title} ({f.slug})
              </NativeSelectOption>
            ))}
          </NativeSelect>
        </Field>
        <Field>
          <FieldLabel htmlFor="gform-file">{t("gformImport.file")}</FieldLabel>
          <Input
            key={inputKey}
            id="gform-file"
            type="file"
            accept=".xlsx,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
            onChange={(e) => {
              setFile(e.target.files?.[0] ?? null);
              setResult(null);
              setDone(null);
            }}
          />
        </Field>
        <Button onClick={() => void preview()} disabled={!file || busy !== null}>
          <HugeiconsIcon icon={FileUploadIcon} strokeWidth={2} aria-hidden="true" data-icon="inline-start" />
          {busy === "preview" ? t("gformImport.previewing") : t("gformImport.preview")}
        </Button>
      </div>

      {error ? (
        <Notice tone="warning">
          <span className="whitespace-pre-line">{error}</span>
        </Notice>
      ) : null}
      {done ? <Notice>{done}</Notice> : null}

      {result ? (
        <>
          <ImportPreview preview={result.preview} fileSha256={result.fileSha256} fileName={result.fileName} />
          {importable > 0 && !blockedFile ? (
            <div className="flex flex-col gap-3 rounded-xl border p-4">
              <label className="flex items-start gap-3 text-sm">
                <Checkbox checked={confirmed} onCheckedChange={(v) => setConfirmed(v === true)} aria-label={t("gformImport.confirm")} />
                <span>{t("gformImport.confirm")}</span>
              </label>
              <Button className="self-start" disabled={!confirmed || busy !== null} onClick={() => void commit()}>
                {busy === "commit" ? t("gformImport.committing") : t("gformImport.commit", { n: importable })}
              </Button>
            </div>
          ) : (
            <Notice tone="locked">{t("gformImport.nothingToImport")}</Notice>
          )}
        </>
      ) : null}
    </div>
  );
}
