import { aggregateGeometric, priorityVector } from './ahp';
import { computeItemCvi, computeScaleCvi } from './cvi';
import { MethodError } from './errors';
import { applyFgdDecisionRule } from './fgd';
import { computeAspectScore, computeIndex, evidenceLevelCap } from './scoring';
import type { FgdPositionType, Relevance } from './types';

export interface SelfCheck {
  id: string;
  ok: boolean;
  detail: string;
}

const close = (a: number, b: number, tol = 1e-3) => Math.abs(a - b) <= tol;
const pos = (t: number, r: number, x: number): FgdPositionType[] => [
  ...Array<FgdPositionType>(t).fill('TERIMA'),
  ...Array<FgdPositionType>(r).fill('TERIMA_DENGAN_REVISI'),
  ...Array<FgdPositionType>(x).fill('TOLAK'),
];

/**
 * The docs/05 test vectors, executed by the running app (SPECIFICATION §6.1
 * shown live, not only in CI). Same numbers as the vitest suites.
 */
export function runMethodSelfCheck(): SelfCheck[] {
  const out: SelfCheck[] = [];
  const check = (id: string, fn: () => [boolean, string]) => {
    try {
      const [ok, detail] = fn();
      out.push({ id, ok, detail });
    } catch (e) {
      out.push({ id, ok: false, detail: e instanceof Error ? e.message : String(e) });
    }
  };

  // §2 FGD (Tabel 3.5)
  check('FGD-R', () => {
    const cases: [number, number, number, string][] = [
      [6, 0, 0, 'TERIMA'], [5, 1, 0, 'PERTAHANKAN_SEMENTARA'], [3, 3, 0, 'TIDAK_SEPAKAT'], [2, 4, 0, 'REVISI'], [4, 0, 2, 'PEMBAHASAN_KHUSUS'], [1, 2, 3, 'PEMBAHASAN_KHUSUS'], [3, 2, 1, 'TIDAK_SEPAKAT'],
    ];
    const bad = cases.filter(([t, r, x, want]) => applyFgdDecisionRule(pos(t, r, x)).decision !== want);
    return [bad.length === 0, bad.length ? `gagal: ${bad.map((c) => c.slice(0, 3).join('/')).join(', ')}` : 'F1–F9 (7 kasus)'];
  });

  // §3.5 CVI (panel 8)
  const cvi: [string, Relevance[], number, string][] = [
    ['C1', [4, 4, 4, 4, 4, 3, 3, 3], 1, 'PERTAHANKAN'],
    ['C2', [4, 4, 4, 4, 4, 4, 4, 2], 0.875, 'PERTAHANKAN'],
    ['C3', [4, 4, 4, 4, 4, 4, 2, 2], 0.75, 'REVISI_NILAI_ULANG'],
    ['C4', [4, 4, 3, 3, 2, 2, 2, 2], 0.5, 'REVISI_NILAI_ULANG'],
    ['C5', [3, 2, 2, 2, 2, 1, 1, 1], 0.125, 'HAPUS_DARI_INTI'],
    ['C6', [4, 4, 4, 4, 1, 1, 1, 1], 0.5, 'REVISI_NILAI_ULANG'],
  ];
  for (const [id, ratings, iCvi, decision] of cvi) {
    check(id, () => {
      const r = computeItemCvi({ indicatorCode: id, ratings });
      return [close(r.iCvi, iCvi) && r.decision === decision, `I-CVI ${r.iCvi.toFixed(3)} → ${r.decision}`];
    });
  }
  check('C7', () => {
    const r = computeItemCvi({ indicatorCode: 'C7', ratings: [4, 4, 4, 4, 4, 4, 4, null] });
    return [r.panelDeviation && r.validRaters === 7, `deviasi panel: ${r.validRaters}/8`];
  });
  check('SCVI', () => {
    const r = computeScaleCvi([1, 0.875, 0.875, 1, 0.75].map((iCvi) => ({ iCvi })));
    return [close(r.sCviAve, 0.9, 1e-12) && r.passes, `S-CVI/Ave ${r.sCviAve.toFixed(3)}`];
  });

  // §4.5 AHP
  check('A1', () => {
    const r = priorityVector([[1, 2, 4], [0.5, 1, 2], [0.25, 0.5, 1]]);
    return [close(r.weights[0], 0.5714) && close(r.cr, 0, 1e-9) && r.accepted, `w₁ ${r.weights[0].toFixed(4)}, CR ${r.cr.toFixed(4)}`];
  });
  check('A2', () => {
    const r = priorityVector([[1, 3, 5], [1 / 3, 1, 3], [1 / 5, 1 / 3, 1]]);
    return [close(r.weights[0], 0.637) && close(r.cr, 0.0332) && r.accepted, `w₁ ${r.weights[0].toFixed(4)}, CR ${r.cr.toFixed(4)}`];
  });
  check('A3', () => {
    const r = priorityVector([[1, 9, 1 / 5], [1 / 9, 1, 3], [5, 1 / 3, 1]]);
    return [!r.accepted, `CR ${r.cr.toFixed(3)} → ditolak`];
  });
  check('A4', () => {
    const r = priorityVector(Array.from({ length: 8 }, () => Array(8).fill(1)));
    return [r.weights.every((w) => close(w, 0.125, 1e-9)) && close(r.cr, 0, 1e-9), 'w = 0,125']; 
  });
  check('A5', () => {
    const r = aggregateGeometric([{ seatIndex: 1, matrix: [[1, 3], [1 / 3, 1]] }, { seatIndex: 2, matrix: [[1, 5], [1 / 5, 1]] }]);
    return [close(r.aggregatedMatrix[0][1], Math.sqrt(15), 1e-6), `a₀₁ ${r.aggregatedMatrix[0][1].toFixed(5)}`];
  });

  // §5.4 Scoring
  check('S1', () => {
    const r = computeIndex([{ domainCode: 'D7', weight: 1, aspects: [{ aspectCode: 'A', localWeight: 1, indicators: [3, 4, 3, 2].map((level, i) => ({ indicatorCode: `C${i}`, level, missingKind: 'NONE' as const })) }] }]);
    return [close(r.domainProfile.D7 ?? NaN, 3, 1e-12), `D7 ${r.domainProfile.D7}`];
  });
  check('S2', () => {
    const d = (code: string, level: number, weight: number) => ({ domainCode: code, weight, aspects: [{ aspectCode: `${code}A`, localWeight: 1, indicators: [{ indicatorCode: `${code}1`, level, missingKind: 'NONE' as const }] }] });
    const r = computeIndex([d('D1', 3, 0.5), d('D2', 2, 0.3), d('D3', 4, 0.2)]);
    return [close(r.composite ?? NaN, 2.9, 1e-12), `DCGMI ${r.composite}`];
  });
  check('S3', () => {
    const r = computeIndex([{ domainCode: 'D1', weight: 1, aspects: [{ aspectCode: 'A', localWeight: 1, indicators: [{ indicatorCode: 'X1', level: 4, missingKind: 'NONE' }, { indicatorCode: 'X2', level: null, missingKind: 'MISSING_ADMINISTRATIF' }, { indicatorCode: 'X3', level: 3, missingKind: 'NONE' }] }] }]);
    return [r.composite === null && r.domainProfile.D1 === null && r.missingReport.some((m) => m.indicatorCode === 'X2'), 'komposit null + laporan'];
  });
  check('S4', () => {
    const r = computeAspectScore({ aspectCode: 'A', localWeight: 1, indicators: [{ indicatorCode: 'X1', level: 4, missingKind: 'NONE' }, { indicatorCode: 'X2', level: 1, missingKind: 'TIDAK_ADA_KAPABILITAS' }, { indicatorCode: 'X3', level: 3, missingKind: 'NONE' }] });
    return [close(r.score ?? NaN, 2.6667), `A ${r.score?.toFixed(4)}`];
  });
  check('S5', () => {
    try {
      const d = (code: string, weight: number) => ({ domainCode: code, weight, aspects: [{ aspectCode: `${code}A`, localWeight: 1, indicators: [{ indicatorCode: `${code}1`, level: 3, missingKind: 'NONE' as const }] }] });
      computeIndex([d('D1', 0.5), d('D2', 0.3), d('D3', 0.3)]);
      return [false, 'tidak melempar'];
    } catch (e) {
      return [e instanceof MethodError && e.code === 'WEIGHTS_NOT_NORMALIZED', 'WEIGHTS_NOT_NORMALIZED'];
    }
  });

  // §5.5 evidence cap
  check('E3', () => {
    const cap = evidenceLevelCap([2, 3, 4, 5].map((m, i) => ({ id: `r${i}`, minimumFor: m, mandatory: true })), ['r0', 'r1', 'r3']);
    return [cap === 3, `plafon ${cap}`];
  });

  return out;
}
