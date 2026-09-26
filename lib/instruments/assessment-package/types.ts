// Shape of docs/DCGMI-Paket-Penilaian-43-Indikator.records.json (DRAF A1.0 package).

export const EVIDENCE_KINDS = ["NORMATIF", "IMPLEMENTASI", "OPERASIONAL", "HASIL", "PERBAIKAN"] as const;
export type EvidenceKind = (typeof EVIDENCE_KINDS)[number];

export interface PackageIndicator {
  domainCode: string;
  domainName: string;
  aspectCode: string;
  aspectName: string;
  code: string;
  name: string;
  operationalDefinition: string;
  assessmentObject: string;
  boundaryNote: string;
  sources: string[];
  sourceMappingStatus: string;
  cumulative: boolean;
  isControlledException: boolean;
  exceptionNote: string | null;
  sdgTags: string[];
  slrStrings: string[];
}

export interface PackageRubricLevel {
  domainCode: string;
  aspectCode: string;
  indicatorCode: string;
  indicatorName: string;
  level: number;
  label: string;
  descriptor: string;
}

export interface PackageEvidence {
  domainCode: string;
  indicatorCode: string;
  indicatorName: string;
  minimumFor: number;
  kind: EvidenceKind;
  status: "WAJIB" | "PENGUAT";
  mandatory: boolean;
  description: string;
}

export interface AssessmentPackage {
  meta: { label: string; status: string; statusNote: string; generatedAt: string };
  indicators: PackageIndicator[];
  rubric: PackageRubricLevel[];
  evidence: PackageEvidence[];
}

/** Current stored state of one indicator, as the import planner needs it. */
export interface StoredIndicator {
  code: string;
  domainCode: string;
  aspectCode: string;
  name: string;
  isControlledException: boolean;
  operationalDefinition: string | null;
  rubric: { level: number; label: string; descriptor: string }[];
  evidence: { kind: string; minimumFor: number | null; mandatory: boolean; description: string }[];
}
