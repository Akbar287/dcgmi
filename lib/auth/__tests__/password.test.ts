import { describe, expect, it } from "vitest";

import { hashPassword, verifyPassword } from "../password";

describe("password hashing", () => {
  it("verifies the original password and rejects others", async () => {
    const stored = await hashPassword("correct horse battery");
    expect(stored.startsWith("scrypt$")).toBe(true);
    await expect(verifyPassword("correct horse battery", stored)).resolves.toBe(true);
    await expect(verifyPassword("correct horse batterx", stored)).resolves.toBe(false);
  });

  it("salts every hash", async () => {
    const [a, b] = await Promise.all([hashPassword("same"), hashPassword("same")]);
    expect(a).not.toBe(b);
  });

  it("rejects malformed stored values", async () => {
    await expect(verifyPassword("x", "bcrypt$abc")).resolves.toBe(false);
    await expect(verifyPassword("x", "")).resolves.toBe(false);
  });
});
