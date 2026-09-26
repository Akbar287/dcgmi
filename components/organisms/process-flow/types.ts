import type { StageStatus } from "@/lib/process/stages";

export interface StageCheck {
  text: string;
  /** true = met, false = missing, null = informational. */
  ok: boolean | null;
  /** Render as a machine code (unmet gate entries). */
  code?: boolean;
}

/** Everything is translated on the server; the client only lays it out. */
export interface StageView {
  key: string;
  gate: string;
  gateLabel: string;
  title: string;
  version: string;
  status: StageStatus;
  gateStatus: string;
  gateStatusLabel: string;
  inputs: string[];
  outputs: string[];
  gateConditions: string[];
  missing: StageCheck[];
  passedNote: string | null;
  href: string | null;
}
