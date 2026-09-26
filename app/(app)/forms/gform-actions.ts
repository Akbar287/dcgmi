"use server";

import { createHash } from "node:crypto";

import { revalidatePath } from "next/cache";

import { fail, type ActionResult } from "@/lib/action-result";
import { can } from "@/lib/auth/roles";
import { getCurrentUser } from "@/lib/auth/session";
import { commitGoogleImport, getExistingResponses, ImportConflictError } from "@/lib/db/repository/gform-import";
import { getVerifiedSnapshot } from "@/lib/db/repository/pre-review";
import { parseGoogleWorkbook } from "@/lib/instruments/pre-review/gform-import/parse-workbook";
import { buildPreview, type ImportPreview } from "@/lib/instruments/pre-review/gform-import/preview";

// Mirrors serverActions.bodySizeLimit in next.config.ts.
const MAX_BYTES = 5 * 1024 * 1024;

export interface PreviewResult {
  preview: ImportPreview;
  fileSha256: string;
  fileName: string;
}

async function analyze(formData: FormData) {
  const user = await getCurrentUser();
  if (!user || !can(user.role, "instrument:manage")) return { error: fail("FORBIDDEN", "instrument:manage") } as const;
  const file = formData.get("file");
  const formId = formData.get("formId");
  if (!(file instanceof File) || typeof formId !== "string" || !formId) return { error: fail("VALIDATION_ERROR", "file/formId") } as const;
  if (!file.name.toLowerCase().endsWith(".xlsx")) return { error: fail("VALIDATION_ERROR", "Hanya berkas .xlsx.") } as const;
  if (file.size === 0 || file.size > MAX_BYTES) return { error: fail("VALIDATION_ERROR", "Ukuran berkas harus 1 byte – 5 MB.") } as const;

  const { snapshot, issues } = await getVerifiedSnapshot(formId);
  if (!snapshot) return { error: fail("NOT_READY", issues.join("\n")) } as const;

  const buffer = await file.arrayBuffer();
  const fileSha256 = createHash("sha256").update(Buffer.from(buffer)).digest("hex");
  let parsed;
  try {
    parsed = await parseGoogleWorkbook(buffer, snapshot.plan.filter((p) => p.type !== "PAGE").map((p) => p.title));
  } catch {
    return { error: fail("VALIDATION_ERROR", "Berkas tidak dapat dibaca sebagai .xlsx.") } as const;
  }
  const built = buildPreview(parsed, snapshot, await getExistingResponses(formId));
  return { user, formId, snapshot, fileSha256, fileName: file.name, ...built } as const;
}

/** Step 1: read and show; nothing is written. */
export async function previewGoogleImportAction(formData: FormData): Promise<ActionResult<PreviewResult>> {
  const a = await analyze(formData);
  if ("error" in a) return a.error!;
  return { ok: true, data: { preview: a.preview, fileSha256: a.fileSha256, fileName: a.fileName } };
}

/** Step 2: the same file (checked by hash) is re-read and re-validated, then written in one transaction. */
export async function commitGoogleImportAction(formData: FormData): Promise<ActionResult<{ imported: number; declined: number }>> {
  const a = await analyze(formData);
  if ("error" in a) return a.error!;
  if (formData.get("expectedSha256") !== a.fileSha256) return fail("VALIDATION_ERROR", "Berkas berbeda dari yang dipratinjau. Buat pratinjau ulang.");
  if (formData.get("confirmed") !== "yes") return fail("VALIDATION_ERROR", "Konfirmasi pemeriksaan pratinjau diperlukan.");
  if (a.preview.fileIssues.length > 0) return fail("VALIDATION_ERROR", a.preview.fileIssues.join("\n"));
  const rows = a.rows.filter((r) => r.status === "READY" || r.status === "DECLINED");
  if (rows.length === 0) return fail("VALIDATION_ERROR", "Tidak ada baris yang siap diimpor.");
  try {
    const result = await commitGoogleImport({
      formId: a.formId,
      actorId: a.user.id,
      fileSha256: a.fileSha256,
      fileName: a.fileName,
      sheetName: a.preview.sheetName,
      signature: a.snapshot.signature,
      rows,
    });
    revalidatePath("/forms", "layout");
    return { ok: true, data: result };
  } catch (error) {
    if (error instanceof ImportConflictError) return fail("CONFLICT", error.message, error.codes);
    throw error;
  }
}
