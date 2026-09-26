/** Optional positive USD amount from a form field; null when empty (docs/04 §9). */
export function parseBudget(value: FormDataEntryValue | null): { ok: true; value: number | null } | { ok: false } {
  if (value === null || value === "") return { ok: true, value: null };
  const v = Number(String(value).replace(",", "."));
  return Number.isFinite(v) && v > 0 && v < 1_000_000 ? { ok: true, value: v } : { ok: false };
}
