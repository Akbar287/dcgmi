import { describe, expect, it } from "vitest";

import { callCost, estimateCallCost, perThousand } from "../pricing";

describe("pricing", () => {
  const price = { inputPer1k: 0.003, outputPer1k: 0.015 };
  it("charges tokens per thousand", () => {
    expect(callCost(2000, 500, price)).toBeCloseTo(0.0135, 10);
    expect(callCost(null, null, price)).toBe(0);
  });
  it("estimates from prompt characters plus the full output allowance", () => {
    expect(estimateCallCost(3500, 1000, price)).toBeCloseTo(0.003 + 0.015, 10);
  });
  it("converts gateway per-token prices", () => {
    expect(perThousand("0.000003")).toBeCloseTo(0.003, 12);
    expect(perThousand(undefined)).toBeNull();
    expect(perThousand("abc")).toBeNull();
  });
});
