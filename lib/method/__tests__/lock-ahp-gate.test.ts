import { describe, expect, it } from 'vitest';

import { expectedAhpGroups, pairValue } from '../ahp';
import { assertGate, evaluateAhpGate, evaluateContentLockGate, type AhpGroupInput, type ContentLockItem } from '../gates';

// docs/05 §6 G4_CONTENT_LOCK and G5_AHP (researcher decision 26 Sep 2026).
const aspects = [
  { domainCode: 'D1', code: 'A01' },
  { domainCode: 'D1', code: 'A02' },
  { domainCode: 'D2', code: 'A03' },
];
const item = (code: string, aspectCode: string, latestDecision: ContentLockItem['latestDecision'] = 'PERTAHANKAN'): ContentLockItem => ({
  code,
  domainCode: aspectCode === 'A03' ? 'D2' : 'D1',
  aspectCode,
  latestDecision,
});
const items = [item('C01', 'A01'), item('C02', 'A02'), item('C03', 'A02'), item('C04', 'A03')];

describe('G4_CONTENT_LOCK', () => {
  it('G4-1 G3 lulus, tanpa ronde terbuka → dapat dikunci; semua butir ikut', () => {
    const e = evaluateContentLockGate({ g3Passed: true, openDelphiRounds: 0, items, aspects });
    expect(e.passed).toBe(true);
    expect(e.kept).toEqual(['C01', 'C02', 'C03', 'C04']);
    expect(e.warnings).toContain('STRUCTURE_AFTER_LOCK: 2–3–4');
  });

  it('G4-2 G3 belum lulus atau ronde terbuka → memblokir', () => {
    const e = evaluateContentLockGate({ g3Passed: false, openDelphiRounds: 1, items, aspects });
    expect(e.unmet).toEqual(['G3_NOT_PASSED', 'DELPHI_ROUND_OPEN']);
  });

  it('G4-3 HAPUS_DARI_INTI dan TIDAK_SELESAI tidak ikut ke versi terkunci', () => {
    const e = evaluateContentLockGate({
      g3Passed: true,
      openDelphiRounds: 0,
      items: [item('C01', 'A01'), item('C02', 'A02', 'HAPUS_DARI_INTI'), item('C03', 'A02', 'TIDAK_SELESAI'), item('C04', 'A03'), item('C05', 'A02')],
      aspects,
    });
    expect(e.passed).toBe(true);
    expect(e.kept).toEqual(['C01', 'C04', 'C05']);
    expect(e.excluded).toEqual([
      { code: 'C02', decision: 'HAPUS_DARI_INTI' },
      { code: 'C03', decision: 'TIDAK_SELESAI' },
    ]);
    expect(e.warnings).toContain('EXCLUDED_FROM_CORE: C02, C03');
  });

  it('G4-4 aspek yang kosong setelah pengecualian → memblokir', () => {
    const e = evaluateContentLockGate({ g3Passed: true, openDelphiRounds: 0, items: [item('C01', 'A01'), item('C02', 'A02', 'HAPUS_DARI_INTI'), item('C04', 'A03')], aspects });
    expect(e.unmet).toEqual(['ASPECT_WITHOUT_INDICATOR: D1/A02']);
  });

  it('G4-5 butir tanpa hasil Delphi → memblokir', () => {
    const e = evaluateContentLockGate({ g3Passed: true, openDelphiRounds: 0, items: [...items.slice(0, 3), item('C04', 'A03', null)], aspects });
    expect(e.unmet).toEqual(['ITEM_WITHOUT_DELPHI_RESULT: C04']);
  });
});

describe('AHP groups and pairs', () => {
  it('matriks domain + matriks aspek hanya untuk domain beraspek ≥ 2 (aspek tunggal berbobot lokal 1)', () => {
    expect(expectedAhpGroups([{ code: 'D1', aspects: ['A01', 'A02'] }, { code: 'D7', aspects: ['A14'] }])).toEqual(['DOMAIN', 'ASPECT/D1']);
    expect(expectedAhpGroups([{ code: 'D1', aspects: ['A01'] }])).toEqual([]);
  });

  it('nilai pasangan Saaty: A → intensitas, B → 1/intensitas, EQUAL → 1', () => {
    expect(pairValue('A', 5)).toBe(5);
    expect(pairValue('B', 4)).toBe(0.25);
    expect(pairValue('EQUAL', 7)).toBe(1);
  });
});

