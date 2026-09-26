export type DataOrigin = "SIMULATED" | "REAL";

export class OriginMismatchError extends Error {
  readonly origins: DataOrigin[];

  constructor(origins: DataOrigin[]) {
    super(`Data SIMULATED dan REAL tidak boleh digabung: ${origins.join(", ")}`);
    this.name = "OriginMismatchError";
    this.origins = origins;
  }
}

// docs/07 P2: every aggregation over stored judgements calls this first.
export function assertSingleOrigin(rows: { dataOrigin: DataOrigin }[]): void {
  const kinds = new Set(rows.map((r) => r.dataOrigin));
  if (kinds.size > 1) throw new OriginMismatchError([...kinds]);
}
