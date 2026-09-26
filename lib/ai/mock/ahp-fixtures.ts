import { hash32 } from "@/lib/fgd/agenda";

import type { Pairwise } from "../schemas";

// Deterministic MOCK_AI=1 judgements. Each seat holds hidden weights per
// group; its answers follow them, except that about one seat-group in four
// flips two pairs on the first fill (CR >= 0.10), and a review answers from
// the hidden weights again — exercising the return-to-seat loop.

/** hash32 finalised (murmur3 fmix32): FNV-1a modulo a power of two only sees the low bits of each character. */
function mix(text: string) {
  let h = hash32(text);
  h ^= h >>> 16;
  h = Math.imul(h, 0x85ebca6b);
  h ^= h >>> 13;
  h = Math.imul(h, 0xc2b2ae35);
  h ^= h >>> 16;
  return h >>> 0;
}

function hiddenWeight(seed: number, seatIndex: number, group: string, code: string) {
  return 1 + (mix(`${seed}|${seatIndex}|${group}|${code}`) % 8);
}

function toPair(ratio: number): Pick<Pairwise, "preferred" | "intensity"> {
  const r = ratio >= 1 ? ratio : 1 / ratio;
  const intensity = Math.min(9, Math.max(1, Math.round(r)));
  if (intensity === 1) return { preferred: "EQUAL", intensity: 1 };
  return { preferred: ratio >= 1 ? "A" : "B", intensity };
}

export function mockPairwise(seed: number, seatIndex: number, group: string, a: string, b: string, pairIndex: number, attempt: number): Pairwise {
  const ratio = hiddenWeight(seed, seatIndex, group, a) / hiddenWeight(seed, seatIndex, group, b);
  const noisy = attempt === 0 && mix(`${seed}|${seatIndex}|${group}|noisy`) % 4 === 0 && pairIndex < 2;
  const base = toPair(noisy ? 1 / (ratio * 7) : ratio);
  return { ...base, reason: `[MOCK] Kursi ${seatIndex}: ${a} vs ${b} menurut prioritas bidang saya.` };
}
