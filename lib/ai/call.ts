import { AsyncLocalStorage } from "node:async_hooks";
import { createHash } from "node:crypto";

import { generateText, Output } from "ai";
import type { z } from "zod";

import { isMockAi, lowThinkingOptions, mockModel, resolveLanguageModel } from "./models";
import type { ModelTarget } from "./provider-registry";

export interface CallTarget extends ModelTarget {
  temperature?: number;
  seed?: number | null;
  /** "low": hidden reasoning off/down for the model family (panel seats only). */
  thinking?: "low" | null;
}

export interface CallLog {
  modelId: string;
  promptId: string;
  promptVersion: string;
  promptHash: string;
  tokensIn: number | null;
  tokensOut: number | null;
  latencyMs: number;
}

export class SchemaFailure extends Error {
  constructor(readonly promptId: string, message: string) {
    super(`Keluaran ${promptId} tidak memenuhi skema setelah 2 percobaan: ${message}`);
    this.name = "SchemaFailure";
  }
}

/**
 * Ledger hook (SPECIFICATION §4.9): the coordination layer runs a step inside
 * `withCallSink`; every call asks `before` (budget check — throws to refuse)
 * and reports to `after`. lib/ai itself knows nothing about prices or the DB.
 */
export interface CallSink {
  before(call: { modelId: string; promptId: string; inputChars: number; maxOutputTokens: number }): Promise<void>;
  after(log: CallLog, error: string | null): Promise<void>;
}

export class BudgetExceededError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "BudgetExceededError";
  }
}

const sinks = new AsyncLocalStorage<CallSink>();

export function withCallSink<T>(sink: CallSink, fn: () => Promise<T>): Promise<T> {
  return sinks.run(sink, fn);
}

const hash = (system: string, prompt: string) => createHash("sha256").update(`${system}\n---\n${prompt}`).digest("hex");

/**
 * Reasoning models (Gemini 3.x, GPT-5.x, DeepSeek V4, Qwen 3.6) spend output
 * tokens on thinking before the answer; with the prompt-sized caps alone the
 * JSON is cut off (finishReason "length"). Prompts still bound the visible
 * answer; the headroom is added to real calls and counted in the budget check.
 */
export const REASONING_HEADROOM = 4096;
const outputCap = (n: number) => (isMockAi() ? n : n + REASONING_HEADROOM);
const providerOptions = (target: CallTarget) => (!isMockAi() && target.thinking === "low" ? lowThinkingOptions(target.modelId) : undefined) as never;

function model(target: CallTarget, mock: () => string) {
  return isMockAi() ? mockModel(`mock:${target.modelId}`, mock) : resolveLanguageModel(target);
}

export async function callText(input: {
  target: CallTarget;
  prompt: { id: string; version: string };
  system: string;
  text: string;
  maxOutputTokens: number;
  mock: () => string;
}): Promise<{ text: string; log: CallLog }> {
  const sink = sinks.getStore();
  const modelId = isMockAi() ? `mock:${input.target.modelId}` : input.target.modelId;
  const base = { modelId, promptId: input.prompt.id, promptVersion: input.prompt.version, promptHash: hash(input.system, input.text) };
  await sink?.before({ modelId, promptId: input.prompt.id, inputChars: input.system.length + input.text.length, maxOutputTokens: outputCap(input.maxOutputTokens) });
  const started = Date.now();
  try {
    const r = await generateText({
      model: model(input.target, input.mock),
      system: input.system,
      prompt: input.text,
      temperature: input.target.temperature,
      seed: input.target.seed ?? undefined,
      maxOutputTokens: outputCap(input.maxOutputTokens),
      providerOptions: providerOptions(input.target),
      // docs/04 §9: two retries with backoff for network failures.
      maxRetries: 2,
    });
    const log: CallLog = { ...base, tokensIn: r.usage.inputTokens ?? null, tokensOut: r.usage.outputTokens ?? null, latencyMs: Date.now() - started };
    await sink?.after(log, null);
    return { text: r.text.trim(), log };
  } catch (error) {
    await sink?.after({ ...base, tokensIn: null, tokensOut: null, latencyMs: Date.now() - started }, error instanceof Error ? error.message : String(error));
    throw error;
  }
}

/**
 * Structured output with the Zod schema. A schema failure is retried once;
 * a second failure throws SchemaFailure — never a default value (docs/04 §10).
 * `validate` adds checks the schema cannot express (e.g. verbatim quotes).
 */
export async function callObject<S extends z.ZodType>(input: {
  target: CallTarget;
  prompt: { id: string; version: string };
  system: string;
  text: string;
  schema: S;
  maxOutputTokens: number;
  mock: () => z.infer<S>;
  validate?: (value: z.infer<S>) => string | null;
}): Promise<{ value: z.infer<S>; log: CallLog }> {
  let lastError = "";
  const sink = sinks.getStore();
  const modelId = isMockAi() ? `mock:${input.target.modelId}` : input.target.modelId;
  const base = { modelId, promptId: input.prompt.id, promptVersion: input.prompt.version, promptHash: hash(input.system, input.text) };
  for (let attempt = 1; attempt <= 2; attempt++) {
    // A refused budget check is not a schema failure: it propagates at once.
    await sink?.before({ modelId, promptId: input.prompt.id, inputChars: input.system.length + input.text.length, maxOutputTokens: outputCap(input.maxOutputTokens) });
    const started = Date.now();
    let usage: { inputTokens?: number; outputTokens?: number } | null = null;
    try {
      const r = await generateText({
        model: model(input.target, () => JSON.stringify(input.mock())),
        system: input.system,
        // The single retry tells the model why its first answer was rejected.
        prompt: attempt === 1 || !lastError ? input.text : `${input.text}\n\nKELUARAN SEBELUMNYA DITOLAK: ${lastError.slice(0, 400)}\nPerbaiki dan kirim ulang sesuai skema; kutipan harus disalin persis dari teks sumber.`,
        output: Output.object({ schema: input.schema }),
        temperature: input.target.temperature,
        seed: input.target.seed ?? undefined,
        maxOutputTokens: outputCap(input.maxOutputTokens),
        providerOptions: providerOptions(input.target),
        maxRetries: 2,
      });
      usage = r.usage;
      const value = r.output as z.infer<S>;
      const problem = input.validate?.(value) ?? null;
      if (problem) throw new Error(problem);
      const log: CallLog = { ...base, tokensIn: r.usage.inputTokens ?? null, tokensOut: r.usage.outputTokens ?? null, latencyMs: Date.now() - started };
      await sink?.after(log, null);
      return { value, log };
    } catch (error) {
      lastError = error instanceof Error ? error.message : String(error);
      // Parse failures carry the raw text; keep its tail and the finish reason for diagnosis.
      const raw = error as { text?: string; finishReason?: string; cause?: unknown };
      // Schema mismatches carry the validation issues in the cause; they tell the retry what to fix.
      if (raw.cause instanceof Error && raw.cause.message) lastError += ` (${raw.cause.message.replace(/\s+/g, " ").slice(0, 300)})`;
      if (typeof raw.text === "string") lastError += ` [finishReason=${raw.finishReason ?? "?"}; ${raw.text.length} chars; tail=${JSON.stringify(raw.text.slice(-160))}]`;
      // Tokens of a rejected attempt were still spent and are recorded.
      await sink?.after({ ...base, tokensIn: usage?.inputTokens ?? null, tokensOut: usage?.outputTokens ?? null, latencyMs: Date.now() - started }, lastError);
    }
  }
  throw new SchemaFailure(input.prompt.id, lastError);
}
