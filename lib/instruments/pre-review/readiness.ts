import type { BuilderConfig } from "./types";

function configured(value: unknown): boolean {
  return typeof value === "string" && value.trim().length > 0 && !value.includes("[ISI");
}

/**
 * Port of productionReadiness_() without the Google TEST form state: the
 * researcher chose PRODUCTION only, with the Google dry-run recorded in
 * TEST_EVIDENCE_NOTE. Content verification is checked separately.
 */
export function productionReadiness(config: BuilderConfig): string[] {
  const issues: string[] = [];
  if (config.GOOGLE_FORM_TEST_PASSED !== true) {
    issues.push("GOOGLE_FORM_TEST_PASSED masih false. Selesaikan dry-run pada Google Form TEST, lalu ubah menjadi true.");
  }
  if (!configured(config.TEST_EVIDENCE_NOTE)) {
    issues.push("TEST_EVIDENCE_NOTE belum diisi. Isi tanggal, penguji, hasil dry-run, dan durasi.");
  }
  if (!configured(config.CONTACT) || !configured(config.DATA_POLICY)) {
    issues.push("CONTACT atau DATA_POLICY belum lengkap.");
  }
  if (!/^https:\/\//.test(config.SUMMARY_URL)) {
    issues.push("SUMMARY_URL belum berupa URL HTTPS yang dapat diakses pakar.");
  }
  if (config.LIMITED_REVIEW_SCOPE_ACKNOWLEDGED !== true) {
    issues.push(
      "LIMITED_REVIEW_SCOPE_ACKNOWLEDGED masih false. Ubah menjadi true setelah menyetujui bahwa rubrik/deskriptor level 1–5 belum termasuk dalam sumber.",
    );
  }
  return issues;
}
