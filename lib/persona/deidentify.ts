import type { PersonaBriefInput } from "./schema";

export type DeidRule =
  | "IDENTITY"
  | "ACADEMIC_TITLE"
  | "EMAIL"
  | "URL"
  | "PHONE"
  | "LONG_NUMBER"
  | "NAMED_INSTITUTION"
  | "INSTITUTION_ACRONYM"
  | "PLACE"
  | "QUOTED_TITLE";

export interface DeidFinding {
  field: keyof PersonaBriefInput;
  rule: DeidRule;
  match: string;
}

/**
 * Rule-based filter for docs/04 §4.3 (no names, titles, institutions, cities,
 * publication titles, numbers, addresses). It is a conservative heuristic, not
 * NER: it blocks approval on any hit and the researcher still reviews the text.
 * `identity` carries the real names/affiliations to refuse; it stays server-side.
 */
const PATTERNS: { rule: DeidRule; re: RegExp }[] = [
  { rule: "EMAIL", re: /[\w.+-]+@[\w-]+\.[\w.-]+/g },
  { rule: "URL", re: /\b(?:https?:\/\/|www\.)\S+/gi },
  { rule: "PHONE", re: /(?:\+62|\b0)8\d{7,11}\b/g },
  { rule: "LONG_NUMBER", re: /\b\d{6,}\b/g },
  {
    rule: "ACADEMIC_TITLE",
    re: /\b(?:Prof|Dr|Drs|Dra|Ir|Hj?)\.(?=\s|$)|\b(?:S|M)\.(?:Kom|T|Si|Sc|Sis|Pd|E|H|Ak|M|Eng|Cs)\b\.?|\bPh\.?D\b|\bMBA\b|\bIPU\b|\bASEAN\.?Eng\b/g,
  },
  {
    rule: "NAMED_INSTITUTION",
    re: /\b(?:Universitas|Institut|Politeknik|Sekolah Tinggi|Akademi|Kementerian|Badan|Dinas|Pemerintah (?:Kota|Kabupaten|Provinsi)|PT\.?)\s+\p{Lu}[\p{L}.-]*/gu,
  },
  {
    rule: "INSTITUTION_ACRONYM",
    re: /\b(?:UI|ITB|UGM|IPB|ITS|UNAIR|UNPAD|UNDIP|UB|UNY|UPI|UNS|UNHAS|USU|UNAND|UNSRI|UNUD|BINUS|UIN|UII|UMY|UMS|UMM|TELKOM|UNJ|UNESA|UNNES|UNIMED|UNP|UNM|UNSYIAH|USK)\b/g,
  },
  {
    rule: "PLACE",
    re: /\b(?:Jakarta|Bandung|Surabaya|Yogyakarta|Jogja|Semarang|Medan|Makassar|Malang|Depok|Bogor|Tangerang|Bekasi|Palembang|Padang|Pekanbaru|Denpasar|Banda Aceh|Pontianak|Manado|Balikpapan|Samarinda|Banjarmasin|Mataram|Kupang|Jayapura|Ambon|Surakarta|Solo|Cirebon|Purwokerto|Jember|Lampung|Batam|Jambi|Bengkulu|Palu|Kendari|Gorontalo|Ternate|Sorong|Salatiga|Tasikmalaya|Serang|Cilegon|Sukabumi|Kediri|Madiun|Magelang|Pekalongan|Tegal)\b/gi,
  },
  { rule: "QUOTED_TITLE", re: /["“][^"”]{20,}["”]/g },
];

function texts(brief: PersonaBriefInput): [keyof PersonaBriefInput, string][] {
  return [
    ...brief.expertiseAreas.map((v) => ["expertiseAreas", v] as [keyof PersonaBriefInput, string]),
    ...brief.researchFocus.map((v) => ["researchFocus", v] as [keyof PersonaBriefInput, string]),
    ...brief.vocabularyHints.map((v) => ["vocabularyHints", v] as [keyof PersonaBriefInput, string]),
    ["methodStance", brief.methodStance],
    ["emphasisBias", brief.emphasisBias],
  ];
}

function identityTerms(identity: string[]): string[] {
  const terms = new Set<string>();
  for (const raw of identity) {
    const value = raw.trim();
    if (value.length < 3) continue;
    terms.add(value.toLowerCase());
    // "Universitas Contoh Raya" is also refused as "Contoh Raya".
    const bare = value.replace(/^(?:Universitas|Institut|Politeknik|Sekolah Tinggi|Akademi|Kementerian|Badan|Dinas|PT\.?)\s+/i, "");
    if (bare !== value && bare.length >= 3) terms.add(bare.toLowerCase());
    // Individual name parts too, so "Putra" alone is caught; short particles are skipped.
    for (const part of value.split(/[\s,.;()]+/)) if (part.length >= 4) terms.add(part.toLowerCase());
  }
  return [...terms];
}

export function findIdentifiers(brief: PersonaBriefInput, identity: string[] = []): DeidFinding[] {
  const findings: DeidFinding[] = [];
  const terms = identityTerms(identity);
  for (const [field, value] of texts(brief)) {
    if (!value) continue;
    for (const { rule, re } of PATTERNS) {
      for (const m of value.matchAll(re)) findings.push({ field, rule, match: m[0] });
    }
    const lower = value.toLowerCase();
    for (const term of terms) {
      const i = lower.indexOf(term);
      if (i >= 0 && (term.includes(" ") || new RegExp(`(^|[^\\p{L}])${term.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}($|[^\\p{L}])`, "u").test(lower))) {
        findings.push({ field, rule: "IDENTITY", match: value.slice(i, i + term.length) });
      }
    }
  }
  const seen = new Set<string>();
  return findings.filter((f) => {
    const k = `${f.field}|${f.rule}|${f.match.toLowerCase()}`;
    return seen.has(k) ? false : (seen.add(k), true);
  });
}
