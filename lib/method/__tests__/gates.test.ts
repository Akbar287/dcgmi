import { describe, expect, it } from 'vitest';
import { assertGate, evaluateAhpGate, evaluateBaselineGate, evaluateDelphiGate, gatesToReopen } from '../gates';
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

describe('G3 Delphi', () => {
  it('S-CVI di bawah 0,90 memblokir', () => {
    const r = evaluateDelphiGate({ rounds: [{ roundNumber: 2, sCviAve: 0.88, unresolvedItems: [], panelDeviation: false }] });
    expect(r.passed).toBe(false);
    expect(r.unmet[0]).toMatch(/S_CVI_BELOW_THRESHOLD/);
  });
  it('deviasi panel memblokir', () => {
    const r = evaluateDelphiGate({ rounds: [{ roundNumber: 1, sCviAve: 0.95, unresolvedItems: [], panelDeviation: true }] });
    expect(r.unmet).toContain('PANEL_SIZE_DEVIATION');
  });
  it('butir belum selesai sebelum ronde 3 memblokir', () => {
    const r = evaluateDelphiGate({ rounds: [{ roundNumber: 2, sCviAve: 0.95, unresolvedItems: ['C12'], panelDeviation: false }] });
    expect(r.unmet.some((u) => u.startsWith('UNRESOLVED_ITEMS'))).toBe(true);
  });
  it('setelah ronde 3 butir sisa dilaporkan terbuka, tidak memblokir', () => {
    const r = evaluateDelphiGate({ rounds: [{ roundNumber: 3, sCviAve: 0.95, unresolvedItems: ['C12'], panelDeviation: false }] });
    expect(r.passed).toBe(true);
    expect(r.warnings[0]).toMatch(/ITEMS_REPORTED_AS_UNFINISHED/);
  });
});

describe('G5 AHP', () => {
  it('menolak AHP sebelum content lock', () => {
    const r = evaluateAhpGate({ contentLocked: false, matrices: [{ seatIndex: 1, cr: 0.05, accepted: true }], sensitivityRun: true });
    expect(r.unmet).toContain('CONTENT_NOT_LOCKED');
    expect(() => assertGate(r)).toThrowError(/G5_AHP/);
  });
  it('matriks tidak konsisten jadi peringatan, bukan penghalang, selama masih ada yang diterima', () => {
    const r = evaluateAhpGate({
      contentLocked: true,
      matrices: [{ seatIndex: 1, cr: 0.05, accepted: true }, { seatIndex: 2, cr: 0.3, accepted: false }],
      sensitivityRun: true,
    });
    expect(r.passed).toBe(true);
    expect(r.warnings[0]).toMatch(/MATRIX_RETURNED_TO_SEAT/);
  });
  it('semua matriks tidak konsisten memblokir', () => {
    const r = evaluateAhpGate({ contentLocked: true, matrices: [{ seatIndex: 1, cr: 0.3, accepted: false }], sensitivityRun: true });
    expect(r.unmet).toContain('ALL_MATRICES_INCONSISTENT');
  });
  it('sensitivitas wajib dijalankan', () => {
    const r = evaluateAhpGate({ contentLocked: true, matrices: [{ seatIndex: 1, cr: 0.05, accepted: true }], sensitivityRun: false });
    expect(r.unmet).toContain('SENSITIVITY_NOT_RUN');
  });
});

describe('buka ulang gate', () => {
  it('perubahan setelah content lock mengembalikan ke Delphi dan membatalkan AHP', () => {
    expect(gatesToReopen(true)).toEqual(['G3_DELPHI', 'G4_CONTENT_LOCK', 'G5_AHP', 'G6_SCORING']);
    expect(gatesToReopen(false)).toEqual([]);
  });
});
