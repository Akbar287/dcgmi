import { indicatorPackage, type BriefIndicator } from "@/lib/fgd/component-brief";

import type { FieldDef, SectionDef } from "./types";

export const CONSENT_KEY = "consent";
export const CONSENT_YES = "Bersedia";
export const CONSENT_NO = "Tidak bersedia";
export const COMMENT_KEY = "komentar";

export interface DelphiFormItem extends BriefIndicator {
  domainCode: string;
  domainName: string;
  aspectCode: string;
  aspectName: string;
}

type NewField = Omit<FieldDef, "id">;
type NewSection = Omit<SectionDef, "id" | "fields"> & { fields: NewField[] };

const info = (key: string, label: string, helpText: string): NewField => ({ key, type: "INFO", label, helpText, required: false, options: [], config: null, branching: null });

/**
 * Human Delphi round form (SPECIFICATION §4.6): per item one relevance field
 * on the 4-point scale, with clarity rated separately (flag + note). The
 * relevance answer key is the indicator code, so responses map 1:1 to
 * DelphiRating rows. Thresholds and decision rules never appear.
 */
export function buildDelphiForm(input: { versionLabel: string; roundNumber: number; items: DelphiFormItem[]; feedback: boolean }): { title: string; purpose: string; instructions: string; sections: NewSection[] } {
  const title = `Delphi ronde ${input.roundNumber} — ${input.versionLabel}`;
  const instructions = [
    "Nilai relevansi setiap butir terhadap konstruk kematangan tata kelola kampus digital: 1 = tidak relevan, 2 = kurang relevan, 3 = relevan, 4 = sangat relevan.",
    "Kejelasan dinilai terpisah: tandai bila redaksi, definisi, rubrik, atau bukti membingungkan, dan beri catatan singkat.",
    "Jawaban Anda tidak ditampilkan kepada pakar lain; umpan balik antar-ronde hanya memuat skor pribadi Anda dan statistik kelompok tanpa identitas.",
    input.feedback ? "Pada ronde ini ditampilkan skor Anda dan statistik kelompok ronde sebelumnya. Anda boleh mempertahankan atau mengubah skor." : "",
  ]
    .filter(Boolean)
    .join("\n\n");
  const sections: NewSection[] = [
    {
      order: 0,
      title: "Pengantar",
      description: null,
      next: "NEXT",
      fields: [
        info("intro", title, instructions),
        { key: CONSENT_KEY, type: "SINGLE_CHOICE", label: "Apakah Anda bersedia mengisi ronde ini?", helpText: null, required: true, options: [CONSENT_YES, CONSENT_NO], config: null, branching: { [CONSENT_NO]: "SUBMIT" } },
      ],
    },
  ];
  const byDomain = new Map<string, DelphiFormItem[]>();
  for (const i of input.items) byDomain.set(i.domainCode, [...(byDomain.get(i.domainCode) ?? []), i]);
  let order = 1;
  for (const [code, items] of byDomain) {
    sections.push({
      order: order++,
      title: `${code} ${items[0].domainName}`,
      description: null,
      next: "NEXT",
      fields: items.flatMap((i) => [
        { key: i.code, type: "RELEVANCE_4" as const, label: `${i.code} — ${i.name}`, helpText: `Aspek ${i.aspectCode} ${i.aspectName}\n\n${indicatorPackage(i, true)}`, required: true, options: [], config: { clarity: true, indicatorCode: i.code }, branching: null },
      ]),
    });
  }
  sections.push({ order, title: "Penutup", description: null, next: "SUBMIT", fields: [{ key: COMMENT_KEY, type: "PARAGRAPH", label: "Komentar umum (opsional)", helpText: null, required: false, options: [], config: null, branching: null }] });
  return { title, purpose: `Penilaian relevansi dan kejelasan butir instrumen DCGMI, ronde ${input.roundNumber}.`, instructions, sections };
}

/** Relevance/clarity of one respondent for one indicator (null = not rated, never imputed). */
export function ratingFrom(answers: Record<string, string>, code: string): { relevance: number | null; clarityFlag: boolean; clarityNote: string | null } {
  if (answers[CONSENT_KEY] !== CONSENT_YES) return { relevance: null, clarityFlag: false, clarityNote: null };
  const r = Number(answers[code]);
  return {
    relevance: Number.isInteger(r) && r >= 1 && r <= 4 ? r : null,
    clarityFlag: answers[`${code}:clarity`] === "1",
    clarityNote: answers[`${code}:clarityNote`]?.trim() || null,
  };
}
