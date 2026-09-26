import { METHOD } from './constants';
import { computeScaleCvi } from './cvi';
import { GateError } from './errors';
import { validateSuggestionAdoption } from './fgd';
import type { DelphiDecision, FgdDecisionType } from './types';

export type GateKey =
  | 'G1_BASELINE'
  | 'G2_FGD'
  | 'G3_DELPHI'
  | 'G4_CONTENT_LOCK'
  | 'G5_AHP'
  | 'G6_SCORING'
  | 'G7_PILOT';

export const GATE_ORDER: GateKey[] = [
  'G1_BASELINE',
  'G2_FGD',
  'G3_DELPHI',
  'G4_CONTENT_LOCK',
  'G5_AHP',
  'G6_SCORING',
  'G7_PILOT',
];

/** Cuplikan keadaan artefak. Struktur biasa agar `lib/method` tetap murni. */
export interface ArtifactSnapshot {
  domains: {
    code: string;
    aspects: {
      code: string;
      indicators: {
        code: string;
        hasOperationalDefinition: boolean;
        rubricLevels: number[];
        mandatoryEvidenceCount: number;
      }[];
    }[];
  }[];
  contentLocked: boolean;
}

export interface GateEvaluation {
  gate: GateKey;
  passed: boolean;
  /** Memblokir kelanjutan. */
  unmet: string[];
  /** Tidak memblokir, tetapi dilaporkan. */
  warnings: string[];
}

export function evaluateBaselineGate(s: ArtifactSnapshot): GateEvaluation {
  const unmet: string[] = [];
  const warnings: string[] = [];

  const aspects = s.domains.flatMap((d) => d.aspects);
  const indicators = aspects.flatMap((a) => a.indicators);

  // Jumlah struktur adalah peringatan, bukan penghalang: struktur memang
  // boleh berubah lewat FGD/Delphi (R1-V1.7 §1.3).
  if (s.domains.length !== METHOD.BASELINE_DOMAIN_COUNT) {
    warnings.push(`DOMAIN_COUNT_MISMATCH: ${s.domains.length} (baseline ${METHOD.BASELINE_DOMAIN_COUNT})`);
  }
  if (aspects.length !== METHOD.BASELINE_ASPECT_COUNT) {
    warnings.push(`ASPECT_COUNT_MISMATCH: ${aspects.length} (baseline ${METHOD.BASELINE_ASPECT_COUNT})`);
  }
  if (indicators.length !== METHOD.BASELINE_INDICATOR_COUNT) {
    warnings.push(`INDICATOR_COUNT_MISMATCH: ${indicators.length} (baseline ${METHOD.BASELINE_INDICATOR_COUNT})`);
  }

  const distribution = s.domains.map((d) => d.aspects.reduce((n, a) => n + a.indicators.length, 0));
  if (distribution.join(',') !== METHOD.BASELINE_DISTRIBUTION.join(',')) {
    warnings.push(`DISTRIBUTION_MISMATCH: ${distribution.join('-')} (baseline ${METHOD.BASELINE_DISTRIBUTION.join('-')})`);
  }

  for (const code of METHOD.CONTROLLED_EXCEPTIONS) {
    if (!indicators.some((i) => i.code === code)) {
      unmet.push(`CONTROLLED_EXCEPTION_MISSING: ${code}`);
    }
  }

  // Kelengkapan paket penilaian memang memblokir (§3.6.1).
  for (const ind of indicators) {
    if (!ind.hasOperationalDefinition) unmet.push(`MISSING_OPERATIONAL_DEFINITION: ${ind.code}`);
    const levels = [...new Set(ind.rubricLevels)].sort((a, b) => a - b);
    const expected = [1, 2, 3, 4, 5];
    if (levels.length !== 5 || levels.join(',') !== expected.join(',')) {
      unmet.push(levels.length === 0 ? `INDICATOR_WITHOUT_RUBRIC: ${ind.code}` : `RUBRIC_LEVEL_GAP: ${ind.code} [${levels.join(',')}]`);
    }
    if (ind.mandatoryEvidenceCount < 1) unmet.push(`INDICATOR_WITHOUT_EVIDENCE: ${ind.code}`);
  }

  return { gate: 'G1_BASELINE', passed: unmet.length === 0, unmet, warnings };
}

export interface FgdComponentKey {
  stage: string;
  targetCode: string;
}

export interface FgdResultInput extends FgdComponentKey {
  resultId: string;
  /** ISO timestamp; the latest completed result per component is the one that counts. */
  completedAt: string;
  positions: number;
  decision: FgdDecisionType;
  resolutionNote: string | null;
  suggestions: { adopted: boolean | null; notAdoptedReason: string | null }[];
}

