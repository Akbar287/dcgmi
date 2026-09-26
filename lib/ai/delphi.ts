import { callObject, type CallLog } from "./call";
import type { SeatRuntime } from "./fgd";
import { mockRating } from "./mock/delphi-fixtures";
import { DELPHI_SEAT_RATE, type RateContext } from "./prompts/delphi";
import { RatingSchema, type Rating } from "./schemas";

// Delphi seat call (docs/04 §7). Each seat rates alone: the prompt carries no
// other seat's individual answer, only the anonymous group feedback.

export interface DelphiSeatRuntime extends SeatRuntime {
  contextScope: "FULL" | "ARTIFACT_ONLY";
}

/** Builds the prompt context a seat may see; ARTIFACT_ONLY seats never get the FGD summary. */
export function seatContext(seat: DelphiSeatRuntime, base: Omit<RateContext, "fgdSummary">, fgdSummary: string | null): RateContext {
  return { ...base, fgdSummary: seat.contextScope === "ARTIFACT_ONLY" ? null : fgdSummary };
}

export async function rate(seat: DelphiSeatRuntime, ctx: RateContext, mock: { seed: number; code: string }): Promise<{ rating: Rating; log: CallLog }> {
  const r = await callObject({
    target: seat.target,
    prompt: DELPHI_SEAT_RATE,
    system: seat.systemPrompt,
    text: DELPHI_SEAT_RATE.render(ctx),
    schema: RatingSchema,
    maxOutputTokens: 400,
    mock: () => mockRating(mock.seed, mock.code, seat.seatIndex, ctx.round),
  });
  return { rating: r.value, log: r.log };
}
