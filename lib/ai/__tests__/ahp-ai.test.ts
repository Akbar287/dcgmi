import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { defaultScenarios, parseScenarios, scenariosToText } from "@/lib/ahp/scenarios";

import { judgePair } from "../ahp";
import { mockPairwise } from "../mock/ahp-fixtures";
import { AHP_SEAT_PAIRWISE, AHP_SEAT_REVIEW } from "../prompts/ahp";
import { SIMULATION_BOUNDARY } from "../prompts/fgd";
import { PairwiseSchema } from "../schemas";

const seat = {
  seatIndex: 3,
  label: "Pakar 3",
  field: "MANAJEMEN_PT",
  systemPrompt: "Anda anggota panel.",
  target: { providerKey: "gateway", modelId: "openai/gpt-x", envKeyName: "AI_GATEWAY_API_KEY", baseUrl: null, temperature: 0.7, seed: 1 },
};
const el = (code: string) => ({ code, name: `Domain ${code}`, rationale: null });
const ctx = { levelLabel: "Antar-domain", elements: [el("D1"), el("D2"), el("D3")], a: el("D1"), b: el("D2") };

let previous: string | undefined;
beforeEach(() => {
  previous = process.env.MOCK_AI;
  process.env.MOCK_AI = "1";
});
afterEach(() => {
  process.env.MOCK_AI = previous;
});

describe("AHP prompts", () => {
  it("carry id, version, boundary, and never the CR threshold or a corrected value", () => {
    const review = AHP_SEAT_REVIEW.render({ ...ctx, previous: { preferred: "A", intensity: 5, reason: "x" }, impliedFromOthers: "1:3" });
    for (const text of [AHP_SEAT_PAIRWISE.render(ctx), review]) {
      expect(text).toContain(SIMULATION_BOUNDARY);
      expect(text).not.toMatch(/0[.,]10|CR|consistency ratio|rasio konsistensi/i);
    }
    expect(review.match(new RegExp(SIMULATION_BOUNDARY.slice(0, 20), "g"))).toHaveLength(1);
  });

  it("schema ties EQUAL to intensity 1", () => {
    expect(PairwiseSchema.safeParse({ preferred: "EQUAL", intensity: 3, reason: "cukup panjang" }).success).toBe(false);
    expect(PairwiseSchema.safeParse({ preferred: "A", intensity: 1, reason: "cukup panjang" }).success).toBe(false);
    expect(PairwiseSchema.safeParse({ preferred: "B", intensity: 4, reason: "cukup panjang" }).success).toBe(true);
  });

  it("mock judgement passes the schema through callObject", async () => {
    const r = await judgePair(seat, ctx, { seed: 9, group: "DOMAIN", pairIndex: 0, attempt: 0 });
    expect(r.log.promptId).toBe("ahp.seat.pairwise");
    expect(PairwiseSchema.safeParse(r.judgement).success).toBe(true);
  });
});

describe("AHP mock", () => {
  it("gives different seats different judgements, so inter-expert variation is exercised", () => {
    const codes = ["D1", "D2", "D3", "D4", "D5", "D6", "D7", "D8"];
    const matrixOf = (seatIndex: number) =>
      codes.flatMap((a, i) => codes.slice(i + 1).map((b) => {
        const p = mockPairwise(11, seatIndex, "DOMAIN", a, b, 99, 1);
        return `${p.preferred}${p.intensity}`;
      })).join(",");
    const distinct = new Set([1, 2, 3, 4, 5, 6, 7, 8].map(matrixOf));
    expect(distinct.size).toBe(8);
  });
});

describe("sensitivity scenarios", () => {
  it("default preset: ±0.05 and ±0.10 per domain", () => {
    const list = defaultScenarios(["D1", "D2"]);
    expect(list).toHaveLength(8);
    expect(list.map((s) => s.delta)).toEqual([-0.1, -0.05, 0.05, 0.1, -0.1, -0.05, 0.05, 0.1]);
  });
  it("round-trips through text and rejects bad lines", () => {
    const list = defaultScenarios(["D1"]);
    expect(parseScenarios(scenariosToText(list), ["D1"]).scenarios).toEqual(list);
    expect(parseScenarios("D9 0.05\nD1 0\nD1 1.5\nD1 -0,05", ["D1"]).errors).toHaveLength(3);
  });
});