/**
 * G2_FGD — SPECIFICATION §3 (R1-V1.7 §3.7.3), operationalised by the
 * researcher on 2026-09-26 (docs/05 §6): every agenda component has a latest
 * completed result with a full panel and a recorded decision, special
 * discussions carry a resolution note, and the revision matrix is complete.
 * Completeness and traceability only — Tabel 3.5 is not a validity test.
 */
export function evaluateFgdGate(input: {
  expected: FgdComponentKey[];
  results: FgdResultInput[];
  panelSize?: number;
}): GateEvaluation & { counted: string[] } {
  const unmet: string[] = [];
  const warnings: string[] = [];
  const panelSize = input.panelSize ?? METHOD.FGD_PANEL_SIZE;
  const key = (c: FgdComponentKey) => `${c.stage}/${c.targetCode}`;

  const latest = new Map<string, FgdResultInput>();
  let superseded = 0;
  for (const r of input.results) {
    const k = key(r);
    const prior = latest.get(k);
    if (!prior) latest.set(k, r);
    else {
      superseded++;
      if (r.completedAt > prior.completedAt) latest.set(k, r);
    }
  }

  const counted: FgdResultInput[] = [];
  for (const c of input.expected) {
    const r = latest.get(key(c));
    if (!r) {
      unmet.push(`FGD_COMPONENT_MISSING: ${key(c)}`);
      continue;
    }
    counted.push(r);
    // A deviating panel is reported, never re-weighted (cf. §3.8.3 for Delphi).
    if (r.positions !== panelSize) unmet.push(`FGD_POSITIONS_INCOMPLETE: ${key(c)} n=${r.positions}`);
    if (r.decision === 'PEMBAHASAN_KHUSUS' && !r.resolutionNote?.trim()) unmet.push(`FGD_SPECIAL_UNRESOLVED: ${key(c)}`);
  }

  const suggestions = counted.flatMap((r) => r.suggestions);
  const undecided = suggestions.filter((s) => s.adopted === null).length;
  const withoutReason = suggestions.filter((s) => !validateSuggestionAdoption(s).ok).length;
  if (undecided > 0) unmet.push(`FGD_SUGGESTION_UNDECIDED: ${undecided}`);
  if (withoutReason > 0) unmet.push(`FGD_NOT_ADOPTED_WITHOUT_REASON: ${withoutReason}`);
  if (superseded > 0) warnings.push(`FGD_SUPERSEDED_RESULTS: ${superseded}`);

  return { gate: 'G2_FGD', passed: unmet.length === 0, unmet, warnings, counted: counted.map((r) => r.resultId) };
}

export interface DelphiItemOutcome {
  code: string;
  round: number;
  iCvi: number;
  validRaters: number;
  decision: DelphiDecision;
  /** Seats that flagged clarity on this item in this round. */
  clarityFlags: number;
  /** Researcher's review of the flags; null = not reviewed yet. */
  clarityCritical: boolean | null;
  researcherNote: string | null;
}

/**
 * G3_DELPHI (docs/05 §6, researcher decision 26 Sep 2026): the latest
 * finalized-round result per item counts. Every item must be finished, and
 * S-CVI/Ave is the mean of those latest I-CVIs over ALL items — removed ones
 * included — so removal can never raise it (§3.3).
 */
export function evaluateDelphiGate(input: {
  expected: string[];
  results: DelphiItemOutcome[];
  panelSize?: number;
}): GateEvaluation & { sCviAve: number | null; counted: DelphiItemOutcome[] } {
  const unmet: string[] = [];
  const warnings: string[] = [];
  const panelSize = input.panelSize ?? METHOD.DELPHI_PANEL_SIZE;
  if (input.results.length === 0) {
    return { gate: 'G3_DELPHI', passed: false, unmet: ['NO_DELPHI_ROUND'], warnings, sCviAve: null, counted: [] };
  }

  const latest = new Map<string, DelphiItemOutcome>();
  for (const r of input.results) {
    const prior = latest.get(r.code);
    if (!prior || r.round > prior.round) latest.set(r.code, r);
  }

  const counted: DelphiItemOutcome[] = [];
  const open: string[] = [];
  const unfinished: string[] = [];
  const removed: string[] = [];
  for (const code of input.expected) {
    const r = latest.get(code);
    if (!r) {
      unmet.push(`DELPHI_ITEM_MISSING: ${code}`);
      continue;
    }
    counted.push(r);
    // §3.8.3: a deviating panel is reported, never re-based on 7/8.
    if (r.validRaters !== panelSize) unmet.push(`PANEL_SIZE_DEVIATION: R${r.round}/${code} n=${r.validRaters}`);
    if (r.clarityFlags > 0 && r.clarityCritical === null) unmet.push(`DELPHI_CLARITY_UNREVIEWED: ${code}`);
    if (r.decision === 'REVISI_NILAI_ULANG') open.push(code);
    if (r.decision === 'TIDAK_SELESAI') unfinished.push(code);
    if (r.decision === 'HAPUS_DARI_INTI') {
      removed.push(code);
      if (!r.researcherNote?.trim()) unmet.push(`REMOVAL_WITHOUT_REASON: ${code}`);
    }
  }
  if (open.length) unmet.push(`UNRESOLVED_ITEMS: ${open.join(', ')}`);
  if (unfinished.length) warnings.push(`ITEMS_REPORTED_AS_UNFINISHED: ${unfinished.join(', ')}`);
  if (removed.length) warnings.push(`ITEMS_REMOVED_FROM_CORE: ${removed.join(', ')}`);

  let sCviAve: number | null = null;
  if (counted.length === input.expected.length && counted.length > 0) {
    const scale = computeScaleCvi(counted);
    sCviAve = scale.sCviAve;
    if (!scale.passes) unmet.push(`S_CVI_BELOW_THRESHOLD: ${sCviAve.toFixed(3)} < ${METHOD.S_CVI_AVE_MIN}`);
  }

  return { gate: 'G3_DELPHI', passed: unmet.length === 0, unmet, warnings, sCviAve, counted };
}

