// Token assumptions per prompt for the estimator when no real (non-mock) call
// history exists yet. Estimation inputs only — never used for a decision.
export const DEFAULT_TOKENS: Record<string, { in: number; out: number }> = {
  "fgd.facilitator.present": { in: 1500, out: 300 },
  "fgd.seat.argue": { in: 2200, out: 450 },
  "fgd.seat.crosstalk": { in: 2800, out: 250 },
  "fgd.seat.vote": { in: 2200, out: 220 },
  "fgd.notetaker.extract": { in: 3500, out: 700 },
  "delphi.seat.rate": { in: 1800, out: 150 },
  "ahp.seat.pairwise": { in: 900, out: 120 },
  "ahp.seat.review": { in: 1000, out: 120 },
  "scoring.assessor.evidence": { in: 2600, out: 260 },
};
