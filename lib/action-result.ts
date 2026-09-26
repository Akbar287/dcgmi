// docs/03-API-CONTRACTS.md §1.
export type ActionErrorCode =
  | "GATE_BLOCKED"
  | "ORIGIN_MISMATCH"
  | "METHOD_ERROR"
  | "CONTROLLED_EXCEPTION"
  | "PANEL_SIZE_DEVIATION"
  | "FORBIDDEN"
  | "VALIDATION_ERROR"
  | "CONFLICT"
  | "LAST_ADMIN"
  | "NOT_READY"
  | "NOT_ACTIVE"
  | "ALREADY_SUBMITTED";

export type ActionResult<T = null> =
  | { ok: true; data: T }
  | { ok: false; error: { code: ActionErrorCode; message: string; details?: unknown } };

export function fail(code: ActionErrorCode, message: string, details?: unknown): ActionResult<never> {
  return { ok: false, error: { code, message, details } };
}
