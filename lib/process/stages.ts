import type { GateKey } from "@/lib/method/gates";

// Research stages and their gates (SPECIFICATION §3). Texts live in i18n under
// `process.stages.<stage>`; `items` lists the keys each block renders, in order.
export const STAGES = [
  { stage: "BASELINE", gate: "G1_BASELINE", href: "/artefak/indikator", items: { inputs: ["a", "b"], outputs: ["a", "b"], gate: ["a", "b"] } },
  { stage: "FGD", gate: "G2_FGD", href: "/fgd/sesi", items: { inputs: ["a", "b", "c", "d", "e"], outputs: ["a", "b", "c", "d"], gate: ["a"] } },
  { stage: "DELPHI_CVI", gate: "G3_DELPHI", href: "/delphi/ronde", items: { inputs: ["a", "b", "c"], outputs: ["a", "b", "c"], gate: ["a", "b"] } },
  { stage: "CONTENT_LOCK", gate: "G4_CONTENT_LOCK", href: "/artefak/versi", items: { inputs: ["a"], outputs: ["a", "b"], gate: ["a"] } },
  { stage: "AHP", gate: "G5_AHP", href: "/ahp/konfigurasi", items: { inputs: ["a", "b", "c"], outputs: ["a", "b", "c"], gate: ["a"] } },
  { stage: "SCORING", gate: "G6_SCORING", href: "/scoring/asesmen", items: { inputs: ["a", "b", "c"], outputs: ["a", "b", "c"], gate: ["a"] } },
  { stage: "PILOT", gate: "G7_PILOT", href: null, items: { inputs: ["a", "b"], outputs: ["a"], gate: ["a"] } },
] as const satisfies readonly {
  stage: string;
  gate: GateKey;
  href: string | null;
  items: { inputs: readonly string[]; outputs: readonly string[]; gate: readonly string[] };
}[];

export type StageKey = (typeof STAGES)[number]["stage"];

export type StageStatus = "DONE" | "CURRENT" | "UPCOMING";

/**
 * The current stage is the first whose gate is not PASSED (SPECIFICATION §3:
 * stage N+1 refuses to run until gate N passes). Earlier stages are done.
 */
export function stageStatuses(gateStatus: Partial<Record<GateKey, string>>): StageStatus[] {
  const current = STAGES.findIndex((s) => gateStatus[s.gate] !== "PASSED");
  return STAGES.map((_, i) => (current === -1 || i < current ? "DONE" : i === current ? "CURRENT" : "UPCOMING"));
}
