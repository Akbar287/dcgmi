import type { Prisma } from "@/generated/prisma/client";
import type { ExistingResponses, RowWithAnswers } from "@/lib/instruments/pre-review/gform-import/preview";

import { db } from "../client";

type Tx = Prisma.TransactionClient;

export const GOOGLE_FORM_SOURCE = "GOOGLE_FORM";

function meta(value: Prisma.JsonValue | null): Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value) ? (value as Record<string, unknown>) : {};
}

async function readExisting(tx: Tx, formId: string): Promise<ExistingResponses> {
  const responses = await tx.formResponse.findMany({ where: { formId }, select: { respondentRef: true, completed: true, meta: true } });
  const byCode: ExistingResponses["byCode"] = new Map();
  const importedKeys = new Set<string>();
  for (const r of responses) {
    const m = meta(r.meta);
    const sourceKey = typeof m.sourceKey === "string" ? m.sourceKey : null;
    if (sourceKey && m.source === GOOGLE_FORM_SOURCE) importedKeys.add(sourceKey);
    if (r.respondentRef) byCode.set(r.respondentRef, { completed: r.completed, sourceKey });
  }
  return { byCode, importedKeys };
}

export async function getExistingResponses(formId: string): Promise<ExistingResponses> {
  const prisma = await db();
  return readExisting(prisma, formId);
}

export class ImportConflictError extends Error {
  constructor(readonly codes: string[]) {
    super(`Data berubah sejak pratinjau: ${codes.join(", ")}. Buat pratinjau ulang.`);
    this.name = "ImportConflictError";
  }
}

/**
 * Writes the previewed READY and DECLINED rows. Conflicts are re-checked inside
 * the transaction (a pakar may have submitted in the app since the preview);
 * any change aborts the whole import rather than importing part of it.
 * Google Form input is human expert data, so every row is REAL (docs/07 P3).
 */
export async function commitGoogleImport(input: {
  formId: string;
  actorId: string;
  fileSha256: string;
  fileName: string;
  sheetName: string | null;
  signature: string;
  rows: RowWithAnswers[];
}) {
  const prisma = await db();
  return prisma.$transaction(
    async (tx) => {
      const existing = await readExisting(tx, input.formId);
      const conflicts = input.rows
        .filter((r) => existing.importedKeys.has(r.sourceKey) || (r.status === "READY" && existing.byCode.has(r.code)))
        .map((r) => r.code || `baris ${r.rowNumber}`);
      if (conflicts.length > 0) throw new ImportConflictError(conflicts);

      const importedAt = new Date().toISOString();
      for (const r of input.rows) {
        const provenance = {
          source: GOOGLE_FORM_SOURCE,
          sourceKey: r.sourceKey,
          fileSha256: input.fileSha256,
          fileName: input.fileName,
          sheet: input.sheetName,
          row: r.rowNumber,
          importedAt,
          importedBy: input.actorId,
          signature: input.signature,
          qcIssues: r.qc.length,
        };
        await tx.formResponse.create({
          data: {
            formId: input.formId,
            // A refusal keeps no code: only the choice and the time (consent text).
            respondentRef: r.status === "READY" ? r.code : null,
            dataOrigin: "REAL",
            answers: r.answers,
            completed: true,
            submittedAt: r.submittedAt,
            meta: provenance,
          },
        });
      }
      const imported = input.rows.filter((r) => r.status === "READY").length;
      const declined = input.rows.length - imported;
      await tx.auditEvent.create({
        data: {
          actorId: input.actorId,
          actorKind: "USER",
          action: "FORM_IMPORT_GOOGLE",
          targetType: "Form",
          targetId: input.formId,
          payload: { fileName: input.fileName, fileSha256: input.fileSha256, sheet: input.sheetName, imported, declined, codes: input.rows.filter((r) => r.status === "READY").map((r) => r.code) },
        },
      });
      return { imported, declined };
    },
    { timeout: 60_000 },
  );
}
