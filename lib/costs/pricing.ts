// Cost arithmetic for the ledger and the estimator (SPECIFICATION §4.9).
// Not a methodological value: prices come from the model profile.

export interface Price {
  inputPer1k: number;
  outputPer1k: number;
}

/** Characters per token used only for the pre-call estimate (conservative for Indonesian/English). */
export const CHARS_PER_TOKEN = 3.5;

export function callCost(tokensIn: number | null, tokensOut: number | null, price: Price): number {
  return ((tokensIn ?? 0) * price.inputPer1k + (tokensOut ?? 0) * price.outputPer1k) / 1000;
}

/** Upper-bound estimate before a call: prompt size and the full output allowance. */
export function estimateCallCost(inputChars: number, maxOutputTokens: number, price: Price): number {
  return ((inputChars / CHARS_PER_TOKEN) * price.inputPer1k + maxOutputTokens * price.outputPer1k) / 1000;
}

/** Gateway catalog prices are USD per token (strings). */
export function perThousand(perToken: string | undefined | null): number | null {
  if (perToken === undefined || perToken === null || perToken === "") return null;
  const v = Number(perToken);
  return Number.isFinite(v) && v >= 0 ? v * 1000 : null;
}

export const isMockModel = (modelId: string) => modelId.startsWith("mock:");
