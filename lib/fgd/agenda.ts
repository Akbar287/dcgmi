// Agenda corong 11 tahap — R1-V1.7 §3.7.2 (SPECIFICATION §4.5). Stages on the
// four structure levels are discussed per component; the rest once for the
// whole instrument.

export type StageScope = "INSTRUMENT" | "DOMAIN" | "ASPECT" | "INDICATOR" | "RUBRIC";

export const AGENDA_CORONG_11 = [
  { key: "PEMBUKAAN", title: "Pembukaan", scope: "INSTRUMENT" },
  { key: "VALIDASI_MASALAH", title: "Validasi masalah", scope: "INSTRUMENT" },
  { key: "STRUKTUR_DOMAIN", title: "Struktur domain", scope: "DOMAIN" },
  { key: "STRUKTUR_ASPEK", title: "Struktur aspek", scope: "ASPECT" },
  { key: "INDIKATOR", title: "Indikator", scope: "INDICATOR" },
  { key: "RUBRIK", title: "Rubrik", scope: "RUBRIC" },
  { key: "FORMULA", title: "Formula", scope: "INSTRUMENT" },
  { key: "PEMBOBOTAN", title: "Pembobotan", scope: "INSTRUMENT" },
  { key: "INTERPRETASI", title: "Interpretasi", scope: "INSTRUMENT" },
  { key: "KONTEKS_INDONESIA", title: "Konteks Indonesia", scope: "INSTRUMENT" },
  { key: "PRIORITAS_REVISI", title: "Prioritas revisi", scope: "INSTRUMENT" },
] as const satisfies readonly { key: string; title: string; scope: StageScope }[];

export type StageKey = (typeof AGENDA_CORONG_11)[number]["key"];

export interface AgendaDomain {
  code: string;
  name: string;
  aspects: { code: string; name: string; indicators: { code: string; name: string }[] }[];
}

export interface PlannedItem {
  targetType: "INSTRUMENT" | "DOMAIN" | "ASPECT" | "INDICATOR" | "RUBRIC";
  targetCode: string;
  title: string;
}

export interface PlannedStage {
  key: StageKey;
  title: string;
  items: PlannedItem[];
}

export interface AgendaSelection {
  stages: StageKey[];
  /** Empty = all domains. Only narrows the four per-component stages. */
  domains: string[];
}

export function buildAgendaPlan(domains: AgendaDomain[], selection: AgendaSelection): PlannedStage[] {
  const wanted = new Set(selection.stages);
  const inScope = selection.domains.length ? domains.filter((d) => selection.domains.includes(d.code)) : domains;
  return AGENDA_CORONG_11.filter((s) => wanted.has(s.key)).map((s) => {
    let items: PlannedItem[];
    switch (s.scope) {
      case "DOMAIN":
        items = inScope.map((d) => ({ targetType: "DOMAIN", targetCode: d.code, title: `${d.code} — ${d.name}` }));
        break;
      case "ASPECT":
        items = inScope.flatMap((d) => d.aspects.map((a) => ({ targetType: "ASPECT" as const, targetCode: a.code, title: `${a.code} — ${a.name}` })));
        break;
      case "INDICATOR":
      case "RUBRIC":
        items = inScope.flatMap((d) =>
          d.aspects.flatMap((a) =>
            a.indicators.map((i) => ({ targetType: s.scope, targetCode: i.code, title: `${i.code} — ${i.name}` }) as PlannedItem),
          ),
        );
        break;
      default:
        items = [{ targetType: "INSTRUMENT", targetCode: s.key, title: s.title }];
    }
    return { key: s.key, title: s.title, items };
  });
}

/**
 * docs/04 §9 cost estimate in calls: per component one facilitator
 * presentation, one argument per seat, cross-talk rounds, one vote per seat,
 * and one notetaker extraction.
 */
export function estimateCalls(plan: PlannedStage[], seats: number, crossTalkRounds: number): { components: number; calls: number } {
  const components = plan.reduce((n, s) => n + s.items.length, 0);
  return { components, calls: components * (1 + seats + seats * crossTalkRounds + seats + 1) };
}

/** Deterministic shuffle (mulberry32) so the speaking order is reproducible from the session seed. */
export function seededShuffle<T>(items: T[], seed: number): T[] {
  let a = seed >>> 0;
  const rand = () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
  const out = items.slice();
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1));
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}

/** Stable 32-bit hash of a string, used to derive per-component seeds. */
export function hash32(text: string): number {
  let h = 2166136261;
  for (let i = 0; i < text.length; i++) h = Math.imul(h ^ text.charCodeAt(i), 16777619);
  return h >>> 0;
}