export interface ContentLockItem {
  code: string;
  domainCode: string;
  aspectCode: string;
  /** Latest finalized Delphi decision; null = never rated. */
  latestDecision: DelphiDecision | null;
}

const EXCLUDED_AT_LOCK: DelphiDecision[] = ['HAPUS_DARI_INTI', 'TIDAK_SELESAI'];

/**
 * G4_CONTENT_LOCK (docs/05 §6, researcher decision 26 Sep 2026): the locked
 * version is a copy of the Delphi version without the items Tabel 3.6 takes
 * out of the core (HAPUS_DARI_INTI, TIDAK_SELESAI). Every remaining aspect
 * must still hold an indicator, or it could not be scored.
 */
export function evaluateContentLockGate(input: {
  g3Passed: boolean;
  openDelphiRounds: number;
  items: ContentLockItem[];
  aspects: { domainCode: string; code: string }[];
}): GateEvaluation & { kept: string[]; excluded: { code: string; decision: DelphiDecision }[] } {
  const unmet: string[] = [];
  const warnings: string[] = [];
  if (!input.g3Passed) unmet.push('G3_NOT_PASSED');
  if (input.openDelphiRounds > 0) unmet.push('DELPHI_ROUND_OPEN');

  const kept: string[] = [];
  const excluded: { code: string; decision: DelphiDecision }[] = [];
  for (const i of input.items) {
    if (i.latestDecision === null) unmet.push(`ITEM_WITHOUT_DELPHI_RESULT: ${i.code}`);
    if (i.latestDecision && EXCLUDED_AT_LOCK.includes(i.latestDecision)) excluded.push({ code: i.code, decision: i.latestDecision });
    else kept.push(i.code);
  }
  const keptSet = new Set(kept);
  for (const a of input.aspects) {
    const inAspect = input.items.filter((i) => i.domainCode === a.domainCode && i.aspectCode === a.code && keptSet.has(i.code));
    if (inAspect.length === 0) unmet.push(`ASPECT_WITHOUT_INDICATOR: ${a.domainCode}/${a.code}`);
  }
  if (excluded.length) warnings.push(`EXCLUDED_FROM_CORE: ${excluded.map((e) => e.code).join(', ')}`);
  const domains = new Set(input.aspects.map((a) => a.domainCode)).size;
  warnings.push(`STRUCTURE_AFTER_LOCK: ${domains}–${input.aspects.length}–${kept.length}`);

  return { gate: 'G4_CONTENT_LOCK', passed: unmet.length === 0, unmet, warnings, kept, excluded };
}

export type AhpMatrixStatus = 'PENDING' | 'ACCEPTED' | 'RETURNED' | 'RETURNED_UNRESOLVED';

export interface AhpGroupInput {
  /** `DOMAIN` or `ASPECT/<domain>` (see expectedAhpGroups). */
  key: string;
  matrices: { seatIndex: number; status: AhpMatrixStatus; cr: number | null }[];
  aggregated: boolean;
}

/**
 * G5_AHP (docs/05 §4.4, §6): per matrix group, every seat matrix is either
 * accepted (CR < CR_MAX) or — after the docs/04 §8 review rounds — marked
 * RETURNED_UNRESOLVED and excluded with a note; each group has a recorded
 * geometric aggregate; sensitivity was run.
 */
