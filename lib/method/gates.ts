import { METHOD } from './constants';
import { GateError } from './errors';

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

export function evaluateDelphiGate(input: {
  rounds: { roundNumber: number; sCviAve: number | null; unresolvedItems: string[]; panelDeviation: boolean }[];
}): GateEvaluation {
  const unmet: string[] = [];
  const warnings: string[] = [];
  const last = input.rounds.at(-1);

  if (!last) unmet.push('NO_DELPHI_ROUND');
  else {
    if (last.panelDeviation) unmet.push('PANEL_SIZE_DEVIATION');
    if (last.sCviAve === null) unmet.push('S_CVI_NOT_COMPUTED');
    else if (last.sCviAve < METHOD.S_CVI_AVE_MIN) {
      unmet.push(`S_CVI_BELOW_THRESHOLD: ${last.sCviAve.toFixed(3)} < ${METHOD.S_CVI_AVE_MIN}`);
    }
    if (last.unresolvedItems.length > 0 && last.roundNumber < METHOD.MAX_ROUNDS) {
      unmet.push(`UNRESOLVED_ITEMS: ${last.unresolvedItems.join(', ')}`);
    } else if (last.unresolvedItems.length > 0) {
      warnings.push(`ITEMS_REPORTED_AS_UNFINISHED: ${last.unresolvedItems.join(', ')}`);
    }
  }

  return { gate: 'G3_DELPHI', passed: unmet.length === 0, unmet, warnings };
}

export function evaluateAhpGate(input: {
  contentLocked: boolean;
  matrices: { seatIndex: number; cr: number; accepted: boolean }[];
  sensitivityRun: boolean;
}): GateEvaluation {
  const unmet: string[] = [];
  const warnings: string[] = [];

  if (!input.contentLocked) unmet.push('CONTENT_NOT_LOCKED');
  if (input.matrices.length === 0) unmet.push('NO_MATRIX_SUBMITTED');
  const rejected = input.matrices.filter((m) => !m.accepted || m.cr >= METHOD.CR_MAX);
  if (rejected.length > 0) {
    warnings.push(`MATRIX_RETURNED_TO_SEAT: ${rejected.map((m) => `#${m.seatIndex} CR=${m.cr.toFixed(3)}`).join(', ')}`);
  }
  if (input.matrices.length > 0 && rejected.length === input.matrices.length) {
    unmet.push('ALL_MATRICES_INCONSISTENT');
  }
  if (!input.sensitivityRun) unmet.push('SENSITIVITY_NOT_RUN');

  return { gate: 'G5_AHP', passed: unmet.length === 0, unmet, warnings };
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
