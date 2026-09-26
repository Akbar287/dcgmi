import { describe, expect, it } from 'vitest';

import { evaluateScoringGate, type ScoringGateAssessment } from '../gates';
import { evidenceLevelCap } from '../scoring';

// docs/05 §5.5 and §6 G6_SCORING (researcher decision 26 Sep 2026).
const req = (id: string, minimumFor: number | null, mandatory = true) => ({ id, minimumFor, mandatory });
const ladder = [req('a', 2), req('b', 3), req('c', 4), req('d', 5)];

describe('evidenceLevelCap — level tertinggi yang seluruh bukti wajibnya terpenuhi', () => {
  it('E1 bukti level 2 dan 3 terpenuhi → 3', () => expect(evidenceLevelCap(ladder, ['a', 'b'])).toBe(3));
  it('E2 tanpa bukti → 1 (lantai skala)', () => expect(evidenceLevelCap(ladder, [])).toBe(1));
  it('E3 celah di level 4 menghentikan tangga meski level 5 terpenuhi → 3', () => expect(evidenceLevelCap(ladder, ['a', 'b', 'd'])).toBe(3));
  it('E4 bukti penguat tidak membatasi → 5', () => expect(evidenceLevelCap([req('a', 2), req('x', 3, false)], ['a'])).toBe(5));
  it('E5 bukti wajib tanpa minimumFor berlaku sejak level 1 → tidak terpenuhi tetap 1', () => {
    expect(evidenceLevelCap([req('n', null), req('a', 2)], ['a'])).toBe(1);
    expect(evidenceLevelCap([req('n', null), req('a', 2)], ['n', 'a'])).toBe(5);
  });
});

const done = (id: string, over: Partial<ScoringGateAssessment> = {}): ScoringGateAssessment => ({
  id,
  status: 'COMPLETED',
  weightsSessionId: 'S1',
  missingAdmin: false,
  noCapability: false,
  compositeNull: false,
  missingReportCount: 0,
  ...over,
});
const withCases = [done('A1', { missingAdmin: true, compositeNull: true, missingReportCount: 1 }), done('A2', { noCapability: true })];
const recompute = { exportSha256: 'x', ok: true, diffCount: 0 };
const base = { contentLocked: true, g5Passed: true, weightsSessionId: 'S1', assessments: withCases, recompute, currentExportSha256: 'x' };

describe('G6_SCORING', () => {
  it('G6-1 kasus data hilang lengkap, rekalkulasi identik dan mutakhir → lulus', () => {
    expect(evaluateScoringGate(base).passed).toBe(true);
  });
  it('G6-2 G5 belum lulus → G5_NOT_PASSED', () => {
    expect(evaluateScoringGate({ ...base, g5Passed: false }).unmet).toEqual(['G5_NOT_PASSED']);
  });
  it('G6-3 belum ada asesmen selesai → NO_ASSESSMENT', () => {
    expect(evaluateScoringGate({ ...base, assessments: [] }).unmet).toContain('NO_ASSESSMENT');
  });
  it('G6-4 asesmen belum selesai → ASSESSMENT_PENDING', () => {
    expect(evaluateScoringGate({ ...base, assessments: [...withCases, done('A3', { status: 'FAILED' })] }).unmet).toEqual(['ASSESSMENT_PENDING: 1']);
  });
  it('G6-5 bobot bukan dari sesi G5 → WEIGHTS_STALE', () => {
    expect(evaluateScoringGate({ ...base, assessments: [...withCases, done('A3', { weightsSessionId: 'S0' })] }).unmet).toEqual(['WEIGHTS_STALE: A3']);
  });
  it('G6-6 tanpa kasus MISSING_ADMINISTRATIF dan TIDAK_ADA_KAPABILITAS → memblokir', () => {
    expect(evaluateScoringGate({ ...base, assessments: [done('A1')] }).unmet).toEqual(['MISSING_ADMIN_CASE_ABSENT', 'NO_CAPABILITY_CASE_ABSENT']);
  });
  it('G6-7 missing administratif yang tidak menahan komposit → MISSING_NOT_PROPAGATED', () => {
    const e = evaluateScoringGate({ ...base, assessments: [done('A1', { missingAdmin: true, compositeNull: false, missingReportCount: 1 }), done('A2', { noCapability: true })] });
    expect(e.unmet).toEqual(['MISSING_NOT_PROPAGATED: A1']);
  });
  it('G6-8 rekalkulasi belum ada / usang / berbeda', () => {
    expect(evaluateScoringGate({ ...base, recompute: null }).unmet).toEqual(['RECOMPUTE_NOT_RUN']);
    expect(evaluateScoringGate({ ...base, currentExportSha256: 'y' }).unmet).toEqual(['RECOMPUTE_STALE']);
    expect(evaluateScoringGate({ ...base, recompute: { exportSha256: 'x', ok: false, diffCount: 2 } }).unmet).toEqual(['RECOMPUTE_DIFFERENCES: 2']);
  });
  it('G6-9 hierarki tidak terkunci → CONTENT_NOT_LOCKED', () => {
    expect(evaluateScoringGate({ ...base, contentLocked: false }).unmet).toEqual(['CONTENT_NOT_LOCKED']);
  });
});
