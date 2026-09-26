import { describe, expect, it } from "vitest";

import { ForbiddenError } from "../errors";
import { assertPermission, can, homePathFor } from "../roles";

describe("role permissions", () => {
  it("keeps gate and identity rights with ADMIN only", () => {
    expect(can("ADMIN", "gate:pass")).toBe(true);
    expect(can("TESTER", "gate:pass")).toBe(false);
    expect(can("TESTER", "identity:read")).toBe(false);
    expect(can("TESTER", "artifact:write")).toBe(true);
    expect(can("TESTER", "instrument:manage")).toBe(false);
    expect(can("ADMIN", "instrument:manage")).toBe(true);
    expect(can("TESTER", "panel:manage")).toBe(true);
    expect(can("TESTER", "persona:approve")).toBe(false);
    expect(can("PAKAR", "panel:manage")).toBe(false);
  });

  it("keeps PAKAR out of the simulation console", () => {
    expect(can("PAKAR", "console:read")).toBe(false);
    expect(homePathFor("PAKAR")).toBe("/pakar");
    expect(homePathFor("TESTER")).toBe("/");
  });

  it("throws ForbiddenError instead of returning silently", () => {
    expect(() => assertPermission("PAKAR", "users:manage")).toThrow(ForbiddenError);
  });
});
