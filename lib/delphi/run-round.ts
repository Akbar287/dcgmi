import pLimit from "p-limit";

import { BudgetExceededError, withCallSink, type CallTarget } from "@/lib/ai/call";
import { rate, seatContext, type DelphiSeatRuntime } from "@/lib/ai/delphi";
import { DELPHI_SEAT_RATE } from "@/lib/ai/prompts/delphi";
import { failDelphiRound, loadDelphiRunContext, nextDelphiItem, saveDelphiItem, setDelphiRoundStatus, type DelphiRoundSettings, type SeatRatingRow } from "@/lib/db/repository/delphi-rounds";
import { createCallSink } from "@/lib/db/repository/model-calls";
import { hash32 } from "@/lib/fgd/agenda";
import { indicatorPackage } from "@/lib/fgd/component-brief";
import { buildRoundFeedback } from "@/lib/method/cvi";

export const DELPHI_PROMPT_VERSIONS = { [DELPHI_SEAT_RATE.id]: DELPHI_SEAT_RATE.version };

export type DelphiRunOutcome =
  | { kind: "NOTHING" | "BLOCKED"; status: string }
  | { kind: "ITEM_DONE" | "ROUND_DONE"; code: string; decision: string }
  | { kind: "DEVIATION"; code: string; error: string };

function targetOf(profile: { modelId: string; provider: { key: string; envKeyName: string; baseUrl: string | null } }, extra: Partial<CallTarget>): CallTarget {
  return { providerKey: profile.provider.key, modelId: profile.modelId, envKeyName: profile.provider.envKeyName, baseUrl: profile.provider.baseUrl, ...extra };
}

/**
 * One Delphi item, all seats in parallel (docs/01 alur Delphi). Seats rate
 * alone: the prompt has the item, FGD context for FULL seats in R1 only, and
 * from R2 the seat's own score plus anonymous group statistics. A seat that
 * fails after retries leaves a null rating — never a default — and the round
 * stops with a panel deviation (§3.8.3).
 */
export async function runNextDelphiItem(roundId: string): Promise<DelphiRunOutcome> {
  const r = await loadDelphiRunContext(roundId);
  const sink = await createCallSink({ kind: "DELPHI", refType: "DelphiRound", refId: roundId, versionId: r.versionId, runId: r.runId, budgetUsd: r.budgetUsd === null ? null : Number(r.budgetUsd) });
  return withCallSink(sink, () => runItem(roundId));
}

async function runItem(roundId: string): Promise<DelphiRunOutcome> {
  const round = await loadDelphiRunContext(roundId);
  if (round.finalizedAt || round.status === "COMPLETED") return { kind: "NOTHING", status: round.status };
  if (round.status === "FAILED" || round.status === "CANCELLED") return { kind: "BLOCKED", status: round.status };
  const item = await nextDelphiItem(roundId);
  if (!item) return { kind: "NOTHING", status: round.status };
  await setDelphiRoundStatus(null, roundId, "START");

  const settings = round.settings as unknown as DelphiRoundSettings;
  const missing = round.config.seats.find((s) => s.expert?.persona?.status !== "APPROVED");
  if (missing) {
    const error = `${missing.label} tidak memiliki persona APPROVED.`;
    await failDelphiRound(roundId, error);
    return { kind: "DEVIATION", code: item.code, error };
  }
  const seats: DelphiSeatRuntime[] = round.config.seats.map((s) => {
    if (s.expert?.persona?.status !== "APPROVED") throw new Error(`${s.label} tidak memiliki persona APPROVED.`);
    return {
      seatIndex: s.seatIndex,
      label: s.label,
      field: s.field,
      systemPrompt: s.expert.persona.systemPrompt,
      target: targetOf(s.modelProfile, { temperature: s.temperature, seed: s.seed ?? round.seed }),
      contextScope: s.isNewMember || s.contextScope === "ARTIFACT_ONLY" ? "ARTIFACT_ONLY" : "FULL",
    };
  });

  const itemPackage = `Domain/aspek: ${item.domainAspect}\n${indicatorPackage(item.brief, true)}`;
  const fgdSummary = round.roundNumber === 1 ? (settings.fgdContext?.[item.code] ?? null) : null;
  const mockSeed = hash32(`${round.seed}|delphi`);
  const limit = pLimit(Number(process.env.AI_MAX_CONCURRENCY) || 4);

  let rows: SeatRatingRow[];
  try {
    rows = await Promise.all(
    seats
      .filter((seat) => !item.rated.has(seat.seatIndex))
      .map((seat) =>
        limit(async (): Promise<SeatRatingRow> => {
          const ctx = seatContext(
            seat,
            {
              round: round.roundNumber,
              itemPackage,
              feedback: item.previous ? buildRoundFeedback(item.previous.ratings, seat.seatIndex) : null,
              revisedSincePrevious: item.previous?.revised ?? false,
            },
            fgdSummary,
          );
          try {
            const r = await rate(seat, ctx, { seed: mockSeed, code: item.code });
            return { seatIndex: seat.seatIndex, relevance: r.rating.relevance, reason: r.rating.reason, clarityFlag: r.rating.clarityFlag, clarityNote: r.rating.clarityNote, error: null, log: r.log };
          } catch (error) {
            // A refused budget is not a seat failure: it stops the round with its own reason.
            if (error instanceof BudgetExceededError) throw error;
            return { seatIndex: seat.seatIndex, relevance: null, reason: null, clarityFlag: false, clarityNote: null, error: error instanceof Error ? error.message : String(error), log: null };
          }
        }),
      ),
    );
  } catch (error) {
    if (!(error instanceof BudgetExceededError)) throw error;
    await failDelphiRound(roundId, error.message);
    return { kind: "DEVIATION", code: item.code, error: error.message };
  }

  const saved = await saveDelphiItem(roundId, item.indicatorId, item.code, rows);
  if (saved.deviation) return { kind: "DEVIATION", code: item.code, error: saved.error };
  return { kind: saved.roundDone ? "ROUND_DONE" : "ITEM_DONE", code: item.code, decision: saved.decision };
}
