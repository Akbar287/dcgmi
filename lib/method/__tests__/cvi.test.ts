import { describe, expect, it } from 'vitest';
import { buildRoundFeedback, computeItemCvi, computeScaleCvi, itemsForNextRound } from '../cvi';
import type { Relevance } from '../types';

// docs/05-METHOD-RULES.md §3.5 — vector C1..C7
describe('keputusan butir Delphi/CVI (Tabel 3.6)', () => {
  const cases = [
    { id: 'C1', r: [4, 4, 4, 4, 4, 3, 3, 3], iCvi: 1.0, median: 4, iqr: 1, decision: 'PERTAHANKAN' },
    { id: 'C2', r: [4, 4, 4, 4, 4, 4, 4, 2], iCvi: 0.875, median: 4, iqr: 0, decision: 'PERTAHANKAN' },
    { id: 'C3', r: [4, 4, 4, 4, 4, 4, 2, 2], iCvi: 0.75, median: 4, iqr: 0.5, decision: 'REVISI_NILAI_ULANG' },
    { id: 'C4', r: [4, 4, 3, 3, 2, 2, 2, 2], iCvi: 0.5, median: 2.5, iqr: 1.25, decision: 'REVISI_NILAI_ULANG' },
    { id: 'C5', r: [3, 2, 2, 2, 2, 1, 1, 1], iCvi: 0.125, median: 2, iqr: 1, decision: 'HAPUS_DARI_INTI' },
    { id: 'C6', r: [4, 4, 4, 4, 1, 1, 1, 1], iCvi: 0.5, median: 2.5, iqr: 3, decision: 'REVISI_NILAI_ULANG' },
  ] as const;

  for (const c of cases) {
    it(`${c.id}: I-CVI ${c.iCvi} -> ${c.decision}`, () => {
      const res = computeItemCvi({ indicatorCode: c.id, ratings: [...c.r] as Relevance[] });
      expect(res.iCvi).toBeCloseTo(c.iCvi, 6);
      expect(res.median).toBeCloseTo(c.median, 6);
      expect(res.iqr).toBeCloseTo(c.iqr, 6);
      expect(res.decision).toBe(c.decision);
      expect(res.validRaters).toBe(8);
      expect(res.panelDeviation).toBe(false);
    });
  }

  // Kasus yang paling mudah diimplementasikan salah.
  it('C3: 0,750 TIDAK lolos — ambangnya 0,78, bukan 0,75', () => {
    const res = computeItemCvi({ indicatorCode: 'C3', ratings: [4, 4, 4, 4, 4, 4, 2, 2] });
    expect(res.iCvi).toBeCloseTo(0.75, 6);
    expect(res.decision).not.toBe('PERTAHANKAN');
  });

  it('C7: penilai valid 7 dari rencana 8 -> deviasi panel ditandai', () => {
    const res = computeItemCvi({ indicatorCode: 'C7', ratings: [4, 4, 4, 4, 4, 4, 4, null] });
    expect(res.validRaters).toBe(7);
    expect(res.panelDeviation).toBe(true);
    expect(res.iCvi).toBeCloseTo(1.0, 6); // penyebut aktual 7, bukan 8
    expect(res.reasons[0]).toMatch(/DEVIASI PANEL/);
  });

  it('sel kosong tidak diimputasi sebagai skor rendah', () => {
    const penuh = computeItemCvi({ indicatorCode: 'X', ratings: [4, 4, 4, 4, 4, 4, 4, 4] });
    const kosong = computeItemCvi({ indicatorCode: 'X', ratings: [4, 4, 4, 4, 4, 4, 4, null] });
    expect(kosong.iCvi).toBe(penuh.iCvi);
  });

  it('konflik konstruk mendasar -> hapus dari inti walau I-CVI tinggi', () => {
    const res = computeItemCvi({ indicatorCode: 'X', ratings: [4, 4, 4, 4, 4, 4, 4, 4], constructConflict: true });
    expect(res.decision).toBe('HAPUS_DARI_INTI');
  });

  it('isu kejelasan kritis menahan PERTAHANKAN', () => {
    const res = computeItemCvi({ indicatorCode: 'X', ratings: [4, 4, 4, 4, 4, 4, 4, 4], clarityCritical: true });
    expect(res.decision).toBe('REVISI_NILAI_ULANG');
  });

  it('belum memenuhi setelah ronde 3 -> TIDAK_SELESAI', () => {
    const res = computeItemCvi({ indicatorCode: 'X', ratings: [4, 4, 4, 4, 4, 4, 2, 2], round: 3 });
    expect(res.decision).toBe('TIDAK_SELESAI');
  });

  it('menolak skor relevansi di luar 1..4', () => {
    expect(() => computeItemCvi({ indicatorCode: 'X', ratings: [5 as never, 4, 4, 4, 4, 4, 4, 4] })).toThrowError(/tidak sah/);
  });
});

describe('S-CVI/Ave', () => {
  it('tepat di ambang 0,90 -> lolos', () => {
    const r = computeScaleCvi([{ iCvi: 1.0 }, { iCvi: 0.875 }, { iCvi: 0.875 }, { iCvi: 1.0 }, { iCvi: 0.75 }]);
    expect(r.sCviAve).toBeCloseTo(0.9, 6);
    expect(r.passes).toBe(true);
  });
  it('di bawah ambang -> gagal', () => {
    expect(computeScaleCvi([{ iCvi: 0.875 }, { iCvi: 0.875 }]).passes).toBe(false);
  });
});

describe('alur ronde', () => {
  it('hanya butir REVISI_NILAI_ULANG yang dibawa ke ronde berikutnya', () => {
    const results = [
      computeItemCvi({ indicatorCode: 'C01', ratings: [4, 4, 4, 4, 4, 4, 4, 4] }),
      computeItemCvi({ indicatorCode: 'C02', ratings: [4, 4, 4, 4, 4, 4, 2, 2] }),
      computeItemCvi({ indicatorCode: 'C03', ratings: [1, 1, 1, 2, 2, 2, 2, 2] }),
    ];
    expect(itemsForNextRound(results)).toEqual(['C02']);
  });

  it('umpan balik ronde tidak memuat identitas, hanya agregat + skor sendiri', () => {
    const fb = buildRoundFeedback([4, 3, 4, 2, 4, 3, 4, 4], 4);
    expect(fb.own).toBe(2);
    expect(fb.distribution).toEqual([0, 1, 2, 5]);
    expect(Object.keys(fb)).toEqual(['own', 'median', 'iqr', 'distribution']);
  });
});
