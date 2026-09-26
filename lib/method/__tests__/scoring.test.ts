import { describe, expect, it } from 'vitest';
import { computeAspectScore, computeDomainScore, computeIndex, uniformLocalWeights } from '../scoring';
import type { DomainScoreInput } from '../types';

const ind = (code: string, level: number | null, missingKind: 'NONE' | 'TIDAK_ADA_KAPABILITAS' | 'MISSING_ADMINISTRATIF' = 'NONE') =>
  ({ indicatorCode: code, level, missingKind }) as const;

// docs/05-METHOD-RULES.md §5.4 — vector S1..S5
describe('agregasi skor', () => {
  it('S1: aspek tunggal, bobot lokal 1', () => {
    const d: DomainScoreInput = {
      domainCode: 'D7',
      weight: 1,
      aspects: [{ aspectCode: 'A14', localWeight: 1, indicators: [ind('C33', 3), ind('C34', 4), ind('C35', 3), ind('C36', 2)] }],
    };
    const r = computeDomainScore(d);
    expect(r.aspectScores.A14).toBeCloseTo(3.0, 10);
    expect(r.score).toBeCloseTo(3.0, 10);
  });

  it('S2: bobot domain', () => {
    const mk = (code: string, weight: number, level: number): DomainScoreInput => ({
      domainCode: code,
      weight,
      aspects: [{ aspectCode: `${code}-A`, localWeight: 1, indicators: [ind(`${code}-i`, level)] }],
    });
    const r = computeIndex([mk('D1', 0.5, 3), mk('D2', 0.3, 2), mk('D3', 0.2, 4)]);
    expect(r.composite).toBeCloseTo(2.9, 10);
    expect(r.compositeStatus).toBe('PROVISIONAL');
  });

  it('S3: MISSING_ADMINISTRATIF menahan aspek, domain, dan komposit', () => {
    const d: DomainScoreInput = {
      domainCode: 'D1',
      weight: 1,
      aspects: [{ aspectCode: 'A01', localWeight: 1, indicators: [ind('C02', 4), ind('C03', null, 'MISSING_ADMINISTRATIF'), ind('C04', 3)] }],
    };
    const r = computeIndex([d]);
    expect(r.aspectScores.A01).toBeNull();
    expect(r.domainProfile.D1).toBeNull();
    expect(r.composite).toBeNull();
    expect(r.missingReport).toHaveLength(1);
    expect(r.missingReport[0].indicatorCode).toBe('C03');
  });

  it('S3b: tidak ada imputasi rerata — penyebut tidak dikurangi', () => {
    const { score } = computeAspectScore({
      aspectCode: 'A01',
      localWeight: 1,
      indicators: [ind('a', 4), ind('b', null, 'MISSING_ADMINISTRATIF'), ind('c', 3)],
    });
    expect(score).not.toBeCloseTo(3.5, 6); // rerata dua sisa = 3,5
    expect(score).toBeNull();
  });

  it('S4: TIDAK_ADA_KAPABILITAS tetap diskor sesuai rubrik', () => {
    const { score, missing } = computeAspectScore({
      aspectCode: 'A05',
      localWeight: 1,
      indicators: [ind('a', 4), ind('b', 1, 'TIDAK_ADA_KAPABILITAS'), ind('c', 3)],
    });
    expect(score).toBeCloseTo(8 / 3, 10);
    expect(missing).toHaveLength(0);
  });

  it('S5: bobot tidak berjumlah 1 -> MethodError', () => {
    const mk = (code: string, weight: number): DomainScoreInput => ({
      domainCode: code,
      weight,
      aspects: [{ aspectCode: `${code}-A`, localWeight: 1, indicators: [ind('i', 3)] }],
    });
    expect(() => computeIndex([mk('D1', 0.5), mk('D2', 0.3), mk('D3', 0.3)])).toThrowError(/seharusnya 1/);
  });

  it('bobot lokal aspek juga diperiksa', () => {
    const d: DomainScoreInput = {
      domainCode: 'D1',
      weight: 1,
      aspects: [
        { aspectCode: 'A01', localWeight: 0.5, indicators: [ind('a', 3)] },
        { aspectCode: 'A02', localWeight: 0.6, indicators: [ind('b', 3)] },
      ],
    };
    expect(() => computeDomainScore(d)).toThrowError(/aspek dalam D1/);
  });

  it('menolak level di luar 1..5', () => {
    expect(() => computeAspectScore({ aspectCode: 'A', localWeight: 1, indicators: [ind('a', 6)] })).toThrowError(/Level tidak sah/);
  });

  it('level null tanpa penanda missing ditolak', () => {
    expect(() => computeAspectScore({ aspectCode: 'A', localWeight: 1, indicators: [ind('a', null)] })).toThrowError(/MISSING_ADMINISTRATIF/);
  });
});

describe('bobot lokal seragam', () => {
  it('berjumlah tepat 1 walau tidak habis dibagi', () => {
    for (const n of [1, 2, 3, 6, 7]) {
      expect(uniformLocalWeights(n).reduce((a, b) => a + b, 0)).toBe(1);
    }
  });
});
