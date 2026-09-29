import pLimit from "p-limit";

import { withCallSink, type CallTarget } from "@/lib/ai/call";
import { argue, crossTalk, extractNotes, present, vote, type SeatRuntime, type Utterance } from "@/lib/ai/fgd";
import { FGD_FACILITATOR_PRESENT, FGD_NOTETAKER_EXTRACT, FGD_SEAT_ARGUE, FGD_SEAT_CROSSTALK, FGD_SEAT_VOTE } from "@/lib/ai/prompts/fgd";
import {
  claimNextItem,
  failItem,
  getBriefDomains,
  loadRunContext,
  pauseSession,
  saveItemResult,
  type ItemResult,
  type SessionSettings,
} from "@/lib/db/repository/fgd-sessions";
import { db } from "@/lib/db/client";
import { createCallSink, getSeatThinking } from "@/lib/db/repository/model-calls";
import { applyFgdDecisionRule } from "@/lib/method/fgd";

import { hash32, seededShuffle, type StageKey } from "./agenda";
import { componentBrief } from "./component-brief";

export const PROMPT_VERSIONS = Object.fromEntries(
  [FGD_FACILITATOR_PRESENT, FGD_SEAT_ARGUE, FGD_SEAT_CROSSTALK, FGD_SEAT_VOTE, FGD_NOTETAKER_EXTRACT].map((p) => [p.id, p.version]),
);

export type RunOutcome =
  | { kind: "NOTHING" }
  | { kind: "ITEM_DONE" | "STAGE_DONE" | "SESSION_DONE"; itemId: string; decision: string }
  | { kind: "STOPPED_SPECIAL"; itemId: string; decision: string }
  | { kind: "FAILED"; itemId: string; error: string };

function targetOf(profile: { modelId: string; provider: { key: string; envKeyName: string; baseUrl: string | null } }, extra: Partial<CallTarget> = {}): CallTarget {
  return { providerKey: profile.provider.key, modelId: profile.modelId, envKeyName: profile.provider.envKeyName, baseUrl: profile.provider.baseUrl, ...extra };
}

/**
 * One FGD component, end to end (docs/01 "Alur data: satu sesi FGD"):
 * facilitator → seats argue (parallel, seeded order) → optional cross-talk →
 * seats vote separately → notetaker → Tabel 3.5 via lib/method. Everything is
 * stored in one transaction, or the component is marked FAILED and the run
 * stops; nothing partial and no default values are written.
 */
export async function runNextItem(sessionId: string): Promise<RunOutcome> {
  const s = await sessionScope(sessionId);
  const sink = await createCallSink({ kind: "FGD", refType: "FgdSession", refId: sessionId, versionId: s.versionId, runId: s.runId, budgetUsd: s.budgetUsd === null ? null : Number(s.budgetUsd) });
  return withCallSink(sink, () => runItem(sessionId));
}

