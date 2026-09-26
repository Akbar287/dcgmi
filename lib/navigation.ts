import {
  AiBrain01Icon,
  BalanceScaleIcon,
  ChartBarLineIcon,
  Comment01Icon,
  File01Icon,
  Layers01Icon,
  Settings01Icon,
  Shield01Icon,
  Target01Icon,
  UserGroupIcon,
  WorkflowSquare01Icon,
} from "@hugeicons/core-free-icons";

// Menu map from docs/06-UI-NAVIGATION.md §2. Slugs double as i18n keys under
// `nav.sections.<module>.<slug>`, so renaming one means renaming both.
export const NAV_MODULES = [
  {
    key: "artefak",
    icon: Layers01Icon,
    sections: ["versi", "domain", "aspek", "indikator", "rubrik", "bukti", "sdgs", "change-log", "bandingkan"],
  },
  { key: "forms", icon: File01Icon, sections: ["formulir", "builder", "pratinjau", "respons", "gform"] },
  { key: "experts", icon: UserGroupIcon, sections: ["registry", "cv", "persona", "coi", "identitas"] },
  { key: "panel", icon: AiBrain01Icon, sections: ["provider", "model", "konfigurasi", "kursi", "uji-koneksi"] },
  { key: "fgd", icon: Comment01Icon, sections: ["sesi", "agenda", "ruang", "keputusan", "revisi", "terapkan"] },
  { key: "delphi", icon: Target01Icon, sections: ["ronde", "matriks", "hasil", "ringkasan", "umpan-balik"] },
  { key: "ahp", icon: BalanceScaleIcon, sections: ["konfigurasi", "pairwise", "bobot", "sensitivitas", "dikembalikan"] },
  {
    key: "scoring",
    icon: ChartBarLineIcon,
    sections: ["asesmen", "bukti", "skor", "data-hilang", "profil", "kalkulator"],
  },
  { key: "runs", icon: WorkflowSquare01Icon, sections: ["daftar", "perancang", "monitor", "estimator"] },
  { key: "audit", icon: Shield01Icon, sections: ["aktivitas", "log-model", "ekspor", "reproduksi"] },
  {
    key: "settings",
    icon: Settings01Icon,
    sections: ["umum", "pengguna", "kunci-api", "ambang", "anggaran", "retensi", "basis-data"],
  },
] as const;

export type NavModule = (typeof NAV_MODULES)[number];
export type ModuleKey = NavModule["key"];
export type SectionSlug<M extends ModuleKey> = Extract<NavModule, { key: M }>["sections"][number];

export function moduleHref(module: ModuleKey, section?: string): string {
  return section ? `/${module}/${section}` : `/${module}`;
}

export function getModule<M extends ModuleKey>(key: M): Extract<NavModule, { key: M }> {
  const found = NAV_MODULES.find((m) => m.key === key);
  if (!found) throw new Error(`Unknown module: ${key}`);
  return found as Extract<NavModule, { key: M }>;
}

export function isSection<M extends ModuleKey>(module: M, slug: string): slug is SectionSlug<M> {
  return (getModule(module).sections as readonly string[]).includes(slug);
}
