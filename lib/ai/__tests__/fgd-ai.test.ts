import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { argue, extractNotes, quoteProblem, vote, type SeatRuntime } from "../fgd";
import { mockStance } from "../mock/fgd-fixtures";
import { FGD_FACILITATOR_PRESENT, FGD_NOTETAKER_EXTRACT, FGD_SEAT_ARGUE, FGD_SEAT_CROSSTALK, FGD_SEAT_VOTE, SIMULATION_BOUNDARY } from "../prompts/fgd";

const seat: SeatRuntime = {
  seatIndex: 2,
  label: "Pakar 2",
  field: "IT_GOVERNANCE",
  systemPrompt: "Anda anggota panel.",
  target: { providerKey: "gateway", modelId: "openai/gpt-x", envKeyName: "AI_GATEWAY_API_KEY", baseUrl: null, temperature: 0.7, seed: 1 },
};
const ctx = { stageTitle: "Indikator", componentTitle: "C02 — Konektivitas", brief: "Definisi: …" };

let previous: string | undefined;
beforeEach(() => {
  previous = process.env.MOCK_AI;
  process.env.MOCK_AI = "1";
});
afterEach(() => {
  process.env.MOCK_AI = previous;
});

describe("FGD prompts", () => {
  it("carry an id, a version, and the simulation boundary on every seat prompt", () => {
    for (const p of [FGD_SEAT_ARGUE, FGD_SEAT_CROSSTALK, FGD_SEAT_VOTE]) {
      expect(p.id).toMatch(/^fgd\.seat\./);
      expect(p.version).toMatch(/^\d+\.\d+\.\d+$/);
    }
    expect(FGD_SEAT_ARGUE.render({ ...ctx, presentation: "x", maxWords: 250 })).toContain(SIMULATION_BOUNDARY);
    expect(FGD_SEAT_VOTE.render({ ...ctx, ownStatements: ["x"] })).toContain(SIMULATION_BOUNDARY);
  });

  it("never embed the Tabel 3.5 decision rule or expected results", () => {
    const texts = [
      FGD_FACILITATOR_PRESENT.render(ctx),
      FGD_SEAT_ARGUE.render({ ...ctx, presentation: "x", maxWords: 250 }),
      FGD_SEAT_VOTE.render({ ...ctx, ownStatements: ["x"] }),
      FGD_NOTETAKER_EXTRACT.render({ componentTitle: "x", transcript: [] }),
    ].join("\n");
    expect(texts).not.toMatch(/dari 6|≥\s*\d|PEMBAHASAN_KHUSUS|TIDAK_SEPAKAT|I-CVI|biasanya 3 atau 4/);
  });
});

describe("FGD roles under MOCK_AI=1", () => {
  it("runs the AI SDK path deterministically, with argument and vote consistent", async () => {
    const a = await argue(seat, ctx, "penyajian", 7, "C02");
    const v = await vote(seat, ctx, [a.content], 7, "C02");
    expect(a.content.startsWith("[MOCK]")).toBe(true);
    expect(a.log.modelId).toBe("mock:openai/gpt-x");
    expect(a.log.promptId).toBe("fgd.seat.argue");
    expect(v.vote.position).toBe(mockStance(7, 2, "C02"));
    expect((await vote(seat, ctx, [a.content], 7, "C02")).vote).toEqual(v.vote);
  });

  it("extracts only verbatim quotes and rejects invented ones", async () => {
    const transcript = [{ seatIndex: 2, label: "Pakar 2", text: "[MOCK] x. Usulan: rumuskan ulang definisi operasional agar bukti minimumnya dapat diverifikasi di PT Indonesia." }];
    const { notes } = await extractNotes(seat.target, "C02", transcript);
    expect(notes.suggestions).toHaveLength(1);
    const bySeat = new Map([[2, transcript[0].text]]);
    expect(quoteProblem({ suggestions: [{ seatIndex: 2, action: "HAPUS", quote: "kalimat karangan", rationale: "r" }] }, bySeat)).toMatch(/bukan substring/);
    expect(quoteProblem({ suggestions: [{ seatIndex: 5, action: "HAPUS", quote: "x", rationale: "r" }] }, bySeat)).toMatch(/tidak berbicara/);
  });
});