async function runItem(sessionId: string): Promise<RunOutcome> {
  const item = await claimNextItem(sessionId);
  if (!item) return { kind: "NOTHING" };
  try {
    const { session, profiles } = await loadRunContext(sessionId);
    const settings = session.settings as unknown as SessionSettings;
    const facilitatorProfile = profiles.find((p) => p.id === session.config.facilitatorModelId);
    const notetakerProfile = profiles.find((p) => p.id === session.config.notetakerModelId);
    if (!facilitatorProfile || !notetakerProfile) throw new Error("Model fasilitator/notulis belum dikonfigurasi pada panel.");

    const thinking = await getSeatThinking();
    const seats: SeatRuntime[] = session.config.seats.map((s) => {
      if (s.expert?.persona?.status !== "APPROVED") throw new Error(`${s.label} tidak memiliki persona APPROVED.`);
      return {
        seatIndex: s.seatIndex,
        label: s.label,
        field: s.field,
        systemPrompt: s.expert.persona.systemPrompt,
        target: targetOf(s.modelProfile, { temperature: s.temperature, seed: s.seed ?? session.seed, thinking }),
      };
    });

    const domains = await getBriefDomains(session.versionId);
    const ctx = {
      stageTitle: item.stage.title,
      componentTitle: item.title,
      brief: componentBrief(item.stage.key as StageKey, item.targetType, item.targetCode, domains),
    };
    const componentSeed = hash32(`${session.seed}|${item.stage.key}|${item.targetCode}`);
    const limit = pLimit(Number(process.env.AI_MAX_CONCURRENCY) || 4);
    const all: Utterance[] = [];

    const presentation = await present(targetOf(facilitatorProfile), ctx);
    all.push(presentation);

    // docs/04 §6: speaking order shuffled per component to reduce anchoring.
    const order = seededShuffle(seats, componentSeed);
    const args = await Promise.all(order.map((seat) => limit(() => argue(seat, ctx, presentation.content, componentSeed, item.targetCode))));
    all.push(...args);

    const statements = new Map(order.map((s, i) => [s.seatIndex, [args[i].content]]));
    for (let round = 0; round < settings.crossTalkRounds; round++) {
      const replies = await Promise.all(
        order.map((seat, i) =>
          limit(() =>
            crossTalk(
              seat,
              ctx,
              presentation.content,
              args[i].content,
              order.filter((o) => o.seatIndex !== seat.seatIndex).map((o) => ({ label: o.label, text: statements.get(o.seatIndex)!.at(-1)! })),
            ),
          ),
        ),
      );
      replies.forEach((r, i) => statements.get(order[i].seatIndex)!.push(r.content));
      all.push(...replies);
    }

    // Votes see only the seat's own statements, never other votes.
    const votes = await Promise.all(order.map((seat) => limit(() => vote(seat, ctx, statements.get(seat.seatIndex)!, componentSeed, item.targetCode))));

    const transcript = all.filter((u) => u.seatIndex !== null).map((u) => ({ seatIndex: u.seatIndex!, label: u.speaker, text: u.content }));
    const notes = await extractNotes(targetOf(notetakerProfile), item.title, transcript);

    const decision = applyFgdDecisionRule(votes.map((v) => v.vote.position));
    const result: ItemResult = {
      utterances: [
        ...all.map((u, turn) => ({ kind: u.kind, speaker: u.speaker, seatIndex: u.seatIndex, turn, content: u.content, ...u.log })),
        ...votes.map((v, i) => ({ kind: "VOTE_REASON", speaker: order[i].label, seatIndex: order[i].seatIndex, turn: all.length + i, content: v.vote.reason, ...v.log })),
        { kind: "NOTE", speaker: "Notulis", seatIndex: null, turn: all.length + votes.length, content: `${notes.notes.suggestions.length} usulan diekstrak`, ...notes.log },
      ],
      positions: votes.map((v, i) => ({ seatIndex: order[i].seatIndex, position: v.vote.position, reason: v.vote.reason, proposedAction: v.vote.proposedAction })),
      suggestions: notes.notes.suggestions,
      decision: {
        decision: decision.decision,
        ruleFired: decision.ruleFired,
        tally: decision.tally as unknown as ItemResult["decision"]["tally"],
        // docs/05 §2: other rules that also fired are recorded, not discarded.
        note: decision.alsoTriggered.length ? `Juga terpenuhi: ${decision.alsoTriggered.join(", ")}` : null,
      },
    };
    const saved = await saveItemResult(item.id, result);

    if (saved.sessionDone) return { kind: "SESSION_DONE", itemId: item.id, decision: decision.decision };
    // AUTO stops at PEMBAHASAN_KHUSUS; STEP pauses at the end of every stage (SPECIFICATION §4.5).
    if (decision.decision === "PEMBAHASAN_KHUSUS" && session.mode === "AUTO") {
      await pauseSession(sessionId);
      return { kind: "STOPPED_SPECIAL", itemId: item.id, decision: decision.decision };
    }
    if (saved.stageDone && session.mode === "STEP") {
      await pauseSession(sessionId);
      return { kind: "STAGE_DONE", itemId: item.id, decision: decision.decision };
    }
    return { kind: saved.stageDone ? "STAGE_DONE" : "ITEM_DONE", itemId: item.id, decision: decision.decision };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    await failItem(item.id, message);
    return { kind: "FAILED", itemId: item.id, error: message };
  }
}

async function sessionScope(sessionId: string) {
  const prisma = await db();
  return prisma.fgdSession.findUniqueOrThrow({ where: { id: sessionId }, select: { versionId: true, runId: true, budgetUsd: true } });
}
