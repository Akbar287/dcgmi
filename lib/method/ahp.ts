import { METHOD } from './constants';
import { MethodError } from './errors';
import { geometricMean } from './stats';
import type { AggregateResult, Matrix, PriorityResult, SeatMatrix } from './types';

const RECIPROCAL_TOLERANCE = 1e-9;

export function validateMatrix(A: Matrix): void {
  const n = A.length;
  if (n === 0) throw new MethodError('EMPTY_INPUT', 'Matriks kosong');
  if (n > METHOD.RANDOM_INDEX.length) {
    throw new MethodError('MATRIX_TOO_LARGE', `Random Index Saaty hanya tersedia sampai n=${METHOD.RANDOM_INDEX.length}`);
  }
  for (const row of A) {
    if (row.length !== n) throw new MethodError('MATRIX_NOT_SQUARE', 'Matriks harus persegi');
    for (const v of row) {
      if (!Number.isFinite(v) || v <= 0) {
        throw new MethodError('MATRIX_NON_POSITIVE', 'Seluruh sel matriks harus positif dan terhingga');
      }
    }
  }
  for (let i = 0; i < n; i++) {
    if (Math.abs(A[i][i] - 1) > RECIPROCAL_TOLERANCE) {
      throw new MethodError('MATRIX_NOT_RECIPROCAL', `Diagonal a[${i}][${i}] harus 1`);
    }
    for (let j = i + 1; j < n; j++) {
      if (Math.abs(A[i][j] * A[j][i] - 1) > RECIPROCAL_TOLERANCE) {
        throw new MethodError('MATRIX_NOT_RECIPROCAL', `a[${i}][${j}] x a[${j}][${i}] harus 1`, { i, j });
      }
    }
  }
}

export function randomIndex(n: number): number {
  return METHOD.RANDOM_INDEX[n - 1] ?? 0;
}

/** Bangun matriss resiprokal dari penilaian pasangan (i<j). */
export function buildMatrixFromPairs(
  size: number,
  pairs: { i: number; j: number; value: number }[],
): Matrix {
  const A: Matrix = Array.from({ length: size }, (_, r) =>
    Array.from({ length: size }, (_, c) => (r === c ? 1 : 0)),
  );
  for (const { i, j, value } of pairs) {
    if (value < 1 / METHOD.SAATY_MAX || value > METHOD.SAATY_MAX) {
      throw new MethodError('MATRIX_NON_POSITIVE', `Nilai Saaty di luar rentang: ${value}`);
    }
    A[i][j] = value;
    A[j][i] = 1 / value;
  }
  for (let i = 0; i < size; i++) {
    for (let j = 0; j < size; j++) {
      if (A[i][j] === 0) throw new MethodError('EMPTY_INPUT', `Pasangan (${i},${j}) belum dinilai`);
    }
  }
  return A;
}

/**
 * Vektor prioritas melalui eigenvector utama (iterasi pangkat).
 * lambdaMax = rata-rata (A·w)_i / w_i.
 * CI = (lambdaMax - n)/(n - 1);  CR = CI / RI(n).
 * R1-V1.7 §3.9.2.
 */
export function priorityVector(A: Matrix): PriorityResult {
  validateMatrix(A);
  const n = A.length;

  let w = new Array<number>(n).fill(1 / n);
  for (let iter = 0; iter < METHOD.POWER_ITERATION_MAX; iter++) {
    const next = A.map((row) => row.reduce((acc, v, j) => acc + v * w[j], 0));
    const sum = next.reduce((a, b) => a + b, 0);
    const normalized = next.map((v) => v / sum);
    const delta = Math.max(...normalized.map((v, i) => Math.abs(v - w[i])));
    w = normalized;
    if (delta < METHOD.POWER_ITERATION_TOLERANCE) break;
  }

  const Aw = A.map((row) => row.reduce((acc, v, j) => acc + v * w[j], 0));
  const lambdaMax = Aw.reduce((acc, v, i) => acc + v / w[i], 0) / n;

  const ci = n > 1 ? (lambdaMax - n) / (n - 1) : 0;
  const ri = randomIndex(n);
  // n <= 2 selalu konsisten menurut definisi.
  const cr = n <= 2 || ri === 0 ? 0 : ci / ri;

  return { weights: w, lambdaMax, ci, cr, accepted: cr < METHOD.CR_MAX, size: n };
}

