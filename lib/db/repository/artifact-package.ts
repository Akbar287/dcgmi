import type { Prisma } from "@/generated/prisma/client";
import type { AssessmentPackage, StoredIndicator } from "@/lib/instruments/assessment-package/types";
import { nameDifferences, validatePackage } from "@/lib/instruments/assessment-package/validate";
import { METHOD } from "@/lib/method/constants";

import { db } from "../client";
import { recordEvaluation } from "./gates";

export class PackageImportError extends Error {
  constructor(readonly issues: string[]) {
    super(`Paket penilaian ditolak:\n- ${issues.join("\n- ")}`);
    this.name = "PackageImportError";
  }
}

type Tx = Prisma.TransactionClient;

const EXCEPTION_DECISION =
  "Controlled exception (R1–V1.7 CH-08): isi paket diterapkan atas keputusan versi eksplisit peneliti 2026-09-26; kode, nama, dan posisi tidak berubah.";

function log(tx: Tx, entry: Omit<Prisma.ChangeLogEntryUncheckedCreateInput, "id" | "createdAt">) {
  return tx.changeLogEntry.create({ data: entry });
}

/**
 * Fills definitions, rubric 1–5, and evidence of an existing version from the
 * DRAF assessment package. Structure and names never change here (baseline
 * 8–15–43 changes only through FGD/Delphi). Every mutation writes its
 * ChangeLogEntry in the same transaction (AGENTS.md rule 5). Re-running the
 * same file is a no-op; a content-locked version is refused.
 */
