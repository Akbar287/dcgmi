import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";

import type { AssessmentPackage } from "./types";

export const PACKAGE_PATH = "docs/DCGMI-Paket-Penilaian-43-Indikator.records.json";

export function loadPackage(path = PACKAGE_PATH): { pkg: AssessmentPackage; sha256: string; path: string } {
  const raw = readFileSync(path, "utf8");
  return { pkg: JSON.parse(raw) as AssessmentPackage, sha256: createHash("sha256").update(raw, "utf8").digest("hex"), path };
}
