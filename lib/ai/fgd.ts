import { callObject, callText, type CallLog, type CallTarget } from "./call";
import { mockArgument, mockCrossTalk, mockNotes, mockPresentation, mockStance, mockVote } from "./mock/fgd-fixtures";
import {
  FGD_FACILITATOR_PRESENT,
  FGD_FACILITATOR_SYSTEM,
  FGD_NOTETAKER_EXTRACT,
  FGD_NOTETAKER_SYSTEM,
  FGD_SEAT_ARGUE,
  FGD_SEAT_CROSSTALK,
  FGD_SEAT_VOTE,
  type ComponentContext,
} from "./prompts/fgd";
import { NoteExtractionSchema, VoteSchema, type NoteExtraction, type Vote } from "./schemas";

// FGD roles (docs/04 §5–§6). This module knows nothing about decision rules:
// it returns utterances, votes, and suggestions; lib/method decides.

export interface SeatRuntime {
  seatIndex: number;
  label: string;
  field: string;
  /** PersonaBrief.systemPrompt of an APPROVED persona. */
  systemPrompt: string;
  target: CallTarget;
}

export interface Utterance {
  kind: "PRESENT" | "ARGUE" | "CROSSTALK";
  speaker: string;
  seatIndex: number | null;
  content: string;
  log: CallLog;
}

// 250 → 150 on 2026-09-29 (researcher decision: shorter, to-the-point turns to save tokens).
const MAX_WORDS = 150;

export async function present(facilitator: CallTarget, c: ComponentContext): Promise<Utterance> {
  const r = await callText({
    target: facilitator,
    prompt: FGD_FACILITATOR_PRESENT,
    system: FGD_FACILITATOR_SYSTEM,
    text: FGD_FACILITATOR_PRESENT.render(c),
    maxOutputTokens: 400,
    mock: () => mockPresentation(c.componentTitle),
  });
  return { kind: "PRESENT", speaker: "Fasilitator", seatIndex: null, content: r.text, log: r.log };
}

export async function argue(seat: SeatRuntime, c: ComponentContext, presentation: string, mockSeed: number, targetCode: string): Promise<Utterance> {
  const r = await callText({
    target: seat.target,
    prompt: FGD_SEAT_ARGUE,
    system: seat.systemPrompt,
    text: FGD_SEAT_ARGUE.render({ ...c, presentation, maxWords: MAX_WORDS }),
    maxOutputTokens: 600,
    mock: () => mockArgument(seat.label, seat.field, c.componentTitle, mockStance(mockSeed, seat.seatIndex, targetCode)),
  });
  return { kind: "ARGUE", speaker: seat.label, seatIndex: seat.seatIndex, content: r.text, log: r.log };
}

export async function crossTalk(
  seat: SeatRuntime,
  c: ComponentContext,
  presentation: string,
  ownArgument: string,
  others: { label: string; text: string }[],
): Promise<Utterance> {
  const r = await callText({
    target: seat.target,
    prompt: FGD_SEAT_CROSSTALK,
    system: seat.systemPrompt,
    text: FGD_SEAT_CROSSTALK.render({ ...c, presentation, maxWords: MAX_WORDS, ownArgument, others }),
    maxOutputTokens: 400,
    mock: () => mockCrossTalk(seat.label),
  });
  return { kind: "CROSSTALK", speaker: seat.label, seatIndex: seat.seatIndex, content: r.text, log: r.log };
}

/** A separate call from the argument, without other seats' votes (docs/04 §6, docs/09 §5). */
export async function vote(seat: SeatRuntime, c: ComponentContext, ownStatements: string[], mockSeed: number, targetCode: string): Promise<{ vote: Vote; log: CallLog }> {
  const r = await callObject({
    target: seat.target,
    prompt: FGD_SEAT_VOTE,
    system: seat.systemPrompt,
    text: FGD_SEAT_VOTE.render({ ...c, ownStatements }),
    schema: VoteSchema,
    maxOutputTokens: 500,
    mock: () => mockVote(mockStance(mockSeed, seat.seatIndex, targetCode)),
  });
  return { vote: r.value, log: r.log };
}

/**
 * Formatting-only normalisation for the verbatim check: whitespace, Markdown
 * emphasis markers, and quote/dash/ellipsis variants. Words must still match.
 */
export const normalizeQuote = (s: string) =>
  s
    .normalize("NFKC")
    .replace(/[*_`]+/g, "")
    .replace(/[“”„«»]/g, '"')
    .replace(/[‘’‚]/g, "'")
    .replace(/[–—−]/g, "-")
    .replace(/…/g, "...")
    .replace(/\s+/g, " ")
    .trim();

/** docs/04 §5: every quote must be verbatim from that seat's own utterances. */
export function quoteProblem(notes: NoteExtraction, bySeat: Map<number, string>): string | null {
  for (const s of notes.suggestions) {
    const said = bySeat.get(s.seatIndex);
    if (!said) return `seatIndex ${s.seatIndex} tidak berbicara`;
    if (!normalizeQuote(said).includes(normalizeQuote(s.quote))) return `kutipan kursi ${s.seatIndex} bukan substring ucapannya: ${JSON.stringify(s.quote.slice(0, 120))}`;
  }
  return null;
}

export async function extractNotes(
  notetaker: CallTarget,
  componentTitle: string,
  transcript: { seatIndex: number; label: string; text: string }[],
): Promise<{ notes: NoteExtraction; log: CallLog }> {
  const bySeat = new Map<number, string>();
  for (const u of transcript) bySeat.set(u.seatIndex, `${bySeat.get(u.seatIndex) ?? ""}\n${u.text}`);
  const r = await callObject({
    target: notetaker,
    prompt: FGD_NOTETAKER_EXTRACT,
    system: FGD_NOTETAKER_SYSTEM,
    text: FGD_NOTETAKER_EXTRACT.render({ componentTitle, transcript }),
    schema: NoteExtractionSchema,
    // Twelve long turns can yield many suggestions with verbatim quotes; 1500 cut the JSON off.
    maxOutputTokens: 12000,
    mock: () => mockNotes(transcript),
    validate: (notes) => quoteProblem(notes, bySeat),
  });
  return { notes: r.value, log: r.log };
}
