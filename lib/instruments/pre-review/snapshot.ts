import { buildSignature, sha256 } from "./hash";
import type { PreReviewFormSettings, PreReviewSnapshot } from "./types";
import { validateSource } from "./validate-source";

export function isPreReviewSettings(value: unknown): value is PreReviewFormSettings {
  if (typeof value !== "object" || value === null) return false;
  const v = value as Record<string, unknown>;
  return v.kind === "PRE_REVIEW" && typeof v.signature === "string" && typeof v.snapshot === "string";
}

export function toSettings(snapshot: PreReviewSnapshot): PreReviewFormSettings {
  return { kind: "PRE_REVIEW", signature: snapshot.signature, snapshot: JSON.stringify(snapshot) };
}

export function parseSnapshot(settings: PreReviewFormSettings): PreReviewSnapshot {
  return JSON.parse(settings.snapshot) as PreReviewSnapshot;
}

/** Recomputes every hash from the stored text; any drift is reported, never repaired. */
export function verifySnapshot(settings: PreReviewFormSettings, sourceSha256: string | null): string[] {
  const s = parseSnapshot(settings);
  const issues = validateSource(s.data, s.dataSha256);
  if (sourceSha256 !== s.dataSha256) issues.push("Form.sourceSha256 tidak sama dengan snapshot.");
  if (sha256(JSON.stringify(s.data)) !== s.dataSha256) issues.push("Hash data snapshot berubah.");
  const signature = buildSignature(s.plan, s.description, s.dataSha256);
  if (signature !== s.signature || signature !== settings.signature) issues.push("Signature build berubah.");
  return issues;
}