/**
 * Agregasi panel: rata-rata geometris ATAS SEL matriks (AIJ), bukan atas
 * vektor bobot. Hanya matriks dengan CR < 0,10 yang diikutkan; matriks yang
 * ditolak dikembalikan ke pakar, tidak diperbaiki peneliti (R1-V1.7 §3.9.2).
 */
export function aggregateGeometric(seats: SeatMatrix[]): AggregateResult {
  if (seats.length === 0) throw new MethodError('EMPTY_INPUT', 'Tidak ada matriks untuk diagregasi');

  const seen = new Set<number>();
  for (const s of seats) {
    if (seen.has(s.seatIndex)) throw new MethodError('DUPLICATE_SEAT', `Kursi ganda: ${s.seatIndex}`);
    seen.add(s.seatIndex);
  }

  const evaluated = seats.map((s) => ({ ...s, result: priorityVector(s.matrix) }));
  const included = evaluated.filter((s) => s.result.accepted);
  const excluded = evaluated
    .filter((s) => !s.result.accepted)
    .map((s) => ({ seatIndex: s.seatIndex, cr: s.result.cr }));

  if (included.length === 0) {
    throw new MethodError('NO_ACCEPTED_MATRIX', 'Tidak ada matriks dengan CR < 0,10 untuk diagregasi', { excluded });
  }

  const n = included[0].matrix.length;
  if (included.some((s) => s.matrix.length !== n)) {
    throw new MethodError('MATRIX_NOT_SQUARE', 'Ukuran matriks antar-kursi tidak sama');
  }

  const aggregated: Matrix = Array.from({ length: n }, (_, i) =>
    Array.from({ length: n }, (_, j) => geometricMean(included.map((s) => s.matrix[i][j]))),
  );

  return {
    ...priorityVector(aggregated),
    aggregatedMatrix: aggregated,
    includedSeats: included.map((s) => s.seatIndex),
    excludedSeats: excluded,
  };
}

/** Pasangan paling tidak konsisten, untuk dikembalikan ke kursi pakar. */
export function mostInconsistentPairs(A: Matrix, top = 3): { i: number; j: number; observed: number; implied: number; ratio: number }[] {
  const { weights } = priorityVector(A);
  const out: { i: number; j: number; observed: number; implied: number; ratio: number }[] = [];
  for (let i = 0; i < A.length; i++) {
    for (let j = i + 1; j < A.length; j++) {
      const implied = weights[i] / weights[j];
      const ratio = A[i][j] / implied;
      out.push({ i, j, observed: A[i][j], implied, ratio: ratio >= 1 ? ratio : 1 / ratio });
    }
  }
  return out.sort((a, b) => b.ratio - a.ratio).slice(0, top);
}

/** Analisis sensitivitas: ubah satu bobot, renormalisasi sisanya, cek pergeseran urutan. */
export function sensitivity(
  baseWeights: Record<string, number>,
  targetCode: string,
  delta: number,
): { weights: Record<string, number>; rankBefore: string[]; rankAfter: string[]; rankChanged: boolean } {
  const codes = Object.keys(baseWeights);
  if (!codes.includes(targetCode)) throw new MethodError('EMPTY_INPUT', `Kode tidak ditemukan: ${targetCode}`);

  const target = Math.min(Math.max(baseWeights[targetCode] + delta, 0), 1);
  const othersSum = codes.filter((c) => c !== targetCode).reduce((a, c) => a + baseWeights[c], 0);
  const scale = othersSum === 0 ? 0 : (1 - target) / othersSum;

  const weights: Record<string, number> = {};
  for (const c of codes) weights[c] = c === targetCode ? target : baseWeights[c] * scale;

  const byDesc = (src: Record<string, number>) => [...codes].sort((a, b) => src[b] - src[a]);
  const rankBefore = byDesc(baseWeights);
  const rankAfter = byDesc(weights);

  return { weights, rankBefore, rankAfter, rankChanged: rankBefore.join('>') !== rankAfter.join('>') };
}
