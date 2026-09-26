import { METHOD } from './constants';
import { MethodError } from './errors';
import type { FgdDecision, FgdPositionType, FgdRuleId, FgdTally } from './types';

export function tallyPositions(positions: FgdPositionType[]): FgdTally {
  if (positions.length === 0) {
    throw new MethodError('EMPTY_INPUT', 'Tidak ada posisi panel untuk direkap');
  }
  const t: FgdTally = {
    TERIMA: 0,
    TERIMA_DENGAN_REVISI: 0,
    TOLAK: 0,
    total: positions.length,
    nonAccept: 0,
  };
  for (const p of positions) t[p] += 1;
  t.nonAccept = t.total - t.TERIMA;
  return t;
}

/**
 * Aturan keputusan FGD — R1-V1.7 Tabel 3.5.
 *
 * Urutan evaluasi penting. "≥2 tolak" dievaluasi lebih dulu karena memicu
 * pembahasan khusus SEBELUM tindakan ditetapkan (§3.7.3). Aturan lain yang
 * juga terpenuhi dicatat di `alsoTriggered`, tidak dibuang.
 *
 * Aturan ini membantu pengambilan keputusan dan TIDAK mengubah FGD menjadi
 * uji validitas.
 */
export function applyFgdDecisionRule(positions: FgdPositionType[]): FgdDecision {
  const tally = tallyPositions(positions);
  const fired: FgdRuleId[] = [];

  if (tally.TOLAK >= METHOD.FGD_SPECIAL_REJECT_MIN) fired.push('GE2_TOLAK');
  if (tally.nonAccept >= METHOD.FGD_REVISE_NON_ACCEPT_MIN) fired.push('GE4_NON_TERIMA');
  if (tally.TERIMA * 2 === tally.total && tally.nonAccept * 2 === tally.total) {
    fired.push('SPLIT_3_3');
  }
  if (tally.nonAccept >= 1 && tally.nonAccept <= 2) fired.push('NOTES_1_2');
  if (tally.nonAccept === 0) fired.push('ALL_ACCEPT');

  const order: FgdRuleId[] = ['GE2_TOLAK', 'GE4_NON_TERIMA', 'SPLIT_3_3', 'NOTES_1_2', 'ALL_ACCEPT'];
  const ruleFired = order.find((r) => fired.includes(r)) ?? 'ALL_ACCEPT';

  const decisionByRule: Record<FgdRuleId, FgdDecision['decision']> = {
    GE2_TOLAK: 'PEMBAHASAN_KHUSUS',
    GE4_NON_TERIMA: 'REVISI',
    SPLIT_3_3: 'TIDAK_SEPAKAT',
    NOTES_1_2: 'PERTAHANKAN_SEMENTARA',
    ALL_ACCEPT: 'TERIMA',
  };

  return {
    decision: decisionByRule[ruleFired],
    ruleFired,
    tally,
    alsoTriggered: fired.filter((r) => r !== ruleFired),
  };
}

/** Saran yang tidak diadopsi wajib punya alasan eksplisit (Tabel 3.5, baris terakhir). */
export function validateSuggestionAdoption(s: {
  adopted: boolean | null;
  notAdoptedReason?: string | null;
}): { ok: boolean; issue?: string } {
  if (s.adopted === false && !s.notAdoptedReason?.trim()) {
    return { ok: false, issue: 'Saran yang tidak diadopsi wajib mencantumkan alasan eksplisit' };
  }
  return { ok: true };
}
