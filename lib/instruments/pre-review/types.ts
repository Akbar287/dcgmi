// Shapes mirror the R1–V2.1.2B Apps Script (docs/R1-V2.1.2B-form-builder.gs)
// exactly, including key order, because build signatures hash JSON text.

export type PlanItemType = "MC" | "PARA" | "PAGE";

export interface PlanItem {
  type: PlanItemType;
  key: string;
  title: string;
  help: string;
  required: boolean;
  choices: string[];
  consent?: true;
  canonicalId?: string;
  field?: FieldKey;
  excelColumn?: string;
}

export type FieldKey = "decision" | "evidence" | "clarity" | "overlap" | "comment" | "revision";

export interface SourceItem {
  no: number;
  id: string;
  domainCode: string;
  domain: string;
  aspectCode: string;
  aspect: string;
  indicator: string;
  definition: string;
  minimumEvidence: string;
  strengtheningEvidence: string;
  priority: string;
  prompt: string;
  qualitativeRule: string;
}

export interface SourceData {
  items: SourceItem[];
  options: { decision: string[]; evidence: string[]; clarity: string[]; overlap: string[] };
  experts: string[];
  dataHeaders: string[];
}

export interface BuilderConfig {
  CONTACT: string;
  DATA_POLICY: string;
  SUMMARY_URL: string;
  GOOGLE_FORM_TEST_PASSED: boolean;
  TEST_EVIDENCE_NOTE: string;
  LIMITED_REVIEW_SCOPE_ACKNOWLEDGED: boolean;
}

export interface SourceFiles {
  questions: { file: string; libraryId: string; version: number; sha256: string };
  fgd: { file: string; libraryId: string; version: number; sha256: string };
}

/** Everything the app keeps from one verified build, stored as exact JSON text. */
export interface PreReviewSnapshot {
  kind: "PRE_REVIEW";
  builderVersion: string;
  mode: "PRODUCTION";
  title: string;
  description: string;
  confirmationMessage: string;
  config: BuilderConfig;
  source: SourceFiles;
  dataSha256: string;
  data: SourceData;
  plan: PlanItem[];
  signature: string;
}

/** Stored in `Form.settings` (JSONB). The snapshot stays a string so hashes survive JSONB key reordering. */
export interface PreReviewFormSettings {
  kind: "PRE_REVIEW";
  signature: string;
  snapshot: string;
}

export type Answers = Record<string, string>;
