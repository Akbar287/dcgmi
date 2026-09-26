import { sha256 } from "./hash";
import type { SourceData } from "./types";

const REQUIRED_TEXT = [
  "id",
  "domainCode",
  "domain",
  "aspectCode",
  "aspect",
  "indicator",
  "definition",
  "minimumEvidence",
  "strengtheningEvidence",
  "prompt",
  "qualitativeRule",
] as const;

/**
 * Port of validateSource_(). These counts describe the verified R1–V2.1.2B
 * snapshot itself (not tunable thresholds), so they live with the source.
 */
export function validateSource(data: SourceData, declaredSha256: string): string[] {
  const issues: string[] = [];
  if (sha256(JSON.stringify(data)) !== declaredSha256) {
    issues.push("Isi snapshot berubah. Gunakan skrip asli atau audit ulang versi sumber.");
    return issues;
  }
  if (data.items.length !== 43) issues.push("Harus tepat 43 indikator.");
  if (new Set(data.items.map((x) => x.id)).size !== 43) issues.push("ID indikator tidak unik.");
  if (new Set(data.items.map((x) => x.domainCode)).size !== 8) issues.push("Domain bukan 8.");
  if (new Set(data.items.map((x) => x.aspectCode)).size !== 15) issues.push("Aspek bukan 15.");
  if (data.options.decision.length !== 7 || data.options.evidence.length !== 4 || data.options.clarity.length !== 3) {
    issues.push("Daftar pilihan berubah.");
  }
  if (data.experts.length !== 6) issues.push("Panel produksi harus enam kode pakar.");
  for (const item of data.items) {
    for (const key of REQUIRED_TEXT) {
      const v = item[key];
      if (typeof v !== "string" || v.length === 0) issues.push(`Sumber kosong: ${item.id} / ${key}`);
    }
  }
  return issues;
}
