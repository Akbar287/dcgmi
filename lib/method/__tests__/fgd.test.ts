import { describe, expect, it } from 'vitest';
import { applyFgdDecisionRule, validateSuggestionAdoption } from '../fgd';
import type { FgdPositionType } from '../types';

const P = (terima: number, revisi: number, tolak: number): FgdPositionType[] => [
  ...Array<FgdPositionType>(terima).fill('TERIMA'),
  ...Array<FgdPositionType>(revisi).fill('TERIMA_DENGAN_REVISI'),
  ...Array<FgdPositionType>(tolak).fill('TOLAK'),
];

// docs/05-METHOD-RULES.md §2 — vector F1..F9
describe('aturan keputusan FGD (Tabel 3.5)', () => {
  const cases = [
    { id: 'F1', p: P(6, 0, 0), decision: 'TERIMA', rule: 'ALL_ACCEPT' },
    { id: 'F2', p: P(5, 1, 0), decision: 'PERTAHANKAN_SEMENTARA', rule: 'NOTES_1_2' },
    { id: 'F3', p: P(4, 2, 0), decision: 'PERTAHANKAN_SEMENTARA', rule: 'NOTES_1_2' },
    { id: 'F4', p: P(3, 3, 0), decision: 'TIDAK_SEPAKAT', rule: 'SPLIT_3_3' },
    { id: 'F5', p: P(2, 4, 0), decision: 'REVISI', rule: 'GE4_NON_TERIMA' },
    { id: 'F6', p: P(4, 0, 2), decision: 'PEMBAHASAN_KHUSUS', rule: 'GE2_TOLAK' },
    { id: 'F7', p: P(1, 2, 3), decision: 'PEMBAHASAN_KHUSUS', rule: 'GE2_TOLAK' },
    { id: 'F8', p: P(3, 2, 1), decision: 'TIDAK_SEPAKAT', rule: 'SPLIT_3_3' },
    { id: 'F9', p: P(0, 6, 0), decision: 'REVISI', rule: 'GE4_NON_TERIMA' },
  ] as const;

  for (const c of cases) {
    it(`${c.id}: ${c.decision}`, () => {
      const r = applyFgdDecisionRule([...c.p]);
      expect(r.decision).toBe(c.decision);
      expect(r.ruleFired).toBe(c.rule);
    });
  }

  it('F7: mencatat aturan lain yang juga terpenuhi, tidak membuangnya', () => {
    const r = applyFgdDecisionRule(P(1, 2, 3));
    expect(r.alsoTriggered).toContain('GE4_NON_TERIMA');
  });

  it('tally konsisten', () => {
    const r = applyFgdDecisionRule(P(3, 2, 1));
    expect(r.tally).toMatchObject({ TERIMA: 3, TERIMA_DENGAN_REVISI: 2, TOLAK: 1, total: 6, nonAccept: 3 });
  });

  it('menolak masukan kosong', () => {
    expect(() => applyFgdDecisionRule([])).toThrowError(/Tidak ada posisi/);
  });
});

describe('adopsi saran', () => {
  it('menolak saran tidak diadopsi tanpa alasan', () => {
    expect(validateSuggestionAdoption({ adopted: false }).ok).toBe(false);
    expect(validateSuggestionAdoption({ adopted: false, notAdoptedReason: '   ' }).ok).toBe(false);
  });
  it('menerima bila alasan terisi', () => {
    expect(validateSuggestionAdoption({ adopted: false, notAdoptedReason: 'Tumpang tindih C33' }).ok).toBe(true);
  });
});
