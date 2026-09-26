import { MethodError } from './errors';

/**
 * Kuantil tipe 7 (interpolasi linier) — default R, NumPy, dan Excel PERCENTILE.
 * Dipilih secara eksplisit agar skrip rekalkulasi independen menghasilkan
 * angka identik (R1-V1.7 §3.14). Jangan ganti definisinya diam-diam.
 */
export function quantileType7(sorted: number[], p: number): number {
  if (sorted.length === 0) throw new MethodError('EMPTY_INPUT', 'Tidak ada nilai untuk dikuantilkan');
  if (sorted.length === 1) return sorted[0];
  const h = (sorted.length - 1) * p;
  const lo = Math.floor(h);
  const hi = Math.ceil(h);
  if (lo === hi) return sorted[lo];
  return sorted[lo] + (h - lo) * (sorted[hi] - sorted[lo]);
}

export function median(values: number[]): number {
  const sorted = [...values].sort((a, b) => a - b);
  return quantileType7(sorted, 0.5);
}

export function iqr(values: number[]): number {
  const sorted = [...values].sort((a, b) => a - b);
  return quantileType7(sorted, 0.75) - quantileType7(sorted, 0.25);
}

export function mean(values: number[]): number {
  if (values.length === 0) throw new MethodError('EMPTY_INPUT', 'Tidak ada nilai untuk dirata-rata');
  return values.reduce((a, b) => a + b, 0) / values.length;
}

export function geometricMean(values: number[]): number {
  if (values.length === 0) throw new MethodError('EMPTY_INPUT', 'Tidak ada nilai');
  if (values.some((v) => v <= 0)) {
    throw new MethodError('MATRIX_NON_POSITIVE', 'Rata-rata geometris memerlukan nilai positif');
  }
  // Lewat ruang log agar tidak overflow pada deret panjang.
  const logSum = values.reduce((acc, v) => acc + Math.log(v), 0);
  return Math.exp(logSum / values.length);
}

/** Pembulatan untuk tampilan saja. Jangan dipakai sebelum perbandingan ambang. */
export function round(value: number, digits = 6): number {
  const f = 10 ** digits;
  return Math.round(value * f) / f;
}