export function evaluateAhpGate(input: {
  contentLocked: boolean;
  expectedGroups: string[];
  groups: AhpGroupInput[];
  sensitivityRun: boolean;
}): GateEvaluation {
  const unmet: string[] = [];
  const warnings: string[] = [];
  if (!input.contentLocked) unmet.push('CONTENT_NOT_LOCKED');
  if (input.groups.length === 0) unmet.push('NO_MATRIX_SUBMITTED');

  for (const key of input.expectedGroups) {
    const group = input.groups.find((x) => x.key === key);
    if (!group) {
      if (input.groups.length) unmet.push(`GROUP_MISSING: ${key}`);
      continue;
    }
    const pending = group.matrices.filter((m) => m.status === 'PENDING' || m.status === 'RETURNED');
    for (const m of pending) unmet.push(`MATRIX_PENDING: ${key} #${m.seatIndex}`);
    const unresolved = group.matrices.filter((m) => m.status === 'RETURNED_UNRESOLVED');
    for (const m of unresolved) warnings.push(`MATRIX_RETURNED_UNRESOLVED: ${key} #${m.seatIndex} CR=${(m.cr ?? NaN).toFixed(3)}`);
    const accepted = group.matrices.filter((m) => m.status === 'ACCEPTED');
    if (pending.length === 0 && accepted.length === 0) unmet.push(`ALL_MATRICES_INCONSISTENT: ${key}`);
    else if (pending.length === 0 && !group.aggregated) unmet.push(`AGGREGATE_MISSING: ${key}`);
  }
  if (!input.sensitivityRun) unmet.push('SENSITIVITY_NOT_RUN');

  return { gate: 'G5_AHP', passed: unmet.length === 0, unmet, warnings };
}

export interface ScoringGateAssessment {
  id: string;
  status: string;
  /** AHP session whose aggregated weights the rollup used. */
  weightsSessionId: string | null;
  missingAdmin: boolean;
  noCapability: boolean;
  compositeNull: boolean;
  missingReportCount: number;
}

/**
 * G6_SCORING (docs/05 §6, researcher decision 26 Sep 2026): completed
 * assessments scored with the G5 weights, real MISSING_ADMINISTRATIF and
 * TIDAK_ADA_KAPABILITAS cases whose handling is visible in the rollup, and an
 * independent recompute report of the CURRENT export with no difference.
 */
export function evaluateScoringGate(input: {
  contentLocked: boolean;
  g5Passed: boolean;
  weightsSessionId: string | null;
  assessments: ScoringGateAssessment[];
  recompute: { exportSha256: string; ok: boolean; diffCount: number } | null;
  currentExportSha256: string;
}): GateEvaluation {
  const unmet: string[] = [];
  const warnings: string[] = [];
  if (!input.contentLocked) unmet.push('CONTENT_NOT_LOCKED');
  if (!input.g5Passed) unmet.push('G5_NOT_PASSED');

  const completed = input.assessments.filter((a) => a.status === 'COMPLETED');
  const pending = input.assessments.filter((a) => a.status !== 'COMPLETED' && a.status !== 'CANCELLED');
  if (completed.length === 0) unmet.push('NO_ASSESSMENT');
  if (pending.length) unmet.push(`ASSESSMENT_PENDING: ${pending.length}`);
  for (const a of completed) if (a.weightsSessionId !== input.weightsSessionId) unmet.push(`WEIGHTS_STALE: ${a.id}`);
  if (completed.length) {
    if (!completed.some((a) => a.missingAdmin)) unmet.push('MISSING_ADMIN_CASE_ABSENT');
    if (!completed.some((a) => a.noCapability)) unmet.push('NO_CAPABILITY_CASE_ABSENT');
  }
  // docs/05 §5.2: missing administratif must hold the composite and be reported.
  for (const a of completed) if (a.missingAdmin && (!a.compositeNull || a.missingReportCount === 0)) unmet.push(`MISSING_NOT_PROPAGATED: ${a.id}`);

  if (!input.recompute) unmet.push('RECOMPUTE_NOT_RUN');
  else if (input.recompute.exportSha256 !== input.currentExportSha256) unmet.push('RECOMPUTE_STALE');
  else if (!input.recompute.ok || input.recompute.diffCount > 0) unmet.push(`RECOMPUTE_DIFFERENCES: ${input.recompute.diffCount}`);

  return { gate: 'G6_SCORING', passed: unmet.length === 0, unmet, warnings };
}

export function assertGate(evaluation: GateEvaluation): void {
  if (!evaluation.passed) throw new GateError(evaluation.gate, evaluation.unmet);
}

/**
 * Perubahan struktur setelah content lock mengembalikan status ke Delphi dan
 * membatalkan bobot AHP (R1-V1.7 §2.8.3, CH-02). Bobot lama diarsipkan,
 * tidak dihapus.
 */
export function gatesToReopen(changedAfterLock: boolean): GateKey[] {
  return changedAfterLock ? ['G3_DELPHI', 'G4_CONTENT_LOCK', 'G5_AHP', 'G6_SCORING'] : [];
}
