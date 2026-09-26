import { describe, expect, it } from 'vitest';
import { evaluateBaselineGate, gatesToReopen } from '../gates';
import type { ArtifactSnapshot } from '../gates';

const goodIndicator = (code: string) => ({
  code,
  hasOperationalDefinition: true,
  rubricLevels: [1, 2, 3, 4, 5],
  mandatoryEvidenceCount: 1,
});

function snapshot(mutate?: (s: ArtifactSnapshot) => void): ArtifactSnapshot {
  const dist = [7, 5, 6, 6, 4, 5, 4, 6];
  let n = 0;
  const s: ArtifactSnapshot = {
    contentLocked: false,
    domains: dist.map((count, d) => ({
      code: `D${d + 1}`,
      aspects: [{ code: `A${d + 1}`, indicators: Array.from({ length: count }, () => goodIndicator(`C${++n}`)) }],
    })),
  };
  // 15 aspek pada baseline; cuplikan ini memakai 8, jadi akan memunculkan peringatan.
  s.domains[0].aspects.push({ code: 'A-extra', indicators: [] });
  s.domains[0].aspects.pop();
  // Controlled exceptions wajib ada.
  s.domains[2].aspects[0].indicators.push(goodIndicator('C20b'));
  s.domains[7].aspects[0].indicators.push(goodIndicator('C42'));
  mutate?.(s);
  return s;
}

describe('G1 baseline', () => {
  it('lolos bila paket penilaian lengkap', () => {
    const r = evaluateBaselineGate(snapshot());
    expect(r.passed).toBe(true);
  });

  it('indikator tanpa rubrik memblokir', () => {
    const r = evaluateBaselineGate(snapshot((s) => { s.domains[0].aspects[0].indicators[0].rubricLevels = []; }));
    expect(r.passed).toBe(false);
    expect(r.unmet.some((u) => u.startsWith('INDICATOR_WITHOUT_RUBRIC'))).toBe(true);
  });

  it('rubrik tidak lengkap 1..5 memblokir', () => {
    const r = evaluateBaselineGate(snapshot((s) => { s.domains[0].aspects[0].indicators[0].rubricLevels = [1, 2, 3, 5]; }));
    expect(r.unmet.some((u) => u.startsWith('RUBRIC_LEVEL_GAP'))).toBe(true);
  });

  it('indikator tanpa bukti wajib memblokir', () => {
    const r = evaluateBaselineGate(snapshot((s) => { s.domains[1].aspects[0].indicators[0].mandatoryEvidenceCount = 0; }));
    expect(r.unmet.some((u) => u.startsWith('INDICATOR_WITHOUT_EVIDENCE'))).toBe(true);
  });

  it('hilangnya controlled exception memblokir', () => {
    const r = evaluateBaselineGate(snapshot((s) => {
      s.domains[2].aspects[0].indicators = s.domains[2].aspects[0].indicators.filter((i) => i.code !== 'C20b');
    }));
    expect(r.unmet).toContain('CONTROLLED_EXCEPTION_MISSING: C20b');
  });

  it('selisih jumlah struktur hanya peringatan, bukan penghalang', () => {
    const r = evaluateBaselineGate(snapshot());
    expect(r.warnings.some((w) => w.startsWith('ASPECT_COUNT_MISMATCH'))).toBe(true);
    expect(r.passed).toBe(true);
  });
});

// G3 Delphi: see delphi-gate.test.ts (per-item evaluator, docs/05 §6).

// G5 AHP: see lock-ahp-gate.test.ts (per-group evaluator, docs/05 §6).

describe('buka ulang gate', () => {
  it('perubahan setelah content lock mengembalikan ke Delphi dan membatalkan AHP', () => {
    expect(gatesToReopen(true)).toEqual(['G3_DELPHI', 'G4_CONTENT_LOCK', 'G5_AHP', 'G6_SCORING']);
    expect(gatesToReopen(false)).toEqual([]);
  });
});
