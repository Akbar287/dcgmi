import type { StageKey } from "./agenda";

// Material the facilitator presents. Texts for instrument-level stages restate
// SPECIFICATION §4.5/§4.8 so seats judge the actual design, never a result:
// no example scores, CVI values, or weights appear here (docs/09 §1.7).

export interface BriefIndicator {
  code: string;
  name: string;
  isControlledException: boolean;
  operationalDefinition: string | null;
  assessmentObject: string | null;
  boundaryNote: string | null;
  rubric: { level: number; label: string; descriptor: string }[];
  evidence: { kind: string; minimumFor: number | null; mandatory: boolean; description: string }[];
}

export interface BriefDomain {
  code: string;
  name: string;
  rationale: string | null;
  aspects: { code: string; name: string; rationale: string | null; indicators: BriefIndicator[] }[];
}

const INSTRUMENT_TOPICS: Partial<Record<StageKey, string>> = {
  PEMBUKAAN:
    "Tujuan DCGMI: indeks kematangan tata kelola kampus digital untuk perguruan tinggi Indonesia. Objek diskusi adalah kualitas instrumen, bukan kondisi kampus tertentu.",
  VALIDASI_MASALAH:
    "Apakah masalah yang hendak diukur — kematangan tata kelola kampus digital — dirumuskan dengan jelas, relevan bagi perguruan tinggi Indonesia, dan layak diukur dengan indeks bertingkat?",
  FORMULA:
    "Skor aspek A(i,j) = rata-rata level indikator r(i,j,k) pada skala 1–5; skor domain D(i) = Σ w(j|i)·A(i,j); skor total DCGMI = Σ w(i)·D(i). Aspek tunggal dalam domain berbobot lokal 1. Data hilang dibedakan: tidak ada kapabilitas vs missing administratif; tanpa imputasi rerata.",
  PEMBOBOTAN:
    "Bobot antar-domain dan antar-aspek ditetapkan dengan AHP (skala Saaty 1–9, agregasi rata-rata geometris antarpakar). Indikator diperlakukan setara kecuali ada justifikasi terpisah. Matriks yang tidak konsisten dikembalikan ke pakar, tidak diperbaiki otomatis.",
  INTERPRETASI:
    "Keluaran utama adalah profil 8 domain; skor komposit hanya ringkasan sekunder berstatus provisional dan tidak disajikan sendirian.",
  KONTEKS_INDONESIA:
    "Kesesuaian instrumen dengan konteks Indonesia: akreditasi, SPBE, pelindungan data pribadi, serta keragaman PTN/PTS dan kapasitas kelembagaan.",
  PRIORITAS_REVISI:
    "Dari seluruh pembahasan, komponen mana yang paling perlu direvisi sebelum Delphi, dan mengapa?",
};

function structureSummary(domains: BriefDomain[]): string {
  const aspects = domains.flatMap((d) => d.aspects);
  const indicators = aspects.flatMap((a) => a.indicators);
  return `${domains.length} domain, ${aspects.length} aspek, ${indicators.length} indikator: ${domains.map((d) => `${d.code} ${d.name}`).join("; ")}.`;
}

export function indicatorPackage(i: BriefIndicator, withRubric: boolean): string {
  const lines = [
    `Indikator ${i.code} — ${i.name}${i.isControlledException ? " (controlled exception CH-08)" : ""}`,
    `Definisi operasional: ${i.operationalDefinition ?? "belum ada"}`,
    `Objek penilaian: ${i.assessmentObject ?? "belum ada"}`,
    `Catatan batas: ${i.boundaryNote ?? "belum ada"}`,
    `Bukti: ${i.evidence.length ? i.evidence.map((e) => `[${e.kind}, level ${e.minimumFor ?? "-"}, ${e.mandatory ? "wajib" : "penguat"}] ${e.description}`).join("; ") : "belum ada"}`,
  ];
  if (withRubric) {
    lines.push("Rubrik:");
    for (const r of [...i.rubric].sort((a, b) => a.level - b.level)) lines.push(`  ${r.level}. ${r.label}: ${r.descriptor}`);
    if (i.rubric.length === 0) lines.push("  belum ada");
  }
  return lines.join("\n");
}

/** The component under discussion, as plain text for the facilitator. */
export function componentBrief(stage: StageKey, targetType: string, targetCode: string, domains: BriefDomain[]): string {
  if (targetType === "INSTRUMENT") return `${INSTRUMENT_TOPICS[stage] ?? ""}\nStruktur yang dinilai: ${structureSummary(domains)}`;
  if (targetType === "DOMAIN") {
    const d = domains.find((x) => x.code === targetCode);
    if (!d) return `Domain ${targetCode} tidak ditemukan.`;
    return [`Domain ${d.code} — ${d.name}`, `Rasional: ${d.rationale ?? "belum ada"}`, `Aspek: ${d.aspects.map((a) => `${a.code} ${a.name} (${a.indicators.length} indikator)`).join("; ")}`].join("\n");
  }
  for (const d of domains) {
    for (const a of d.aspects) {
      if (targetType === "ASPECT" && a.code === targetCode) {
        return [`Aspek ${a.code} — ${a.name} (domain ${d.code} ${d.name})`, `Rasional: ${a.rationale ?? "belum ada"}`, `Indikator: ${a.indicators.map((i) => `${i.code} ${i.name}`).join("; ")}`].join("\n");
      }
      const i = a.indicators.find((x) => x.code === targetCode);
      if (i && (targetType === "INDICATOR" || targetType === "RUBRIC")) {
        return `Domain ${d.code} ${d.name} › Aspek ${a.code} ${a.name}\n${indicatorPackage(i, targetType === "RUBRIC")}`;
      }
    }
  }
  return `Komponen ${targetType} ${targetCode} tidak ditemukan.`;
}

export function artifactSummary(domains: BriefDomain[]): string {
  return structureSummary(domains);
}
