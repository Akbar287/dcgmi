/**
 * Applies docs/DCGMI-Paket-Penilaian-43-Indikator.records.json to an artifact
 * version (default: DCGMI-A1.0). Safe to re-run: the same file is a no-op.
 * G1 is re-evaluated afterwards and left PENDING for an Admin to pass.
 *
 * Run: pnpm artifact:import-package [versionLabel]
 */
import "dotenv/config";

import { basename } from "node:path";

import { db } from "../lib/db/client";
import { applyAssessmentPackage } from "../lib/db/repository/artifact-package";
import { loadPackage } from "../lib/instruments/assessment-package/load";

async function main() {
  const label = process.argv[2] ?? "DCGMI-A1.0";
  const prisma = await db();
  const version = await prisma.artifactVersion.findUniqueOrThrow({ where: { label } });
  const { pkg, sha256, path } = loadPackage();
  console.log(`  Paket   : ${path} (${pkg.meta.status}, ${pkg.meta.generatedAt})`);
  console.log(`  SHA-256 : ${sha256}`);
  console.log(`  Versi   : ${label}`);
  const r = await applyAssessmentPackage({ versionId: version.id, pkg, sha256, fileName: basename(path), actorId: null });
  console.log(`  Hasil   : ${r.status}${r.status === "APPLIED" ? ` — ${r.changes} indikator diperbarui` : " — paket ini sudah pernah diterapkan"}`);
  if (r.names.length > 0) {
    console.log(`  Nama dipertahankan (${r.names.length} berbeda di paket):`);
    for (const n of r.names) console.log(`    ${n.code}: "${n.stored}" (paket: "${n.packaged}")`);
  }
  console.log(`  G1      : syarat ${r.gate.passed ? "TERPENUHI — menunggu Admin meluluskan di Dasbor" : `belum terpenuhi (${r.gate.unmet.length})`}`);
  if (r.gate.warnings.length) console.log(`  Peringatan: ${r.gate.warnings.join("; ")}`);
}

main()
  .then(() => process.exit(0))
  .catch((e) => {
    console.error(e instanceof Error ? e.message : e);
    process.exit(1);
  });