export async function applyAssessmentPackage(input: {
  versionId: string;
  pkg: AssessmentPackage;
  sha256: string;
  fileName: string;
  actorId: string | null;
}) {
  const { versionId, pkg, sha256, fileName, actorId } = input;
  const prisma = await db();
  const decisionSource = `Paket penilaian ${pkg.meta.status} ${pkg.meta.label} — ${fileName} (sha256 ${sha256}); keputusan peneliti 2026-09-26`;

  const result = await prisma.$transaction(
    async (tx) => {
      const version = await tx.artifactVersion.findUniqueOrThrow({ where: { id: versionId } });
      if (version.status === "CONTENT_LOCKED") {
        throw new PackageImportError(["Versi sudah CONTENT_LOCKED; perubahan harus membuka ulang gate (§2.8.3), bukan lewat impor."]);
      }
      const already = await tx.changeLogEntry.count({ where: { versionId, decisionSource: { contains: sha256 } } });
      if (already > 0) return { status: "UNCHANGED" as const, changes: 0, names: [] as ReturnType<typeof nameDifferences> };

      const rows = await tx.indicator.findMany({
        where: { aspect: { domain: { versionId } } },
        include: {
          aspect: { include: { domain: true } },
          rubricLevels: { orderBy: { level: "asc" } },
          evidence: true,
        },
      });
      const stored: StoredIndicator[] = rows.map((r) => ({
        code: r.code,
        domainCode: r.aspect.domain.code,
        aspectCode: r.aspect.code,
        name: r.name,
        isControlledException: r.isControlledException,
        operationalDefinition: r.operationalDefinition,
        rubric: r.rubricLevels.map((l) => ({ level: l.level, label: l.label, descriptor: l.descriptor })),
        evidence: r.evidence.map((e) => ({ kind: e.kind, minimumFor: e.minimumFor, mandatory: e.mandatory, description: e.description })),
      }));
      const issues = validatePackage(pkg, stored);
      if (issues.length > 0) throw new PackageImportError(issues);

      let changes = 0;
      for (const p of pkg.indicators) {
        const row = rows.find((r) => r.code === p.code)!;
        const exception = METHOD.CONTROLLED_EXCEPTIONS.includes(p.code) ? ` ${EXCEPTION_DECISION}` : "";
        const base = { versionId, targetCode: p.code, decisionSource, actorId };

        await tx.indicator.update({
          where: { id: row.id },
          data: {
            operationalDefinition: p.operationalDefinition,
            assessmentObject: p.assessmentObject,
            boundaryNote: p.boundaryNote,
            sources: p.sources,
          },
        });
        await log(tx, {
          ...base,
          targetType: "Indicator",
          action: row.operationalDefinition ? "RUMUS_ULANG" : "TAMBAH",
          reason: row.operationalDefinition
            ? "Definisi operasional, objek penilaian, catatan batas, dan sumber diganti dengan versi paket."
            : "Definisi operasional, objek penilaian, catatan batas, dan sumber diisi dari paket.",
          impactNote: `Melengkapi paket penilaian untuk G1_BASELINE (§3.6.1).${row.operationalDefinition ? ` Definisi lama: ${row.operationalDefinition}` : ""}${exception}`,
        });

        const rubric = pkg.rubric.filter((r) => r.indicatorCode === p.code).sort((a, b) => a.level - b.level);
        for (const level of rubric) {
          await tx.rubricLevel.upsert({
            where: { indicatorId_level: { indicatorId: row.id, level: level.level } },
            create: { indicatorId: row.id, level: level.level, label: level.label, descriptor: level.descriptor, cumulative: p.cumulative },
            update: { label: level.label, descriptor: level.descriptor, cumulative: p.cumulative },
          });
        }
        await log(tx, {
          ...base,
          targetType: "RubricLevel",
          action: row.rubricLevels.length > 0 ? "RUMUS_ULANG" : "TAMBAH",
          reason: `Rubrik level 1–5 (${rubric.map((r) => r.label).join(", ")}) dari paket; status paket ${pkg.meta.status}, belum tervalidasi.`,
          impactNote: `${row.rubricLevels.length > 0 ? `Deskriptor lama: ${row.rubricLevels.map((l) => `${l.level}. ${l.descriptor}`).join(" | ")}` : "Indikator sebelumnya tanpa rubrik."}${exception}`,
        });

        // EvidenceRequirement has no soft delete; the removed text is preserved in the log.
        if (row.evidence.length > 0) {
          await tx.evidenceRequirement.deleteMany({ where: { indicatorId: row.id } });
          await log(tx, {
            ...base,
            targetType: "EvidenceRequirement",
            action: "HAPUS",
            reason: "Persyaratan bukti lama diganti seluruhnya oleh paket.",
            impactNote: row.evidence.map((e) => `[${e.kind}, L${e.minimumFor ?? "-"}, ${e.mandatory ? "wajib" : "penguat"}] ${e.description}`).join(" | "),
          });
        }
        const evidence = pkg.evidence.filter((e) => e.indicatorCode === p.code);
        await tx.evidenceRequirement.createMany({
          data: evidence.map((e) => ({ indicatorId: row.id, kind: e.kind, minimumFor: e.minimumFor, mandatory: e.mandatory, description: e.description })),
        });
        await log(tx, {
          ...base,
          targetType: "EvidenceRequirement",
          action: "TAMBAH",
          reason: `${evidence.length} persyaratan bukti (${evidence.filter((e) => e.mandatory).length} wajib) dari paket.`,
          impactNote: `Jenis: ${[...new Set(evidence.map((e) => e.kind))].join(", ")}.${exception}`,
        });
        changes++;
      }

      await tx.auditEvent.create({
        data: {
          actorId,
          actorKind: actorId ? "USER" : "SYSTEM",
          action: "ARTIFACT_PACKAGE_IMPORT",
          targetType: "ArtifactVersion",
          targetId: versionId,
          payload: { file: fileName, sha256, indicators: changes, status: pkg.meta.status },
        },
      });
      return { status: "APPLIED" as const, changes, names: nameDifferences(pkg, stored) };
    },
    { timeout: 120_000, maxWait: 10_000 },
  );

  const gate = await recordEvaluation(
    versionId,
    "G1_BASELINE",
    `Evaluasi otomatis setelah impor paket (sha256 ${sha256.slice(0, 12)}…). Menunggu keputusan Admin.`,
  );
  return { ...result, gate };
}
