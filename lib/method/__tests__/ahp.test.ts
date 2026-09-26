import { describe, expect, it } from 'vitest';
import { aggregateGeometric, buildMatrixFromPairs, mostInconsistentPairs, priorityVector, sensitivity } from '../ahp';

// docs/05-METHOD-RULES.md §4.5 — vector A1..A5
describe('prioritas dan konsistensi AHP', () => {
  it('A1: matriks konsisten sempurna (n=3)', () => {
    const r = priorityVector([[1, 2, 4], [0.5, 1, 2], [0.25, 0.5, 1]]);
    expect(r.weights[0]).toBeCloseTo(0.571429, 6);
    expect(r.weights[1]).toBeCloseTo(0.285714, 6);
    expect(r.weights[2]).toBeCloseTo(0.142857, 6);
    expect(r.lambdaMax).toBeCloseTo(3.0, 6);
    expect(r.ci).toBeCloseTo(0, 6);
    expect(r.cr).toBeCloseTo(0, 6);
    expect(r.accepted).toBe(true);
  });

  it('A2: matriks Saaty klasik, tidak konsisten ringan', () => {
    const r = priorityVector([[1, 3, 5], [1 / 3, 1, 3], [1 / 5, 1 / 3, 1]]);
    expect(r.weights[0]).toBeCloseTo(0.636986, 6);
    expect(r.weights[1]).toBeCloseTo(0.258285, 6);
    expect(r.weights[2]).toBeCloseTo(0.104729, 6);
    expect(r.lambdaMax).toBeCloseTo(3.038511, 6);
    expect(r.ci).toBeCloseTo(0.019256, 6);
    expect(r.cr).toBeCloseTo(0.033199, 6);
    expect(r.accepted).toBe(true);
  });

  it('A3: tidak konsisten -> ditolak, tidak diperbaiki otomatis', () => {
    const r = priorityVector([[1, 9, 1 / 5], [1 / 9, 1, 3], [5, 1 / 3, 1]]);
    expect(r.cr).toBeGreaterThan(0.1);
    expect(r.accepted).toBe(false);
  });

  it('A4: identitas n=8 -> bobot seragam', () => {
    const A = Array.from({ length: 8 }, () => Array<number>(8).fill(1));
    const r = priorityVector(A);
    for (const w of r.weights) expect(w).toBeCloseTo(0.125, 8);
    expect(r.cr).toBeCloseTo(0, 8);
  });

  it('bobot selalu berjumlah 1', () => {
    const r = priorityVector([[1, 3, 5], [1 / 3, 1, 3], [1 / 5, 1 / 3, 1]]);
    expect(r.weights.reduce((a, b) => a + b, 0)).toBeCloseTo(1, 10);
  });

  it('n<=2 selalu konsisten menurut definisi', () => {
    expect(priorityVector([[1, 7], [1 / 7, 1]]).cr).toBe(0);
  });
});

describe('validasi matriks', () => {
  it('menolak matriks tidak resiprokal', () => {
    expect(() => priorityVector([[1, 3, 5], [3, 1, 3], [1 / 5, 1 / 3, 1]])).toThrowError(/resiprokal|harus 1/i);
  });
  it('menolak sel non-positif', () => {
    expect(() => priorityVector([[1, 0], [0, 1]])).toThrowError(/positif/);
  });
  it('menolak matriks tidak persegi', () => {
    expect(() => priorityVector([[1, 2], [0.5, 1, 3]])).toThrowError(/persegi/);
  });
});

describe('penyusunan matriks dari pasangan', () => {
  it('mengisi resiprokal otomatis', () => {
    const A = buildMatrixFromPairs(3, [
      { i: 0, j: 1, value: 3 },
      { i: 0, j: 2, value: 5 },
      { i: 1, j: 2, value: 3 },
    ]);
    expect(A[1][0]).toBeCloseTo(1 / 3, 10);
    expect(A[2][0]).toBeCloseTo(1 / 5, 10);
    expect(A[0][0]).toBe(1);
  });
  it('menolak bila ada pasangan belum dinilai', () => {
    expect(() => buildMatrixFromPairs(3, [{ i: 0, j: 1, value: 3 }])).toThrowError(/belum dinilai/);
  });
});

describe('agregasi panel', () => {
  it('A5: rata-rata geometris atas sel, bukan atas bobot', () => {
    const r = aggregateGeometric([
      { seatIndex: 1, matrix: [[1, 3], [1 / 3, 1]] },
      { seatIndex: 2, matrix: [[1, 5], [1 / 5, 1]] },
    ]);
    expect(r.aggregatedMatrix[0][1]).toBeCloseTo(Math.sqrt(15), 6);
    expect(r.includedSeats).toEqual([1, 2]);
  });

  it('matriks dengan CR >= 0,10 dikeluarkan dari agregasi dan dicatat', () => {
    const r = aggregateGeometric([
      { seatIndex: 1, matrix: [[1, 3, 5], [1 / 3, 1, 3], [1 / 5, 1 / 3, 1]] },
      { seatIndex: 2, matrix: [[1, 9, 1 / 5], [1 / 9, 1, 3], [5, 1 / 3, 1]] },
    ]);
    expect(r.includedSeats).toEqual([1]);
    expect(r.excludedSeats[0].seatIndex).toBe(2);
    expect(r.excludedSeats[0].cr).toBeGreaterThan(0.1);
  });

  it('melempar bila tidak ada matriks yang diterima', () => {
    const bad = [[1, 9, 1 / 5], [1 / 9, 1, 3], [5, 1 / 3, 1]];
    expect(() => aggregateGeometric([{ seatIndex: 1, matrix: bad }])).toThrowError(/CR < 0,10/);
  });

  it('menolak kursi ganda', () => {
    const m = [[1, 3], [1 / 3, 1]];
    expect(() => aggregateGeometric([{ seatIndex: 1, matrix: m }, { seatIndex: 1, matrix: m }])).toThrowError(/ganda/);
  });
});

describe('diagnostik dan sensitivitas', () => {
  it('menemukan pasangan paling tidak konsisten', () => {
    const pairs = mostInconsistentPairs([[1, 9, 1 / 5], [1 / 9, 1, 3], [5, 1 / 3, 1]], 1);
    expect(pairs[0].ratio).toBeGreaterThan(1);
  });

  it('sensitivitas: menaikkan satu bobot merenormalisasi sisanya', () => {
    const r = sensitivity({ D1: 0.5, D2: 0.3, D3: 0.2 }, 'D1', 0.1);
    expect(Object.values(r.weights).reduce((a, b) => a + b, 0)).toBeCloseTo(1, 10);
    expect(r.weights.D1).toBeCloseTo(0.6, 10);
    expect(r.rankChanged).toBe(false);
  });

  it('sensitivitas menandai perubahan urutan', () => {
    const r = sensitivity({ D1: 0.4, D2: 0.35, D3: 0.25 }, 'D2', 0.2);
    expect(r.rankChanged).toBe(true);
    expect(r.rankAfter[0]).toBe('D2');
  });
});
