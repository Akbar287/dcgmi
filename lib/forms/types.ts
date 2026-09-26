// Generic form model (SPECIFICATION §4.2). Rows in Form/FormSection/FormField
// are the source of truth for GENERIC and DELPHI forms (the pre-review form
// keeps its verified snapshot). Answers are a flat Record<string, string>.

export const FIELD_TYPES = ["SHORT_TEXT", "PARAGRAPH", "SINGLE_CHOICE", "MULTI_CHOICE", "DROPDOWN", "LINEAR_SCALE", "RELEVANCE_4", "PAIRWISE", "DATE", "INFO"] as const;
export type FieldType = (typeof FIELD_TYPES)[number];

export const CHOICE_TYPES: FieldType[] = ["SINGLE_CHOICE", "MULTI_CHOICE", "DROPDOWN"];
/** Types whose single answer can drive a section jump. */
export const BRANCHING_TYPES: FieldType[] = ["SINGLE_CHOICE", "DROPDOWN"];

export interface ScaleConfig {
  min: number;
  max: number;
  minLabel?: string;
  maxLabel?: string;
}

export interface PairwiseConfig {
  elements: { code: string; label: string }[];
}

export interface RelevanceConfig {
  /** Adds the separate clarity flag + note (docs/04 §7: relevance and clarity apart). */
  clarity: boolean;
  indicatorCode?: string;
}

export interface FieldDef {
  id: string;
  key: string;
  type: FieldType;
  label: string;
  helpText: string | null;
  required: boolean;
  options: string[];
  config: Partial<ScaleConfig & PairwiseConfig & RelevanceConfig> | null;
  /** SINGLE_CHOICE/DROPDOWN: option → target section order, or "SUBMIT". */
  branching: Record<string, number | "SUBMIT"> | null;
}

export interface SectionDef {
  id: string;
  order: number;
  title: string;
  description: string | null;
  /** Default after this section: next section, a section order, or SUBMIT. */
  next: "NEXT" | "SUBMIT" | number;
  fields: FieldDef[];
}

export interface FormDef {
  id: string;
  slug: string;
  title: string;
  purpose: string;
  instructions: string | null;
  sections: SectionDef[];
}

export type Answers = Record<string, string>;

export const TEXT_MAX = { SHORT_TEXT: 300, PARAGRAPH: 5000 } as const;
export const SAATY = [1, 2, 3, 4, 5, 6, 7, 8, 9] as const;

/** Answer keys a field writes (a pairwise field writes one per pair; relevance adds clarity keys). */
export function answerKeys(f: FieldDef): string[] {
  if (f.type === "INFO") return [];
  if (f.type === "PAIRWISE") {
    const n = f.config?.elements?.length ?? 0;
    const keys: string[] = [];
    for (let i = 0; i < n; i++) for (let j = i + 1; j < n; j++) keys.push(`${f.key}:${i}-${j}`);
    return keys;
  }
  if (f.type === "RELEVANCE_4" && f.config?.clarity) return [f.key, `${f.key}:clarity`, `${f.key}:clarityNote`];
  return [f.key];
}
