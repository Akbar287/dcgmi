/**
 * Imports the R1–V2.1.2B expert pre-review form from the researcher's Apps
 * Script (docs/R1-V2.1.2B-form-builder.gs). Safe to re-run: an identical build
 * is a no-op, a changed one is refused. The form starts in HOLD; only an Admin
 * opens it from Instrumen → Formulir after the readiness checks pass.
 *
 * Run: pnpm instrument:import [slug]
 */
import "dotenv/config";

import { importPreReviewForm } from "../lib/db/repository/pre-review";
import { loadBuilderScript } from "../lib/instruments/pre-review/load-builder-script";

const DEFAULT_SLUG = "pra-reviu-r1-v212b";

async function main() {
  const slug = process.argv[2] ?? DEFAULT_SLUG;
  const snapshot = loadBuilderScript();
  const plan = snapshot.plan;
  console.log(`  Sumber   : ${snapshot.source.questions.file}`);
  console.log(`  Data     : ${snapshot.dataSha256}`);
  console.log(`  Signature: ${snapshot.signature}`);
  console.log(`  Item     : ${plan.length} (${plan.filter((p) => p.type !== "PAGE").length} pertanyaan)`);
  const result = await importPreReviewForm(snapshot, slug);
  console.log(`  ${slug}: ${result === "CREATED" ? "dibuat dengan status HOLD" : "sudah ada dan identik — tidak diubah"}`);
}

main()
  .then(() => process.exit(0))
  .catch((e) => {
    console.error(e instanceof Error ? e.message : e);
    process.exit(1);
  });
