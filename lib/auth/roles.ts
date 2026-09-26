import { ForbiddenError } from "./errors";

export const ROLES = ["ADMIN", "TESTER", "PAKAR"] as const;
export type Role = (typeof ROLES)[number];

export function isRole(value: unknown): value is Role {
  return typeof value === "string" && (ROLES as readonly string[]).includes(value);
}

export type Permission =
  /** Simulation console: artifacts, panels, FGD/Delphi/AHP dry-runs. */
  | "console:read"
  | "artifact:write"
  | "simulation:run"
  /** Passing a gate, content lock, form ACTIVE (SPECIFICATION §2, §3). */
  | "gate:pass"
  /** PanelistIdentity mapping (R1-V1.7 §3.13.2). */
  | "identity:read"
  | "users:manage"
  /** Experts, persona briefs, and panel seats (docs/03 Panel & Persona). */
  | "panel:manage"
  /** approvePersona is Admin-only (docs/03). */
  | "persona:approve"
  /** Opening/closing expert forms and exporting REAL expert responses. */
  | "instrument:manage"
  /** Human experts fill only the instruments assigned to them. */
  | "instrument:fill";

// Admin = the former Owner, Tester = the former Editor. Pakar never reaches the
// simulation console: seeing simulated panel output would contaminate a human
// expert's own judgement.
const GRANTS: Record<Role, readonly Permission[]> = {
  ADMIN: [
    "console:read",
    "artifact:write",
    "simulation:run",
    "gate:pass",
    "identity:read",
    "users:manage",
    "instrument:manage",
    "panel:manage",
    "persona:approve",
  ],
  TESTER: ["console:read", "artifact:write", "simulation:run", "panel:manage"],
  PAKAR: ["instrument:fill"],
};

export function can(role: Role, permission: Permission): boolean {
  return GRANTS[role].includes(permission);
}

export function assertPermission(role: Role, permission: Permission): void {
  if (!can(role, permission)) throw new ForbiddenError(permission);
}

/** Where a signed-in user lands. */
export function homePathFor(role: Role): string {
  return can(role, "console:read") ? "/" : "/pakar";
}
