import { AsyncLocalStorage } from "node:async_hooks";
import { createHash } from "node:crypto";

import { generateText, Output } from "ai";
import type { z } from "zod";

import { isMockAi, mockModel, resolveLanguageModel } from "./models";
import type { ModelTarget } from "./provider-registry";

export interface CallTarget extends ModelTarget {
  temperature?: number;
  seed?: number | null;
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
  await sink?.before({ modelId, promptId: input.prompt.id, inputChars: input.system.length + input.text.length, maxOutputTokens: input.maxOutputTokens });
  const started = Date.now();
  try {
    const r = await generateText({
      model: model(input.target, input.mock),
      system: input.system,
      prompt: input.text,
      temperature: input.target.temperature,
      seed: input.target.seed ?? undefined,
      maxOutputTokens: input.maxOutputTokens,
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
    await sink?.before({ modelId, promptId: input.prompt.id, inputChars: input.system.length + input.text.length, maxOutputTokens: input.maxOutputTokens });
    const started = Date.now();
    let usage: { inputTokens?: number; outputTokens?: number } | null = null;
    try {
      const r = await generateText({
        model: model(input.target, () => JSON.stringify(input.mock())),
        system: input.system,
        prompt: input.text,
        output: Output.object({ schema: input.schema }),
        temperature: input.target.temperature,
        seed: input.target.seed ?? undefined,
        maxOutputTokens: input.maxOutputTokens,
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
      // Tokens of a rejected attempt were still spent and are recorded.
      await sink?.after({ ...base, tokensIn: usage?.inputTokens ?? null, tokensOut: usage?.outputTokens ?? null, latencyMs: Date.now() - started }, lastError);
    }
  }
  throw new SchemaFailure(input.prompt.id, lastError);
}
