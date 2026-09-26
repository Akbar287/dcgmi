// Sensitivity preset (researcher decision 2026-09-26): each aggregated domain
// weight shifted by ±0.05 and ±0.10 absolute, the rest renormalised by
// lib/method `sensitivity`. A research-design default, not a threshold, so it
// lives here and is editable per session before it is created.
export const DEFAULT_SENSITIVITY_DELTAS = [-0.1, -0.05, 0.05, 0.1] as const;

export interface SensitivityScenarioSpec {
  name: string;
  target: string;
  delta: number;
}

const fmt = (d: number) => `${d > 0 ? "+" : "−"}${Math.abs(d).toFixed(2)}`;

export function defaultScenarios(domainCodes: string[]): SensitivityScenarioSpec[] {
  return domainCodes.flatMap((target) => DEFAULT_SENSITIVITY_DELTAS.map((delta) => ({ name: `${target} ${fmt(delta)}`, target, delta })));
}

export function scenariosToText(list: SensitivityScenarioSpec[]): string {
  return list.map((s) => `${s.target} ${s.delta > 0 ? "+" : ""}${s.delta}`).join("\n");
}

/** One scenario per line: `<domain code> <delta>`, delta in (−1, 1), e.g. `D3 -0.05`. */
export function parseScenarios(text: string, domainCodes: string[]): { scenarios: SensitivityScenarioSpec[]; errors: string[] } {
  const scenarios: SensitivityScenarioSpec[] = [];
  const errors: string[] = [];
  text
    .split("\n")
    .map((l) => l.trim())
    .filter(Boolean)
    .forEach((line, n) => {
      const m = /^(\S+)\s+([+-−]?\d*[.,]?\d+)$/.exec(line);
      const target = m?.[1];
      const delta = m ? Number(m[2].replace("−", "-").replace(",", ".")) : NaN;
      if (!target || !domainCodes.includes(target) || !Number.isFinite(delta) || delta === 0 || Math.abs(delta) >= 1) errors.push(`Baris ${n + 1}: ${line}`);
      else scenarios.push({ name: `${target} ${fmt(delta)}`, target, delta });
    });
  return { scenarios, errors };
}
