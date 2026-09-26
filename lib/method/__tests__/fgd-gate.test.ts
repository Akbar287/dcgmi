import { describe, expect, it } from 'vitest';

import { evaluateFgdGate, type FgdResultInput } from '../gates';

const expected = [
  { stage: 'PEMBUKAAN', targetCode: 'PEMBUKAAN' },
  { stage: 'INDIKATOR', targetCode: 'C02' },
  { stage: 'INDIKATOR', targetCode: 'C03' },
];

function result(stage: string, targetCode: string, over: Partial<FgdResultInput> = {}): FgdResultInput {
  return {
    resultId: `${stage}/${targetCode}`,
    stage,
    targetCode,
    completedAt: '2026-09-26T01:00:00.000Z',
    positions: 6,
    decision: 'TERIMA',
    resolutionNote: null,
    suggestions: [],
    ...over,
  };
}

const complete = () => expected.map((e) => result(e.stage, e.targetCode));

describe('G2 FGD', () => {
  it('G2-1 lulus bila seluruh komponen lengkap dan terlacak', () => {
    const e = evaluateFgdGate({ expected, results: complete() });
    expect(e).toMatchObject({ gate: 'G2_FGD', passed: true, unmet: [], warnings: [] });
    expect(e.counted).toHaveLength(3);
  });

  it('G2-2 komponen tanpa hasil memblokir', () => {
    const e = evaluateFgdGate({ expected, results: complete().slice(0, 2) });
    expect(e.unmet).toEqual(['FGD_COMPONENT_MISSING: INDIKATOR/C03']);
  });

  it('G2-3 posisi panel tidak lengkap memblokir, tanpa menyesuaikan ambang', () => {
    const r = complete();
    r[1] = { ...r[1], positions: 5 };
    expect(evaluateFgdGate({ expected, results: r }).unmet).toEqual(['FGD_POSITIONS_INCOMPLETE: INDIKATOR/C02 n=5']);
  });

  it('G2-4 pembahasan khusus wajib punya catatan resolusi', () => {
    const r = complete();
    r[2] = { ...r[2], decision: 'PEMBAHASAN_KHUSUS' };
    expect(evaluateFgdGate({ expected, results: r }).unmet).toEqual(['FGD_SPECIAL_UNRESOLVED: INDIKATOR/C03']);
    r[2] = { ...r[2], resolutionNote: 'Dipertahankan dengan revisi definisi; lihat tugas revisi.' };
    expect(evaluateFgdGate({ expected, results: r }).passed).toBe(true);
  });

  it('G2-5 matriks revisi harus lengkap', () => {
    const r = complete();
    r[0] = {
      ...r[0],
      suggestions: [
        { adopted: null, notAdoptedReason: null },
        { adopted: false, notAdoptedReason: ' ' },
        { adopted: false, notAdoptedReason: 'Sudah dicakup indikator lain' },
        { adopted: true, notAdoptedReason: null },
      ],
    };
    expect(evaluateFgdGate({ expected, results: r }).unmet).toEqual(['FGD_SUGGESTION_UNDECIDED: 1', 'FGD_NOT_ADOPTED_WITHOUT_REASON: 1']);
  });

  it('G2-6 hanya hasil terbaru per komponen yang dihitung', () => {
    const r = [
      ...complete(),
      result('INDIKATOR', 'C02', {
        resultId: 'old',
        completedAt: '2026-09-25T01:00:00.000Z',
        decision: 'PEMBAHASAN_KHUSUS',
        suggestions: [{ adopted: null, notAdoptedReason: null }],
      }),
    ];
    const e = evaluateFgdGate({ expected, results: r });
    expect(e.passed).toBe(true);
    expect(e.warnings).toEqual(['FGD_SUPERSEDED_RESULTS: 1']);
    expect(e.counted).not.toContain('old');
  });
});
