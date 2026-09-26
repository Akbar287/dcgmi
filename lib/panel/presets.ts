import { METHOD } from "@/lib/method/constants";

export const EXPERT_FIELDS = ["IT_GOVERNANCE", "MANAJEMEN_PT", "SPBE", "SUSTAINABILITY"] as const;
export type ExpertField = (typeof EXPERT_FIELDS)[number];

export interface PanelPreset {
  size: number;
  /** Seats per field, new members included. */
  composition: Record<ExpertField, number>;
  /** Seats per field that are new members without FGD context in round 1. */
  newMembers: Partial<Record<ExpertField, number>>;
  reference: string;
}

// Panel design, not a tunable threshold: sizes come from METHOD, field mix from
// R1-V1.7 (researcher decision 2026-09-26 to keep it here, not in constants.ts).
export const PANEL_PRESETS: Record<string, PanelPreset> = {
  // §3.7.1: 2 IT governance, 2 manajemen PT, 1 SPBE, 1 sustainability.
  FGD_6: {
    size: METHOD.FGD_PANEL_SIZE,
    composition: { IT_GOVERNANCE: 2, MANAJEMEN_PT: 2, SPBE: 1, SUSTAINABILITY: 1 },
    newMembers: {},
    reference: "R1–V1.7 §3.7.1",
  },
  // §3.8.1: the six FGD seats plus one new SPBE and one new sustainability expert.
  DELPHI_8: {
    size: METHOD.DELPHI_PANEL_SIZE,
    composition: { IT_GOVERNANCE: 2, MANAJEMEN_PT: 2, SPBE: 2, SUSTAINABILITY: 2 },
    newMembers: { SPBE: 1, SUSTAINABILITY: 1 },
    reference: "R1–V1.7 §3.8.1",
  },
};
