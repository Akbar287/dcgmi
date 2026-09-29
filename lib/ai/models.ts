import { createGateway, type LanguageModel } from "ai";
import { MockLanguageModelV4 } from "ai/test";

import { resolveModel as resolveDirect, type ModelTarget } from "./provider-registry";

export const GATEWAY_PROVIDER_KEY = "gateway";
export const GATEWAY_ENV_KEY = "AI_GATEWAY_API_KEY";

/**
 * Upstream families that docs/07 §5 approves, as Vercel AI Gateway prefixes.
 * "bersyarat" families are allowed but flagged in the UI.
 */
export const GATEWAY_FAMILIES: Record<string, { label: string; conditional: boolean }> = {
  openai: { label: "OpenAI", conditional: false },
  anthropic: { label: "Anthropic", conditional: false },
  google: { label: "Google", conditional: false },
  deepseek: { label: "DeepSeek", conditional: true },
  alibaba: { label: "Alibaba Qwen", conditional: true },
  mistral: { label: "Mistral", conditional: true },
  xai: { label: "xAI", conditional: true },
};

export function gatewayFamily(modelId: string): string | null {
  const prefix = modelId.split("/")[0];
  return prefix && prefix in GATEWAY_FAMILIES ? prefix : null;
}

export const isMockAi = () => process.env.MOCK_AI === "1";

/**
 * "Thinking rendah" for panel seats (researcher decision 2026-09-29, token
 * savings): per-family provider options that switch hidden reasoning off or
 * down through the gateway. Families without a working switch get none.
 */
export function lowThinkingOptions(modelId: string): Record<string, Record<string, unknown>> | undefined {
  const family = gatewayFamily(modelId);
  if (family === "alibaba") return { alibaba: { enableThinking: false } };
  if (family === "deepseek") return { deepseek: { thinking: { type: "disabled" } } };
  if (family === "google") return { google: { thinkingConfig: { thinkingLevel: /flash/.test(modelId) ? "minimal" : "low" } } };
  if (family === "openai") return { openai: { reasoningEffort: "low" } };
  return undefined;
}

/** MOCK_AI=1: the same AI SDK code path runs against a deterministic fixture (docs/04 §3). */
export function mockModel(modelId: string, output: () => string): LanguageModel {
  return new MockLanguageModelV4({
    provider: "mock",
    modelId,
    doGenerate: async () => {
      const text = output();
      return {
        content: [{ type: "text", text }],
        finishReason: { unified: "stop", raw: "stop" },
        usage: {
          inputTokens: { total: 0, noCache: 0, cacheRead: 0, cacheWrite: 0 },
          outputTokens: { total: Math.ceil(text.length / 4), text: Math.ceil(text.length / 4), reasoning: 0 },
        },
        warnings: [],
      };
    },
  });
}

export function resolveLanguageModel(target: ModelTarget): LanguageModel {
  if (target.providerKey === GATEWAY_PROVIDER_KEY) {
    if (!gatewayFamily(target.modelId)) throw new Error(`Model ${target.modelId} bukan dari provider yang disetujui (docs/07 §5).`);
    const apiKey = process.env[GATEWAY_ENV_KEY];
    if (!apiKey) throw new Error(`${GATEWAY_ENV_KEY} belum terpasang di server.`);
    return createGateway({ apiKey })(target.modelId);
  }
  return resolveDirect(target);
}

/** Model catalog from the gateway, filtered to approved families. */
export async function listGatewayModels(): Promise<{ id: string; name: string; family: string; pricing: { input: string; output: string } | null }[]> {
  const apiKey = process.env[GATEWAY_ENV_KEY];
  if (!apiKey) throw new Error(`${GATEWAY_ENV_KEY} belum terpasang di server.`);
  const { models } = await createGateway({ apiKey }).getAvailableModels();
  return models
    .filter((m) => (m as { modelType?: string }).modelType !== "embedding" && (m as { modelType?: string }).modelType !== "image")
    .map((m) => ({ id: m.id, name: m.name ?? m.id, family: gatewayFamily(m.id) ?? "", pricing: m.pricing ? { input: m.pricing.input, output: m.pricing.output } : null }))
    .filter((m) => m.family);
}
