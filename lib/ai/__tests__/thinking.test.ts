import { describe, expect, it } from "vitest";

import { lowThinkingOptions } from "../models";

describe("lowThinkingOptions", () => {
  it("maps each gateway family to its switch; families without one get none", () => {
    expect(lowThinkingOptions("alibaba/qwen-3.6-max-preview")).toEqual({ alibaba: { enableThinking: false } });
    expect(lowThinkingOptions("deepseek/deepseek-v4-pro")).toEqual({ deepseek: { thinking: { type: "disabled" } } });
    expect(lowThinkingOptions("google/gemini-3.5-flash")).toEqual({ google: { thinkingConfig: { thinkingLevel: "minimal" } } });
    expect(lowThinkingOptions("google/gemini-3.1-pro-preview")).toEqual({ google: { thinkingConfig: { thinkingLevel: "low" } } });
    expect(lowThinkingOptions("openai/gpt-5.4")).toEqual({ openai: { reasoningEffort: "low" } });
    expect(lowThinkingOptions("anthropic/claude-sonnet-5")).toBeUndefined();
    expect(lowThinkingOptions("mistral/mistral-large-3")).toBeUndefined();
  });
});
