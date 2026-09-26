import { METHOD } from './constants';
import { MethodError } from './errors';
import type {
  AspectScoreInput,
  DomainScoreInput,
  IndicatorScoreInput,
  MissingEntry,
  ScoringResult,
} from './types';

function assertWeightsNormalized(weights: number[], context: string): void {
  const sum = weights.reduce((a, b) => a + b, 0);
  if (Math.abs(sum - 1) > METHOD.WEIGHT_SUM_TOLERANCE) {
    throw new MethodError('WEIGHTS_NOT_NORMALIZED', `Jumlah bobot ${context} adalah ${sum}, seharusnya 1`, { sum, context });
  }
}

function assertLevel(ind: IndicatorScoreInput): void {
  if (ind.level === null) return;
  if (!Number.isInteger(ind.level) || ind.level < METHOD.LEVEL_MIN || ind.level > METHOD.LEVEL_MAX) {
    throw new MethodError('INVALID_LEVEL', `Level tidak sah pada ${ind.indicatorCode}: ${ind.level}`);
  }
}

/**
 * A(i,j) = (1/n) * sum r(i,j,k)
 *
 * Satu indikator MISSING_ADMINISTRATIF menahan skor aspek seluruhnya.
 * Tidak ada imputasi rerata dan tidak ada pengurangan penyebut — aspek
 * menjadi null (R1-V1.7 §3.10.1).
 *
 * TIDAK_ADA_KAPABILITAS berbeda: itu kondisi nyata institusi dan diskor
 * sesuai rubrik (umumnya level 1).
 */
export function computeAspectScore(aspect: AspectScoreInput): {
  score: number | null;
  missing: MissingEntry[];
} {
  if (aspect.indicators.length === 0) {
    throw new MethodError('EMPTY_INPUT', `Aspek ${aspect.aspectCode} tidak memiliki indikator`);
  }

  const missing: MissingEntry[] = [];
  const levels: number[] = [];

  for (const ind of aspect.indicators) {
    assertLevel(ind);
    if (ind.missingKind === 'MISSING_ADMINISTRATIF') {
      missing.push({
        indicatorCode: ind.indicatorCode,
        kind: ind.missingKind,
        blocks: aspect.aspectCode,
      });
      continue;
    }
    if (ind.level === null) {
      throw new MethodError('INVALID_LEVEL', `${ind.indicatorCode} tanpa level harus ditandai MISSING_ADMINISTRATIF`);
    }
    levels.push(ind.level);
  }

  if (missing.length > 0) return { score: null, missing };
  return { score: levels.reduce((a, b) => a + b, 0) / levels.length, missing };
}

/** D(i) = sum w(j|i) * A(i,j). Aspek tunggal berbobot lokal 1. */
export function computeDomainScore(domain: DomainScoreInput): {
  score: number | null;
  aspectScores: Record<string, number | null>;
  missing: MissingEntry[];
} {
  if (domain.aspects.length === 0) {
    throw new MethodError('EMPTY_INPUT', `Domain ${domain.domainCode} tidak memiliki aspek`);
  }
  assertWeightsNormalized(domain.aspects.map((a) => a.localWeight), `aspek dalam ${domain.domainCode}`);

  const aspectScores: Record<string, number | null> = {};
  const missing: MissingEntry[] = [];
  let total = 0;
  let blocked = false;

  for (const aspect of domain.aspects) {
    const { score, missing: m } = computeAspectScore(aspect);
    aspectScores[aspect.aspectCode] = score;
    missing.push(...m.map((x) => ({ ...x, blocks: `${aspect.aspectCode} -> ${domain.domainCode}` })));
    if (score === null) blocked = true;
    else total += aspect.localWeight * score;
  }

  return { score: blocked ? null : total, aspectScores, missing };
}

/**
 * DCGMI = sum w(i) * D(i).
 *
 * Keluaran utama adalah profil delapan domain; komposit hanya ringkasan
 * sekunder dan berstatus PROVISIONAL sampai distribusi memadai tersedia
 * (R1-V1.7 §3.10.3). Lapisan UI tidak boleh merender `composite` tanpa
 * `domainProfile` di layar yang sama.
 */
export function computeIndex(domains: DomainScoreInput[]): ScoringResult {
  if (domains.length === 0) throw new MethodError('EMPTY_INPUT', 'Tidak ada domain untuk dihitung');
  assertWeightsNormalized(domains.map((d) => d.weight), 'domain');

  const domainProfile: Record<string, number | null> = {};
  const aspectScores: Record<string, number | null> = {};
  const missingReport: MissingEntry[] = [];
  let composite: number | null = 0;

  for (const domain of domains) {
    const r = computeDomainScore(domain);
    domainProfile[domain.domainCode] = r.score;
    Object.assign(aspectScores, r.aspectScores);
    missingReport.push(...r.missing);
    if (r.score === null) composite = null;
    else if (composite !== null) composite += domain.weight * r.score;
  }

  return { aspectScores, domainProfile, composite, compositeStatus: 'PROVISIONAL', missingReport };
}

/** Bobot lokal seragam — dipakai sebelum AHP menghasilkan bobot. */
export function uniformLocalWeights(count: number): number[] {
  if (count <= 0) throw new MethodError('EMPTY_INPUT', 'Jumlah harus positif');
  const out = new Array<number>(count).fill(1 / count);
  // Elemen terakhir diambil dari sisa penjumlahan berurutan agar totalnya
  // tepat 1 pada aritmetika IEEE-754, bukan 0,9999999999999999.
  let acc = 0;
  for (let i = 0; i < count - 1; i++) acc += out[i];
  out[count - 1] = 1 - acc;
  return out;
}

/**
 * Evidence-to-level (SPECIFICATION §4.8, docs/05 §5.5): the highest level L
 * for which every MANDATORY requirement with minimumFor ≤ L is satisfied.
 * A requirement without minimumFor applies from LEVEL_MIN. Supporting
 * (non-mandatory) evidence never caps. The scale floor is LEVEL_MIN. Whether
 * the descriptor fits is the assessor's judgement; this is only the ceiling.
 */
export function evidenceLevelCap(
  requirements: { id: string; minimumFor: number | null; mandatory: boolean }[],
  satisfiedIds: string[],
): number {
  const satisfied = new Set(satisfiedIds);
  let cap = METHOD.LEVEL_MIN;
  for (let level = METHOD.LEVEL_MIN; level <= METHOD.LEVEL_MAX; level++) {
    const needed = requirements.filter((r) => r.mandatory && (r.minimumFor ?? METHOD.LEVEL_MIN) <= level);
    if (needed.every((r) => satisfied.has(r.id))) cap = level;
    else break;
  }
  return cap;
}
