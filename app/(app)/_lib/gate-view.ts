import type { GateEvaluation } from "@/lib/method/gates";

// Unmet codes from evaluateBaselineGate() read "<RULE>: <indicator>[ ...]".
// Reusing them keeps the G1 completeness rule in lib/method only.
const INDICATOR_RULES = new Set([
  "MISSING_OPERATIONAL_DEFINITION",
  "INDICATOR_WITHOUT_RUBRIC",
  "RUBRIC_LEVEL_GAP",
  "INDICATOR_WITHOUT_EVIDENCE",
]);

export function incompleteIndicators(evaluation: GateEvaluation): Set<string> {
  const codes = new Set<string>();
  for (const entry of evaluation.unmet) {
    const match = /^([A-Z_]+): (\S+)/.exec(entry);
    if (match && INDICATOR_RULES.has(match[1])) codes.add(match[2]);
  }
  return codes;
}
