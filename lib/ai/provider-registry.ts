import { createAnthropic } from "@ai-sdk/anthropic";
import { createDeepSeek } from "@ai-sdk/deepseek";
import { createGoogle } from "@ai-sdk/google";
import { createMistral } from "@ai-sdk/mistral";
import { createOpenAI } from "@ai-sdk/openai";
import { createOpenAICompatible } from "@ai-sdk/openai-compatible";
import type { LanguageModel } from "ai";

export interface ModelTarget {
  providerKey: string;
  modelId: string;
  envKeyName: string;
  baseUrl: string | null;
}

// docs/04 §3. Keys are read from the server environment by name only.
export function resolveModel(target: ModelTarget): LanguageModel {
  const apiKey = process.env[target.envKeyName];
  if (!apiKey) throw new Error(`Variabel ${target.envKeyName} belum terpasang di server.`);
  switch (target.providerKey) {
    case "openai":
      return createOpenAI({ apiKey })(target.modelId);
    case "anthropic":
      return createAnthropic({ apiKey })(target.modelId);
    case "google":
      return createGoogle({ apiKey })(target.modelId);
    case "deepseek":
      return createDeepSeek({ apiKey })(target.modelId);
    case "mistral":
      return createMistral({ apiKey })(target.modelId);
    default:
      if (target.providerKey === "qwen" || target.providerKey.startsWith("custom-")) {
        if (!target.baseUrl) throw new Error(`Provider ${target.providerKey} butuh baseUrl.`);
        return createOpenAICompatible({ name: target.providerKey, apiKey, baseURL: target.baseUrl })(target.modelId);
      }
      throw new Error(`Provider tidak dikenal: ${target.providerKey}`);
  }
}
