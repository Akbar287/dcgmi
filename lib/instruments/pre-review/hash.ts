import { createHash } from "node:crypto";

import type { PlanItem } from "./types";

export function sha256(text: string): string {
  return createHash("sha256").update(text, "utf8").digest("hex");
}

/** Same formula as build_() in the Apps Script: plan + description + data hash. */
export function buildSignature(plan: PlanItem[], description: string, dataSha256: string): string {
  return sha256(JSON.stringify({ plan, description, data: dataSha256 }));
}
