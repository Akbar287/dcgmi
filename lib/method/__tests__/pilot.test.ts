import { describe, expect, it } from 'vitest';

import { evaluatePilotGate, exactAgreement, pilotCompleteness, pilotTraceability, quadraticWeightedKappa, type PilotGateInput } from '../pilot';

// docs/05 §5.6 and §6 G7_PILOT (researcher decision 29 Sep 2026). Kappa values
// were computed independently (plain Python) before the implementation.
describe('quadratic-weighted Cohen kappa (levels 1–5)', () => {
  it('P1 identical ratings → 1', () => expect(quadraticWeightedKappa([[1, 1], [2, 2], [3, 3], [4, 4], [5, 5]])).toBe(1));
  it('P2 systematic swap → −1', () => expect(quadraticWeightedKappa([[1, 2], [1, 2], [2, 1], [2, 1]])).toBeCloseTo(-1, 12));
  it('P3 near agreement → 0.9', () => expect(quadraticWeightedKappa([[1, 1], [2, 2], [3, 3], [4, 4], [5, 4], [3, 3], [2, 3], [4, 4]])).toBeCloseTo(0.9, 12));
  it('P4 no variance → null (undefined, not 1)', () => expect(quadraticWeightedKappa([[3, 3], [3, 3], [3, 3]])).toBeNull());
  it('P5 → 0.857143', () => expect(quadraticWeightedKappa([[2, 2], [3, 3], [4, 4], [5, 4], [2, 2], [3, 3], [4, 5], [5, 5], [3, 3], [4, 3]])).toBeCloseTo(0.857143, 6));
});

describe('agreement, completeness, traceability', () => {
  it('exact agreement is the share of identical levels', () => expect(exactAgreement([[1, 1], [2, 3], [4, 4], [5, 5]])).toBe(0.75));
  it('completeness counts levels that are not MISSING_ADMINISTRATIF', () => {
    expect(pilotCompleteness([{ level: 3, missingKind: 'NONE' }, { level: 1, missingKind: 'TIDAK_ADA_KAPABILITAS' }, { level: null, missingKind: 'MISSING_ADMINISTRATIF' }, { level: 2, missingKind: 'NONE' }])).toBe(0.75);
  });
  it('traceability: every level ≥ 2 needs a locator and recorded evidence', () => {
    const ok = { level: 3, missingKind: 'NONE' as const, locator: 'SK rektor', satisfied: 2 };
    expect(pilotTraceability([ok, { level: 1, missingKind: 'TIDAK_ADA_KAPABILITAS', locator: null, satisfied: 0 }])).toBe(1);
    expect(pilotTraceability([ok, { level: 4, missingKind: 'NONE', locator: null, satisfied: 3 }])).toBe(0.5);
  });
});

const pair = (profile: string, over: Partial<PilotGateInput['pairs'][number]> = {}): PilotGateInput['pairs'][number] => ({
  profile,
  kappa: 0.85,
  agreement: 0.86,
  compared: 40,
  excluded: 0,
  completeness: [0.95, 0.97],
  traceability: [1, 1],
  ...over,
});
const base: PilotGateInput = { g6Passed: true, ethics: { reference: 'KEP/123/2026', date: '2026-09-01' }, access: { note: 'Surat izin institusi' }, pairs: [pair('A')], simulated: true };

describe('G7_PILOT', () => {
  it('G7-1 all criteria met → passes, simulated pilot flagged', () => {
    const e = evaluatePilotGate(base);
    expect(e.passed).toBe(true);
    expect(e.warnings).toContain('SIMULATED_PILOT');
  });
  it('G7-2 G6 not passed and declarations missing', () => {
    expect(evaluatePilotGate({ ...base, g6Passed: false, ethics: null, access: null }).unmet).toEqual(['G6_NOT_PASSED', 'ETHICS_NOT_DECLARED', 'ACCESS_NOT_DECLARED']);
  });
  it('G7-3 no assessor pair → NO_PILOT_PAIR', () => expect(evaluatePilotGate({ ...base, pairs: [] }).unmet).toEqual(['NO_PILOT_PAIR']));
  it('G7-4 thresholds: kappa 0.60 and agreement 0.80 pass at the boundary; below blocks', () => {
    expect(evaluatePilotGate({ ...base, pairs: [pair('A', { kappa: 0.6, agreement: 0.8 })] }).passed).toBe(true);
    expect(evaluatePilotGate({ ...base, pairs: [pair('A', { kappa: 0.59, agreement: 0.79 })] }).unmet).toEqual(['KAPPA_BELOW: A 0.590 < 0.6', 'AGREEMENT_BELOW: A 0.790 < 0.8']);
  });
  it('G7-5 undefined kappa blocks; excluded items are reported', () => {
    const e = evaluatePilotGate({ ...base, pairs: [pair('A', { kappa: null, excluded: 2 })] });
    expect(e.unmet).toEqual(['KAPPA_UNDEFINED: A']);
    expect(e.warnings).toContain('EXCLUDED_MISSING: A 2');
  });
  it('G7-6 completeness < 0.90 or traceability < 1 on either assessment blocks', () => {
    expect(evaluatePilotGate({ ...base, pairs: [pair('A', { completeness: [0.95, 0.85], traceability: [1, 0.98] })] }).unmet).toEqual(['COMPLETENESS_BELOW: A/B 0.850 < 0.9', 'TRACEABILITY_BELOW: A/B 0.980 < 1']);
  });
});