const g = (key: string, over: Partial<AhpGroupInput> = {}): AhpGroupInput => ({
  key,
  matrices: [
    { seatIndex: 1, status: 'ACCEPTED', cr: 0.04 },
    { seatIndex: 2, status: 'ACCEPTED', cr: 0.07 },
  ],
  aggregated: true,
  ...over,
});
const expected = ['DOMAIN', 'ASPECT/D1'];

describe('G5_AHP', () => {
  it('G5-1 semua grup diterima, teragregasi, sensitivitas jalan → lulus', () => {
    expect(evaluateAhpGate({ contentLocked: true, expectedGroups: expected, groups: [g('DOMAIN'), g('ASPECT/D1')], sensitivityRun: true }).passed).toBe(true);
  });

  it('G5-2 hierarki belum terkunci → CONTENT_NOT_LOCKED', () => {
    const e = evaluateAhpGate({ contentLocked: false, expectedGroups: expected, groups: [g('DOMAIN'), g('ASPECT/D1')], sensitivityRun: true });
    expect(e.unmet).toEqual(['CONTENT_NOT_LOCKED']);
    expect(() => assertGate(e)).toThrowError(/G5_AHP/);
  });

  it('G5-3 matriks tak terselesaikan dikeluarkan dan dilaporkan, tidak memblokir', () => {
    const e = evaluateAhpGate({
      contentLocked: true,
      expectedGroups: expected,
      groups: [g('DOMAIN', { matrices: [{ seatIndex: 1, status: 'ACCEPTED', cr: 0.05 }, { seatIndex: 2, status: 'RETURNED_UNRESOLVED', cr: 0.3 }] }), g('ASPECT/D1')],
      sensitivityRun: true,
    });
    expect(e.passed).toBe(true);
    expect(e.warnings).toEqual(['MATRIX_RETURNED_UNRESOLVED: DOMAIN #2 CR=0.300']);
  });

  it('G5-4 semua matriks satu grup tak terselesaikan → ALL_MATRICES_INCONSISTENT', () => {
    const e = evaluateAhpGate({
      contentLocked: true,
      expectedGroups: expected,
      groups: [g('DOMAIN', { matrices: [{ seatIndex: 1, status: 'RETURNED_UNRESOLVED', cr: 0.2 }], aggregated: false }), g('ASPECT/D1')],
      sensitivityRun: true,
    });
    expect(e.unmet).toEqual(['ALL_MATRICES_INCONSISTENT: DOMAIN']);
  });

  it('G5-5 matriks masih dalam peninjauan → MATRIX_PENDING', () => {
    const e = evaluateAhpGate({
      contentLocked: true,
      expectedGroups: expected,
      groups: [g('DOMAIN', { matrices: [{ seatIndex: 1, status: 'ACCEPTED', cr: 0.05 }, { seatIndex: 2, status: 'RETURNED', cr: 0.2 }] }), g('ASPECT/D1')],
      sensitivityRun: true,
    });
    expect(e.unmet).toEqual(['MATRIX_PENDING: DOMAIN #2']);
  });

  it('G5-6 grup yang diharapkan tidak ada → GROUP_MISSING', () => {
    expect(evaluateAhpGate({ contentLocked: true, expectedGroups: expected, groups: [g('DOMAIN')], sensitivityRun: true }).unmet).toEqual(['GROUP_MISSING: ASPECT/D1']);
  });

  it('G5-7 sensitivitas belum dijalankan → SENSITIVITY_NOT_RUN', () => {
    expect(evaluateAhpGate({ contentLocked: true, expectedGroups: expected, groups: [g('DOMAIN'), g('ASPECT/D1')], sensitivityRun: false }).unmet).toEqual(['SENSITIVITY_NOT_RUN']);
  });

  it('G5-8 belum ada matriks → NO_MATRIX_SUBMITTED', () => {
    expect(evaluateAhpGate({ contentLocked: true, expectedGroups: expected, groups: [], sensitivityRun: false }).unmet).toContain('NO_MATRIX_SUBMITTED');
  });
});
