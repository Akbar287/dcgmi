import { describe, expect, it } from 'vitest';

import { evaluateDelphiGate, type DelphiItemOutcome } from '../gates';

// docs/05 §6 G3_DELPHI, vectors G3-1…G3-9 (researcher decision 26 Sep 2026).
function r(code: string, iCvi: number, over: Partial<DelphiItemOutcome> = {}): DelphiItemOutcome {
  return { code, round: 1, iCvi, validRaters: 8, decision: 'PERTAHANKAN', clarityFlags: 0, clarityCritical: null, researcherNote: null, ...over };
}
const three = ['C01', 'C02', 'C03'];

describe('G3_DELPHI', () => {
  it('G3-1 semua butir dipertahankan → lulus', () => {
    const e = evaluateDelphiGate({ expected: three, results: [r('C01', 1), r('C02', 0.875), r('C03', 1)] });
    expect(e.passed).toBe(true);
    expect(e.sCviAve).toBeCloseTo(0.9583, 4);
  });

  it('G3-2 butir tanpa rating → DELPHI_ITEM_MISSING, S-CVI tidak dihitung', () => {
    const e = evaluateDelphiGate({ expected: three, results: [r('C01', 1), r('C02', 1)] });
    expect(e.unmet).toEqual(['DELPHI_ITEM_MISSING: C03']);
    expect(e.sCviAve).toBeNull();
  });

  it('G3-3 butir terakhir REVISI_NILAI_ULANG → UNRESOLVED_ITEMS', () => {
    const e = evaluateDelphiGate({ expected: three, results: [r('C01', 1), r('C02', 0.75, { decision: 'REVISI_NILAI_ULANG' }), r('C03', 1)] });
    expect(e.unmet).toEqual(['UNRESOLVED_ITEMS: C02']);
  });

  it('G3-4 hasil ronde terbaru yang dipakai', () => {
    const e = evaluateDelphiGate({
      expected: three,
      results: [r('C01', 1), r('C02', 0.75, { decision: 'REVISI_NILAI_ULANG' }), r('C02', 0.875, { round: 2 }), r('C03', 1)],
    });
    expect(e.passed).toBe(true);
    expect(e.counted.find((c) => c.code === 'C02')?.round).toBe(2);
    expect(e.sCviAve).toBeCloseTo(0.9583, 4);
  });

  it('G3-5 hapus dari inti wajib alasan, dan tidak menaikkan S-CVI', () => {
    const removed = r('C03', 0.125, { decision: 'HAPUS_DARI_INTI' });
    const a = evaluateDelphiGate({ expected: three, results: [r('C01', 1), r('C02', 0.875), removed] });
    expect(a.unmet).toContain('REMOVAL_WITHOUT_REASON: C03');
    const b = evaluateDelphiGate({ expected: three, results: [r('C01', 1), r('C02', 0.875), { ...removed, researcherNote: 'Konflik konstruk dengan C07.' }] });
    expect(b.unmet).toEqual(['S_CVI_BELOW_THRESHOLD: 0.667 < 0.9']);
    expect(b.warnings).toContain('ITEMS_REMOVED_FROM_CORE: C03');
  });

  it('G3-6 vektor S-CVI §3.6: tepat 0,90 lulus; butir tidak selesai dilaporkan', () => {
    const codes = ['C01', 'C02', 'C03', 'C04', 'C05'];
    const e = evaluateDelphiGate({
      expected: codes,
      results: [r('C01', 1), r('C02', 0.875), r('C03', 0.875), r('C04', 1), r('C05', 0.75, { round: 3, decision: 'TIDAK_SELESAI' })],
    });
    expect(e.passed).toBe(true);
    expect(e.sCviAve).toBe(0.9);
    expect(e.warnings).toContain('ITEMS_REPORTED_AS_UNFINISHED: C05');
  });

  it('G3-7 penanda kejelasan wajib ditinjau peneliti', () => {
    const flagged = r('C01', 1, { clarityFlags: 2 });
    expect(evaluateDelphiGate({ expected: ['C01'], results: [flagged] }).unmet).toEqual(['DELPHI_CLARITY_UNREVIEWED: C01']);
    expect(evaluateDelphiGate({ expected: ['C01'], results: [{ ...flagged, clarityCritical: false }] }).passed).toBe(true);
  });

  it('G3-8 penilai valid ≠ panel → PANEL_SIZE_DEVIATION', () => {
    const e = evaluateDelphiGate({ expected: ['C01'], results: [r('C01', 1, { validRaters: 7 })] });
    expect(e.unmet).toEqual(['PANEL_SIZE_DEVIATION: R1/C01 n=7']);
  });

  it('G3-9 belum ada ronde → NO_DELPHI_ROUND', () => {
    const e = evaluateDelphiGate({ expected: three, results: [] });
    expect(e.unmet).toEqual(['NO_DELPHI_ROUND']);
  });
});
