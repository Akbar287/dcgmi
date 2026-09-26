import { hash32 } from "@/lib/fgd/agenda";

import type { Rating } from "../schemas";

// Deterministic MOCK_AI=1 ratings. About one item in eight is "contested" in
// round 1 (low scores from some seats) and converges in later rounds, so the
// Tabel 3.6 paths and the round loop are exercised without network calls.

export function mockRating(seed: number, code: string, seatIndex: number, round: number): Rating {
  const contested = hash32(`${seed}|${code}`) % 8 === 0;
  const h = hash32(`${seed}|${code}|${seatIndex}|${round}`) % 10;
  let relevance: number;
  if (!contested || round >= 3) relevance = h < 6 ? 4 : 3;
  else if (round === 1) relevance = h < 4 ? 2 : h < 7 ? 3 : 4;
  else relevance = h < 1 ? 2 : h < 5 ? 3 : 4;
  const clarityFlag = hash32(`${seed}|${code}|${seatIndex}|clarity|${round}`) % 16 === 0;
  return {
    relevance,
    reason: `[MOCK] Kursi ${seatIndex}: butir ${code} ${relevance >= 3 ? "relevan dengan konstruk" : "kurang tepat untuk konstruk"} menurut bidang saya.`,
    clarityFlag,
    clarityNote: clarityFlag ? `[MOCK] Deskriptor level 3 dan 4 pada ${code} sulit dibedakan.` : null,
  };
}
