import { generateText } from "ai";

import { isMockAi, resolveLanguageModel } from "./models";
import type { ModelTarget } from "./provider-registry";

export type PingResult =
  | { ok: true; mode: "MOCK"; checks: string[] }
  | { ok: true; mode: "LIVE"; latencyMs: number; inputTokens: number | null; outputTokens: number | null; reply: string }
  | { ok: false; mode: "MOCK" | "LIVE"; error: string };

/**
 * docs/03 testProvider. With MOCK_AI=1 only the configuration is checked and
 * the network is never touched. Otherwise a fixed "ping" is sent — no persona,
 * CV, or artifact content — to a provider approved in docs/07 §5.
 */
export async function pingModel(target: ModelTarget & { approved: boolean; enabled: boolean }): Promise<PingResult> {
  const checks: string[] = [];
  if (!target.approved) return { ok: false, mode: isMockAi() ? "MOCK" : "LIVE", error: "Provider belum disetujui (docs/07 §5)." };
  if (!target.enabled) return { ok: false, mode: isMockAi() ? "MOCK" : "LIVE", error: "Provider dinonaktifkan." };
  if (isMockAi()) {
    checks.push("Provider disetujui dan aktif");
    checks.push(process.env[target.envKeyName] ? `${target.envKeyName} terpasang` : `${target.envKeyName} belum terpasang (tidak diperlukan saat MOCK_AI=1)`);
    return { ok: true, mode: "MOCK", checks };
  }
  const started = Date.now();
  try {
    const result = await generateText({
      model: resolveLanguageModel(target),
      prompt: "Balas hanya dengan satu kata: pong",
      maxOutputTokens: 8,
      maxRetries: 0,
      timeout: 20_000,
    });
    return {
      ok: true,
      mode: "LIVE",
      latencyMs: Date.now() - started,
      inputTokens: result.usage.inputTokens ?? null,
      outputTokens: result.usage.outputTokens ?? null,
      reply: result.text.slice(0, 40),
    };
  } catch (error) {
    return { ok: false, mode: "LIVE", error: error instanceof Error ? error.message.slice(0, 300) : String(error) };
  }
}
