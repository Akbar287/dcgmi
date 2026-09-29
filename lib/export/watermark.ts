// docs/07 P4 — export watermark that cannot be switched off. There is no
// parameter to disable it: whether it applies is derived from the data
// origin alone. Pure module (no I/O) so the rule is unit-tested.

export const WATERMARK =
  "KELUARAN SIMULASI — controlled dry-run internal. Bukan data penelitian. Tidak boleh dilaporkan sebagai hasil FGD, Delphi, validitas isi, AHP, atau uji institusional. R1–V1.7 §3.12, §4.3.";

export type ExportOrigin = "SIMULATED" | "REAL" | "MIXED" | "NONE";

/** Modules whose screens are simulation context even without an origin column. */
export const SIMULATED_MODULES = new Set(["fgd", "delphi", "ahp", "scoring", "runs", "audit", "panel"]);

export function exportOrigin(origins: (string | null | undefined)[], module: string): ExportOrigin {
  const set = new Set(origins.filter((o): o is string => o === "SIMULATED" || o === "REAL"));
  if (set.size > 1) return "MIXED";
  if (set.has("REAL")) return "REAL";
  if (set.has("SIMULATED") || SIMULATED_MODULES.has(module)) return "SIMULATED";
  return "NONE";
}

/** Anything not verifiably REAL-only carries the watermark. */
export const needsWatermark = (origin: ExportOrigin) => origin !== "REAL";

export function exportFilename(base: string, ext: "csv" | "xlsx" | "json" | "pdf", origin: ExportOrigin) {
  const safe = base.replace(/[^A-Za-z0-9._-]+/g, "_");
  if (!needsWatermark(origin)) return `${safe}.${ext}`;
  // docs/07 §3.1: every simulated export starts with SIM_; CSV also ends with _SIMULATED.
  return `SIM_${safe}${ext === "csv" ? "_SIMULATED" : ""}.${ext}`;
}

export type Cell = string | number | boolean | null;

/** Keeps text from becoming a spreadsheet formula (same rule as the pre-review export). */
export function safeCell(v: Cell): Cell {
  return typeof v === "string" && /^[\s]*[=+@-]/.test(v) ? `'${v}` : v;
}

const csvCell = (v: Cell) => {
  if (v === null) return "";
  const s = String(safeCell(v));
  return /[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
};

export function toCsv(headers: string[], rows: Cell[][], origin: ExportOrigin): string {
  const lines: string[] = [];
  if (needsWatermark(origin)) {
    lines.push(`# ${WATERMARK.split(". ")[0]}.`, `# ${WATERMARK.split(". ").slice(1).join(". ")}`, `# _dataOrigin=${origin}`);
  }
  lines.push(headers.map(csvCell).join(","));
  for (const r of rows) lines.push(r.map(csvCell).join(","));
  return `${lines.join("\n")}\n`;
}

export function toJson(meta: Record<string, unknown>, columns: string[], rows: Record<string, Cell>[], origin: ExportOrigin): string {
  const doc = needsWatermark(origin) ? { _warning: WATERMARK, _dataOrigin: origin, ...meta, columns, rows } : { _dataOrigin: origin, ...meta, columns, rows };
  return `${JSON.stringify(doc, null, 2)}\n`;
}

/** XLSX sheet naming: SIM_ prefix, ≤ 31 characters, no []:*?/\ characters. */
export function sheetName(base: string, origin: ExportOrigin) {
  const clean = base.replace(/[[\]:*?/\\]/g, "_");
  return (needsWatermark(origin) ? `SIM_${clean}` : clean).slice(0, 31);
}
