import { METHOD } from './constants';
import { MethodError } from './errors';
import { iqr as computeIqr, mean, median as computeMedian } from './stats';
import type { ItemCviInput, ItemCviResult, Relevance, ScaleCviResult } from './types';

function validRatings(ratings: Relevance[]): number[] {
  const valid: number[] = [];
  for (const r of ratings) {
    if (r === null || r === undefined) continue;
    if (!Number.isInteger(r) || r < METHOD.RELEVANCE_MIN || r > METHOD.RELEVANCE_MAX) {
      throw new MethodError('INVALID_RELEVANCE', `Skor relevansi tidak sah: ${String(r)}`, { r });
    }
    valid.push(r);
  }
  return valid;
}

/**
 * I-CVI = (jumlah penilai yang memberi skor 3 atau 4) / (jumlah penilai valid).
 *
 * Penyebut adalah penilai yang BENAR-BENAR mengisi. Sel kosong tidak
 * diimputasi sebagai skor rendah (R1-V1.7 §3.8.3).
 */
export function computeICvi(ratings: Relevance[]): { iCvi: number; validRaters: number } {
  const valid = validRatings(ratings);
  if (valid.length === 0) {
    throw new MethodError('EMPTY_INPUT', 'Tidak ada penilai valid untuk butir ini');
  }
  const relevant = valid.filter((r) => METHOD.RELEVANT_SCORES.includes(r)).length;
  return { iCvi: relevant / valid.length, validRaters: valid.length };
}

/**
 * Keputusan per butir — R1-V1.7 Tabel 3.6.
 *
 * Bila jumlah penilai valid tidak sama dengan ukuran panel yang direncanakan,
 * fungsi ini menandai `panelDeviation`. Pemanggil WAJIB menghentikan ronde dan
 * melaporkan deviasi, bukan menerapkan aturan 7/8 secara otomatis (§3.8.3).
 */
export function computeItemCvi(
  input: ItemCviInput,
  plannedPanelSize: number = METHOD.DELPHI_PANEL_SIZE,
): ItemCviResult {
  const { iCvi, validRaters } = computeICvi(input.ratings);
  const valid = validRatings(input.ratings);
  const med = computeMedian(valid);
  const spread = computeIqr(valid);
  const panelDeviation = validRaters !== plannedPanelSize;

  const reasons: string[] = [];
  let decision: ItemCviResult['decision'];

  if (input.constructConflict || iCvi < METHOD.I_CVI_REVISE_MIN) {
    decision = 'HAPUS_DARI_INTI';
    if (input.constructConflict) reasons.push('Konflik konstruk mendasar');
    if (iCvi < METHOD.I_CVI_REVISE_MIN) reasons.push(`I-CVI ${iCvi.toFixed(3)} < ${METHOD.I_CVI_REVISE_MIN}`);
  } else if (iCvi >= METHOD.I_CVI_MIN && med >= METHOD.MEDIAN_MIN && spread <= METHOD.IQR_MAX && !input.clarityCritical) {
    decision = 'PERTAHANKAN';
    reasons.push(`I-CVI ${iCvi.toFixed(3)} >= ${METHOD.I_CVI_MIN}`, `median ${med} >= ${METHOD.MEDIAN_MIN}`, `IQR ${spread} <= ${METHOD.IQR_MAX}`);
  } else {
    decision = 'REVISI_NILAI_ULANG';
    if (iCvi < METHOD.I_CVI_MIN) reasons.push(`I-CVI ${iCvi.toFixed(3)} < ${METHOD.I_CVI_MIN}`);
    if (med < METHOD.MEDIAN_MIN) reasons.push(`median ${med} < ${METHOD.MEDIAN_MIN}`);
    if (spread > METHOD.IQR_MAX) reasons.push(`IQR ${spread} > ${METHOD.IQR_MAX}`);
    if (input.clarityCritical) reasons.push('Isu kejelasan kritis');
  }

  // Setelah ronde terakhir, butir yang belum memenuhi dikeluarkan dari inti
  // dan dilaporkan terbuka (Tabel 3.6 baris terakhir).
  if ((input.round ?? 1) >= METHOD.MAX_ROUNDS && decision === 'REVISI_NILAI_ULANG') {
    decision = 'TIDAK_SELESAI';
    reasons.push(`Belum memenuhi kriteria setelah ronde ${METHOD.MAX_ROUNDS}`);
  }

  if (panelDeviation) {
    reasons.unshift(`DEVIASI PANEL: ${validRaters} penilai valid dari rencana ${plannedPanelSize}`);
  }

  return {
    indicatorCode: input.indicatorCode,
    iCvi,
    median: med,
    iqr: spread,
    validRaters,
    plannedPanelSize,
    panelDeviation,
    decision,
    reasons,
  };
}

/**
 * S-CVI/Ave = rata-rata I-CVI seluruh butir pada ronde tersebut.
 *
 * Nilai ini tidak boleh dinaikkan dengan menghapus butir secara mekanis
 * (R1-V1.7 §3.8.2). Penegakannya ada di lapisan aplikasi: setiap keputusan
 * HAPUS_DARI_INTI wajib menyertakan alasan konstruk.
 */
export function computeScaleCvi(items: { iCvi: number }[]): ScaleCviResult {
  if (items.length === 0) throw new MethodError('EMPTY_INPUT', 'Tidak ada butir untuk dihitung');
  const sCviAve = mean(items.map((i) => i.iCvi));
  return { sCviAve, itemCount: items.length, passes: sCviAve >= METHOD.S_CVI_AVE_MIN };
}

/** Butir yang dibawa ke ronde berikutnya: yang belum selesai + butir baru. */
export function itemsForNextRound(results: ItemCviResult[]): string[] {
  return results.filter((r) => r.decision === 'REVISI_NILAI_ULANG').map((r) => r.indicatorCode);
}

/** Paket umpan balik antar-ronde. Tanpa identitas (R1-V1.7 §3.13.2). */
export function buildRoundFeedback(
  ratings: Relevance[],
  seatIndex: number,
): { own: number | null; median: number; iqr: number; distribution: number[] } {
  const valid = validRatings(ratings);
  const distribution = [0, 0, 0, 0];
  for (const r of valid) distribution[r - 1] += 1;
  const own = ratings[seatIndex - 1];
  return {
    own: own ?? null,
    median: computeMedian(valid),
    iqr: computeIqr(valid),
    distribution,
  };
}
