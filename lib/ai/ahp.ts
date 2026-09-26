import { callObject, type CallLog } from "./call";
import type { SeatRuntime } from "./fgd";
import { mockPairwise } from "./mock/ahp-fixtures";
import { AHP_SEAT_PAIRWISE, AHP_SEAT_REVIEW, type PairContext, type ReviewContext } from "./prompts/ahp";
import { PairwiseSchema, type Pairwise } from "./schemas";

// AHP seat calls (docs/04 §8): one pair per call; lib/method builds the matrix.

export interface PairMock {
  seed: number;
  group: string;
  pairIndex: number;
  attempt: number;
}

export async function judgePair(seat: SeatRuntime, ctx: PairContext, mock: PairMock): Promise<{ judgement: Pairwise; log: CallLog }> {
  const r = await callObject({
    target: seat.target,
    prompt: AHP_SEAT_PAIRWISE,
    system: seat.systemPrompt,
    text: AHP_SEAT_PAIRWISE.render(ctx),
    schema: PairwiseSchema,
    maxOutputTokens: 300,
    mock: () => mockPairwise(mock.seed, seat.seatIndex, mock.group, ctx.a.code, ctx.b.code, mock.pairIndex, mock.attempt),
  });
  return { judgement: r.value, log: r.log };
}

export async function reviewPair(seat: SeatRuntime, ctx: ReviewContext, mock: PairMock): Promise<{ judgement: Pairwise; log: CallLog }> {
  const r = await callObject({
    target: seat.target,
    prompt: AHP_SEAT_REVIEW,
    system: seat.systemPrompt,
    text: AHP_SEAT_REVIEW.render(ctx),
    schema: PairwiseSchema,
    maxOutputTokens: 300,
    mock: () => mockPairwise(mock.seed, seat.seatIndex, mock.group, ctx.a.code, ctx.b.code, mock.pairIndex, mock.attempt),
  });
  return { judgement: r.value, log: r.log };
}
