import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { rate, seatContext, type DelphiSeatRuntime } from "../delphi";
import { mockRating } from "../mock/delphi-fixtures";
import { DELPHI_SEAT_RATE } from "../prompts/delphi";
import { SIMULATION_BOUNDARY } from "../prompts/fgd";

const seat = (contextScope: DelphiSeatRuntime["contextScope"]): DelphiSeatRuntime => ({
  seatIndex: 7,
  label: "Pakar 7",
  field: "SPBE",
  systemPrompt: "Anda anggota panel.",
  target: { providerKey: "gateway", modelId: "openai/gpt-x", envKeyName: "AI_GATEWAY_API_KEY", baseUrl: null, temperature: 0.7, seed: 1 },
  contextScope,
});
const base = { round: 1, itemPackage: "Indikator C02 — Konektivitas\nDefinisi operasional: …", feedback: null, revisedSincePrevious: false };
const FGD_SUMMARY = "Hasil FGD: TERIMA_DENGAN_REVISI (4/6). Transkrip FGD: …";
// Markers of FGD context that must never reach an ARTIFACT_ONLY seat (docs/04 §7, docs/09 §4).
const FGD_MARKERS = [/FGD/i, /DISKUSI PANEL/, /TERIMA_DENGAN_REVISI/, /PEMBAHASAN_KHUSUS/, /transkrip/i];

let previous: string | undefined;
beforeEach(() => {
  previous = process.env.MOCK_AI;
  process.env.MOCK_AI = "1";
});
afterEach(() => {
  process.env.MOCK_AI = previous;
});

describe("Delphi seat prompt", () => {
  it("has an id, a version, and the simulation boundary", () => {
    expect(DELPHI_SEAT_RATE.id).toBe("delphi.seat.rate");
    expect(DELPHI_SEAT_RATE.version).toMatch(/^\d+\.\d+\.\d+$/);
    expect(DELPHI_SEAT_RATE.render(seatContext(seat("FULL"), base, null))).toContain(SIMULATION_BOUNDARY);
  });

  it("isolates new members: no FGD context markers in an ARTIFACT_ONLY prompt", () => {
    const text = DELPHI_SEAT_RATE.render(seatContext(seat("ARTIFACT_ONLY"), base, FGD_SUMMARY));
    for (const m of FGD_MARKERS) expect(text).not.toMatch(m);
    expect(DELPHI_SEAT_RATE.render(seatContext(seat("FULL"), base, FGD_SUMMARY))).toContain(FGD_SUMMARY);
  });

  it("gives R2 seats only their own score and anonymous group statistics", () => {
    const text = DELPHI_SEAT_RATE.render(
      seatContext(seat("FULL"), { ...base, round: 2, feedback: { own: 2, median: 3.5, iqr: 1, distribution: [0, 2, 2, 4] }, revisedSincePrevious: true }, null),
    );
    expect(text).toContain("Skor Anda: 2");
    expect(text).toContain("Median kelompok: 3.5; IQR: 1");
    expect(text).toContain("1: 0, 2: 2, 3: 2, 4: 4");
    expect(text).not.toMatch(/Pakar \d|Kursi \d/);
  });

  it("never embeds Tabel 3.6 thresholds", () => {
    const text = DELPHI_SEAT_RATE.render(seatContext(seat("FULL"), base, null));
    expect(text).not.toMatch(/0[.,]78|0[.,]90|I-CVI|S-CVI|IQR ≤|PERTAHANKAN|HAPUS_DARI_INTI/);
  });
});

describe("Delphi mock rating", () => {
  it("is deterministic and schema-valid through callObject", async () => {
    const a = await rate(seat("FULL"), seatContext(seat("FULL"), base, null), { seed: 5, code: "C02" });
    expect(a.rating).toEqual(mockRating(5, "C02", 7, 1));
    expect(a.log.promptId).toBe("delphi.seat.rate");
    expect(a.log.modelId).toBe("mock:openai/gpt-x");
  });
});
