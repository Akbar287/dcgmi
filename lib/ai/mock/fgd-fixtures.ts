import { hash32 } from "@/lib/fgd/agenda";

import type { NoteExtraction, Vote } from "../schemas";

// Deterministic stand-ins for MOCK_AI=1. Every text is marked [MOCK] so a mock
// transcript can never be mistaken for model output, let alone for data.

export type MockStance = "TERIMA" | "TERIMA_DENGAN_REVISI" | "TOLAK";

export function mockStance(seed: number, seatIndex: number, targetCode: string): MockStance {
  const h = hash32(`${seed}|${seatIndex}|${targetCode}`) % 12;
  return h < 7 ? "TERIMA" : h < 11 ? "TERIMA_DENGAN_REVISI" : "TOLAK";
}

const SUGGESTION = "Usulan: rumuskan ulang definisi operasional agar bukti minimumnya dapat diverifikasi di PT Indonesia.";

export function mockPresentation(componentTitle: string): string {
  return `[MOCK] Fasilitator menyajikan ${componentTitle}. Probe: apakah ada tumpang tindih konstruk, dan bukti mana yang sulit diperoleh perguruan tinggi Indonesia?`;
}

export function mockArgument(label: string, field: string, componentTitle: string, stance: MockStance): string {
  if (stance === "TERIMA") return `[MOCK] ${label} (${field}): komponen ${componentTitle} cukup jelas dan dapat dinilai dari sudut pandang bidang saya.`;
  const concern = stance === "TOLAK" ? "konstruknya tumpang tindih dengan komponen lain" : "buktinya belum cukup spesifik";
  return `[MOCK] ${label} (${field}): pada ${componentTitle}, ${concern}. ${SUGGESTION}`;
}

export function mockCrossTalk(label: string): string {
  return `[MOCK] ${label}: sependapat sebagian dengan panel; pandangan saya tidak berubah.`;
}

export function mockVote(stance: MockStance): Vote {
  return {
    position: stance,
    reason:
      stance === "TERIMA"
        ? "[MOCK] Komponen dapat dipakai sebagaimana adanya menurut argumen saya."
        : "[MOCK] Komponen perlu perbaikan sesuai argumen yang saya sampaikan.",
    proposedAction: stance === "TERIMA" ? null : stance === "TOLAK" ? "GABUNG" : "RUMUS_ULANG",
  };
}

export function mockNotes(transcript: { seatIndex: number; text: string }[]): NoteExtraction {
  return {
    suggestions: transcript
      .filter((u) => u.text.includes(SUGGESTION))
      .map((u) => ({ seatIndex: u.seatIndex, action: "RUMUS_ULANG" as const, quote: SUGGESTION, rationale: "[MOCK] Bukti perlu dapat diverifikasi." })),
  };
}
