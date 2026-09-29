import { METHOD } from './constants';
import type { GateEvaluation } from './gates';
import type { MissingKind } from './types';

/**
 * Quadratic-weighted Cohen kappa between two assessors over levels 1–5
 * (researcher decision 29 Sep 2026, docs/05 §5.6):
 *   κw = 1 − Σ w_ij·O_ij / Σ w_ij·E_ij,  w_ij = (i − j)² / (k − 1)².
 * Returns null when expected disagreement is 0 (no variance): kappa is then
 * undefined — it is never reported as 1.
 */
export function quadraticWeightedKappa(pairs: [number, number][], min = METHOD.LEVEL_MIN, max = METHOD.LEVEL_MAX): number | null {
  const k = max - min + 1;
  const n = pairs.length;
  if (n === 0) return null;
  const O = Array.from({ length: k }, () => new Array<number>(k).fill(0));
  for (const [a, b] of pairs) O[a - min][b - min] += 1;
  const rows = O.map((r) => r.reduce((s, v) => s + v, 0));
  const cols = O[0].map((_, j) => O.reduce((s, r) => s + r[j], 0));
  let observed = 0;
  let expected = 0;
  for (let i = 0; i < k; i++) {
    for (let j = 0; j < k; j++) {
      const w = (i - j) ** 2 / (k - 1) ** 2;
      observed += (w * O[i][j]) / n;
      expected += (w * rows[i] * cols[j]) / (n * n);
    }
  }
  return expected === 0 ? null : 1 - observed / expected;
}

/** Share of items given the identical level by both assessors. */
export function exactAgreement(pairs: [number, number][]): number {
  return pairs.length === 0 ? 0 : pairs.filter(([a, b]) => a === b).length / pairs.length;
}

/** Indicators with a level that is not MISSING_ADMINISTRATIF, over all indicators. */
export function pilotCompleteness(scores: { level: number | null; missingKind: MissingKind }[]): number {
  return scores.length === 0 ? 0 : scores.filter((s) => s.level !== null && s.missingKind !== 'MISSING_ADMINISTRATIF').length / scores.length;
}

/** Every level ≥ 2 must carry a verbatim locator and recorded evidence; 1 when none applies. */
export function pilotTraceability(scores: { level: number | null; missingKind: MissingKind; locator: string | null; satisfied: number }[]): number {
  const due = scores.filter((s) => s.level !== null && s.level >= 2);
  return due.length === 0 ? 1 : due.filter((s) => !!s.locator?.trim() && s.satisfied > 0).length / due.length;
}

export interface PilotGateInput {
  g6Passed: boolean;
  ethics: { reference: string; date: string } | null;
  access: { note: string } | null;
  /** One entry per profile assessed by both assessors (A, B). */
  pairs: {
    profile: string;
    kappa: number | null;
    agreement: number;
    compared: number;
    /** Items left out because either assessor recorded MISSING_ADMINISTRATIF. */
    excluded: number;
    completeness: [number, number];
    traceability: [number, number];
  }[];
  simulated: boolean;
}

/**
 * G7_PILOT (docs/05 §6, Tabel 3.8): conditional on G6, a recorded ethics
 * approval and institutional access, and per assessor pair κw ≥ 0.60,
 * exact agreement ≥ 0.80, completeness ≥ 0.90, traceability = 1.
 */
export function evaluatePilotGate(input: PilotGateInput): GateEvaluation {
  const unmet: string[] = [];
  const warnings: string[] = [];
  if (!input.g6Passed) unmet.push('G6_NOT_PASSED');
  if (!input.ethics?.reference.trim()) unmet.push('ETHICS_NOT_DECLARED');
  if (!input.access?.note.trim()) unmet.push('ACCESS_NOT_DECLARED');
  if (input.pairs.length === 0) unmet.push('NO_PILOT_PAIR');
  for (const p of input.pairs) {
    if (p.kappa === null) unmet.push(`KAPPA_UNDEFINED: ${p.profile}`);
    else if (p.kappa < METHOD.PILOT_KAPPA_MIN) unmet.push(`KAPPA_BELOW: ${p.profile} ${p.kappa.toFixed(3)} < ${METHOD.PILOT_KAPPA_MIN}`);
    if (p.agreement < METHOD.PILOT_AGREEMENT_MIN) unmet.push(`AGREEMENT_BELOW: ${p.profile} ${p.agreement.toFixed(3)} < ${METHOD.PILOT_AGREEMENT_MIN}`);
    p.completeness.forEach((c, i) => {
      if (c < METHOD.PILOT_COMPLETENESS_MIN) unmet.push(`COMPLETENESS_BELOW: ${p.profile}/${i ? 'B' : 'A'} ${c.toFixed(3)} < ${METHOD.PILOT_COMPLETENESS_MIN}`);
    });
    p.traceability.forEach((c, i) => {
      if (c < METHOD.PILOT_TRACEABILITY) unmet.push(`TRACEABILITY_BELOW: ${p.profile}/${i ? 'B' : 'A'} ${c.toFixed(3)} < ${METHOD.PILOT_TRACEABILITY}`);
    });
    if (p.excluded) warnings.push(`EXCLUDED_MISSING: ${p.profile} ${p.excluded}`);
  }
  if (input.simulated) warnings.push('SIMULATED_PILOT');
  return { gate: 'G7_PILOT', passed: unmet.length === 0, unmet, warnings };
}
