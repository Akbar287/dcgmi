import { EVIDENCE_KINDS, type AssessmentPackage, type StoredIndicator } from "./types";

const LEVELS = [1, 2, 3, 4, 5];

/**
 * Structural checks before anything is written. Mirrors what G1 and the
 * rubric editor require (docs/06 §4: no twin descriptors, levels 1–5,
 * evidence kinds from §3.6.1). It does not judge content quality.
 */
export function validatePackage(pkg: AssessmentPackage, stored: StoredIndicator[]): string[] {
  const issues: string[] = [];
  const codes = pkg.indicators.map((i) => i.code);
  if (new Set(codes).size !== codes.length) issues.push("Kode indikator dalam paket tidak unik.");
  const known = new Set(stored.map((s) => s.code));
  for (const c of known) if (!codes.includes(c)) issues.push(`Indikator ${c} ada di artefak tetapi tidak ada di paket.`);

  for (const p of pkg.indicators) {
    const s = stored.find((x) => x.code === p.code);
    if (!s) {
      issues.push(`Indikator ${p.code} tidak ada di artefak; paket tidak boleh menambah struktur.`);
      continue;
    }
    if (s.domainCode !== p.domainCode || s.aspectCode !== p.aspectCode) {
      issues.push(`Posisi ${p.code} berbeda: artefak ${s.domainCode}/${s.aspectCode}, paket ${p.domainCode}/${p.aspectCode}.`);
    }
    if (s.isControlledException !== p.isControlledException) issues.push(`Status controlled exception ${p.code} berbeda.`);
    if (!p.operationalDefinition?.trim()) issues.push(`Definisi operasional ${p.code} kosong.`);

    const rubric = pkg.rubric.filter((r) => r.indicatorCode === p.code);
    const levels = rubric.map((r) => r.level).sort((a, b) => a - b);
    if (levels.join(",") !== LEVELS.join(",")) issues.push(`Rubrik ${p.code} harus tepat level 1–5 (ada: ${levels.join(",") || "-"}).`);
    if (rubric.some((r) => !r.descriptor?.trim() || !r.label?.trim())) issues.push(`Deskriptor/label rubrik ${p.code} kosong.`);
    if (new Set(rubric.map((r) => r.descriptor.trim())).size !== rubric.length) issues.push(`Deskriptor kembar pada ${p.code}.`);

    const evidence = pkg.evidence.filter((e) => e.indicatorCode === p.code);
    if (!evidence.some((e) => e.mandatory)) issues.push(`${p.code} tidak punya bukti wajib.`);
    for (const e of evidence) {
      if (!(EVIDENCE_KINDS as readonly string[]).includes(e.kind)) issues.push(`Jenis bukti tidak dikenal pada ${p.code}: ${e.kind}.`);
      if (!Number.isInteger(e.minimumFor) || e.minimumFor < 1 || e.minimumFor > 5) issues.push(`minimumFor ${p.code} di luar 1–5.`);
      if ((e.status === "WAJIB") !== e.mandatory) issues.push(`Status WAJIB/PENGUAT tidak cocok dengan mandatory pada ${p.code}.`);
      if (!e.description?.trim()) issues.push(`Deskripsi bukti ${p.code} kosong.`);
    }
  }
  for (const r of pkg.rubric) if (!codes.includes(r.indicatorCode)) issues.push(`Rubrik yatim: ${r.indicatorCode}.`);
  for (const e of pkg.evidence) if (!codes.includes(e.indicatorCode)) issues.push(`Bukti yatim: ${e.indicatorCode}.`);
  return issues;
}

/** Name differences are reported, never applied: baseline names are kept (researcher decision 2026-09-26). */
export function nameDifferences(pkg: AssessmentPackage, stored: StoredIndicator[]) {
  return pkg.indicators
    .map((p) => ({ code: p.code, stored: stored.find((s) => s.code === p.code)?.name ?? "", packaged: p.name }))
    .filter((d) => d.stored && d.stored !== d.packaged);
}
