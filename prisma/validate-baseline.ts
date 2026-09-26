/** Pemeriksaan struktur baseline sebelum seed menyentuh basis data. */
import { METHOD } from "../lib/method/constants";
import { BASELINE_A1_0 } from "./baseline/dcgmi-a1-0";

export function validateBaseline(): {
  ok: boolean;
  issues: string[];
  summary: string;
} {
  const issues: string[] = [];
  const aspects = BASELINE_A1_0.flatMap((d) => d.aspects);
  const indicators = aspects.flatMap((a) => a.indicators);

  if (BASELINE_A1_0.length !== METHOD.BASELINE_DOMAIN_COUNT) {
    issues.push(
      `Jumlah domain ${BASELINE_A1_0.length}, seharusnya ${METHOD.BASELINE_DOMAIN_COUNT}`,
    );
  }
  if (aspects.length !== METHOD.BASELINE_ASPECT_COUNT) {
    issues.push(
      `Jumlah aspek ${aspects.length}, seharusnya ${METHOD.BASELINE_ASPECT_COUNT}`,
    );
  }
  if (indicators.length !== METHOD.BASELINE_INDICATOR_COUNT) {
    issues.push(
      `Jumlah indikator ${indicators.length}, seharusnya ${METHOD.BASELINE_INDICATOR_COUNT}`,
    );
  }

  const distribution = BASELINE_A1_0.map((d) =>
    d.aspects.reduce((n, a) => n + a.indicators.length, 0),
  );
  if (distribution.join(",") !== METHOD.BASELINE_DISTRIBUTION.join(",")) {
    issues.push(
      `Distribusi ${distribution.join("-")}, seharusnya ${METHOD.BASELINE_DISTRIBUTION.join("-")}`,
    );
  }

  const codes = indicators.map((i) => i.code);
  const dup = codes.filter((c, i) => codes.indexOf(c) !== i);
  if (dup.length > 0)
    issues.push(`Kode indikator ganda: ${[...new Set(dup)].join(", ")}`);

  // C01..C42 harus lengkap, plus C20b sebagai tambahan.
  for (let n = 1; n <= 42; n++) {
    const code = `C${String(n).padStart(2, "0")}`;
    if (!codes.includes(code)) issues.push(`Kode hilang: ${code}`);
  }
  for (const code of METHOD.CONTROLLED_EXCEPTIONS) {
    const ind = indicators.find((i) => i.code === code);
    if (!ind) issues.push(`Controlled exception hilang: ${code}`);
    else if (!ind.isControlledException)
      issues.push(`${code} tidak ditandai isControlledException`);
  }

  const aspectCodes = aspects.map((a) => a.code);
  for (let n = 1; n <= 15; n++) {
    const code = `A${String(n).padStart(2, "0")}`;
    if (!aspectCodes.includes(code)) issues.push(`Kode aspek hilang: ${code}`);
  }

  return {
    ok: issues.length === 0,
    issues,
    summary: `${BASELINE_A1_0.length} domain, ${aspects.length} aspek, ${indicators.length} indikator (${distribution.join("-")})`,
  };
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const r = validateBaseline();
  console.log(`  ${r.summary}`);
  if (!r.ok) {
    for (const i of r.issues) console.error(`  x ${i}`);
    process.exit(1);
  }
  console.log("  OK — baseline DCGMI-A1.0 konsisten.");
}
