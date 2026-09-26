import { describe, expect, it } from "vitest";

import { GATE_ORDER } from "../../method/gates";
import { STAGES, stageStatuses } from "../stages";

describe("process stages", () => {
  it("follows the gate order of lib/method", () => {
    expect(STAGES.map((s) => s.gate)).toEqual(GATE_ORDER);
  });

  it("marks the first stage whose gate has not passed as current", () => {
    expect(stageStatuses({})).toEqual(["CURRENT", "UPCOMING", "UPCOMING", "UPCOMING", "UPCOMING", "UPCOMING", "UPCOMING"]);
    expect(stageStatuses({ G1_BASELINE: "PENDING" })[0]).toBe("CURRENT");
    expect(stageStatuses({ G1_BASELINE: "PASSED", G2_FGD: "FAILED" }).slice(0, 3)).toEqual(["DONE", "CURRENT", "UPCOMING"]);
  });

  it("never skips a gate: a later PASSED does not make an earlier stage done", () => {
    expect(stageStatuses({ G2_FGD: "PASSED" }).slice(0, 2)).toEqual(["CURRENT", "UPCOMING"]);
  });
});
