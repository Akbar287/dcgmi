import pLimit from "p-limit";

import { judgePair, reviewPair } from "@/lib/ai/ahp";
import { withCallSink, type CallTarget } from "@/lib/ai/call";
import type { SeatRuntime } from "@/lib/ai/fgd";
import { AHP_SEAT_PAIRWISE, AHP_SEAT_REVIEW } from "@/lib/ai/prompts/ahp";
import { ahpGroupsFor, groupKey, loadAhpRunContext, nextAhpMatrix, saveAhpMatrix, setAhpSessionStatus, type PairRecord } from "@/lib/db/repository/ahp-sessions";
import { createCallSink } from "@/lib/db/repository/model-calls";
import { hash32 } from "@/lib/fgd/agenda";
import { buildMatrixFromPairs, pairValue, priorityVector } from "@/lib/method/ahp";

export const AHP_PROMPT_VERSIONS = { [AHP_SEAT_PAIRWISE.id]: AHP_SEAT_PAIRWISE.version, [AHP_SEAT_REVIEW.id]: AHP_SEAT_REVIEW.version };

export type AhpRunOutcome =
  | { kind: "NOTHING" | "BLOCKED"; status: string }
  | { kind: "MATRIX_DONE" | "SESSION_DONE"; seatIndex: number; group: string; status: string; cr: number }
  | { kind: "FAILED"; error: string };

function targetOf(profile: { modelId: string; provider: { key: string; envKeyName: string; baseUrl: string | null } }, extra: Partial<CallTarget>): CallTarget {
  return { providerKey: profile.provider.key, modelId: profile.modelId, envKeyName: profile.provider.envKeyName, baseUrl: profile.provider.baseUrl, ...extra };
}

const ratioText = (r: number) => (r >= 1 ? `${r.toFixed(1)}:1` : `1:${(1 / r).toFixed(1)}`);

/**
 * One seat matrix per call (docs/04 §8). First fill: every pair i<j, one call
 * each. Review (attempt 1–2): only the returned pairs are asked again, with
 * the seat's previous judgement and what its other judgements imply; the
 * rest are kept as the seat gave them. lib/method builds the matrix and CR.
 */
export async function runNextAhpMatrix(sessionId: string): Promise<AhpRunOutcome> {
  const s = await loadAhpRunContext(sessionId);
  const sink = await createCallSink({ kind: "AHP", refType: "AhpSession", refId: sessionId, versionId: s.versionId, runId: s.runId, budgetUsd: s.budgetUsd === null ? null : Number(s.budgetUsd) });
  return withCallSink(sink, () => runMatrix(sessionId));
}

async function runMatrix(sessionId: string): Promise<AhpRunOutcome> {
  const session = await loadAhpRunContext(sessionId);
  if (["COMPLETED", "CANCELLED"].includes(session.status)) return { kind: "NOTHING", status: session.status };
  if (session.status === "FAILED") return { kind: "BLOCKED", status: session.status };
  const m = await nextAhpMatrix(sessionId);
  if (!m) return { kind: "NOTHING", status: session.status };
  await setAhpSessionStatus(null, sessionId, "START");

  const seatRow = session.config.seats.find((s) => s.seatIndex === m.seatIndex);
  if (!seatRow?.expert?.persona || seatRow.expert.persona.status !== "APPROVED") {
    const error = `Kursi ${m.seatIndex} tidak memiliki persona APPROVED.`;
    await setAhpSessionStatus(null, sessionId, "FAIL", error);
    return { kind: "FAILED", error };
  }
  const seat: SeatRuntime = {
    seatIndex: seatRow.seatIndex,
    label: seatRow.label,
    field: seatRow.field,
    systemPrompt: seatRow.expert.persona.systemPrompt,
    target: targetOf(seatRow.modelProfile, { temperature: seatRow.temperature, seed: seatRow.seed ?? session.seed }),
  };
  const key = groupKey(m.level, m.parentCode);
  const group = (await ahpGroupsFor(session.versionId)).find((g) => g.key === key);
  if (!group) {
    const error = `Grup ${key} tidak ada di hierarki.`;
    await setAhpSessionStatus(null, sessionId, "FAIL", error);
    return { kind: "FAILED", error };
  }
  const els = m.elements.map((code) => group.elements.find((e) => e.code === code)!);
  const base = { levelLabel: group.label, elements: els };
  const mockSeed = hash32(`${session.seed}|ahp`);
  const limit = pLimit(Number(process.env.AI_MAX_CONCURRENCY) || 4);

  try {
    let pairs: PairRecord[];
    if (m.attempt === 0) {
      const todo: { i: number; j: number }[] = [];
      for (let i = 0; i < els.length; i++) for (let j = i + 1; j < els.length; j++) todo.push({ i, j });
      pairs = await Promise.all(
        todo.map(({ i, j }, pairIndex) =>
          limit(async () => {
            const r = await judgePair(seat, { ...base, a: els[i], b: els[j] }, { seed: mockSeed, group: key, pairIndex, attempt: 0 });
            return { i, j, ...r.judgement, attempt: 0, promptId: r.log.promptId, modelId: r.log.modelId, tokensIn: r.log.tokensIn, tokensOut: r.log.tokensOut };
          }),
        ),
      );
    } else {
      const previous = m.pairs as unknown as PairRecord[];
      const returned = m.returnedPairs as unknown as { i: number; j: number; implied: number }[];
      const redo = await Promise.all(
        returned.map((rp) =>
          limit(async () => {
            const prev = previous.find((p) => p.i === rp.i && p.j === rp.j)!;
            const pairIndex = previous.indexOf(prev);
            const r = await reviewPair(
              seat,
              { ...base, a: els[rp.i], b: els[rp.j], previous: { preferred: prev.preferred, intensity: prev.intensity, reason: prev.reason }, impliedFromOthers: ratioText(rp.implied) },
              { seed: mockSeed, group: key, pairIndex, attempt: m.attempt },
            );
            return { i: rp.i, j: rp.j, ...r.judgement, attempt: m.attempt, promptId: r.log.promptId, modelId: r.log.modelId, tokensIn: r.log.tokensIn, tokensOut: r.log.tokensOut };
          }),
        ),
      );
      pairs = previous.map((p) => redo.find((r) => r.i === p.i && r.j === p.j) ?? p);
    }
    const cells = buildMatrixFromPairs(els.length, pairs.map((p) => ({ i: p.i, j: p.j, value: pairValue(p.preferred, p.intensity) })));
    const result = priorityVector(cells);
    const saved = await saveAhpMatrix(m.id, pairs, cells, result);
    return { kind: saved.sessionDone ? "SESSION_DONE" : "MATRIX_DONE", seatIndex: m.seatIndex, group: key, status: saved.status, cr: saved.cr };
  } catch (error) {
    // Nothing partial is stored: the matrix stays PENDING and the session stops.
    const message = error instanceof Error ? error.message : String(error);
    await setAhpSessionStatus(null, sessionId, "FAIL", `Kursi ${m.seatIndex} ${key}: ${message}`);
    return { kind: "FAILED", error: message };
  }
}
