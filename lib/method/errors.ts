export type MethodErrorCode =
  | 'WEIGHTS_NOT_NORMALIZED'
  | 'INVALID_LEVEL'
  | 'INVALID_RELEVANCE'
  | 'EMPTY_INPUT'
  | 'MATRIX_NOT_SQUARE'
  | 'MATRIX_NOT_RECIPROCAL'
  | 'MATRIX_NON_POSITIVE'
  | 'MATRIX_TOO_LARGE'
  | 'PANEL_SIZE_DEVIATION'
  | 'NO_ACCEPTED_MATRIX'
  | 'DUPLICATE_SEAT';

export class MethodError extends Error {
  readonly code: MethodErrorCode;
  readonly details?: unknown;

  constructor(code: MethodErrorCode, message: string, details?: unknown) {
    super(message);
    this.name = 'MethodError';
    this.code = code;
    this.details = details;
  }
}

export class GateError extends Error {
  readonly gate: string;
  readonly unmet: string[];

  constructor(gate: string, unmet: string[]) {
    super(`Gate ${gate} belum terpenuhi: ${unmet.join(', ')}`);
    this.name = 'GateError';
    this.gate = gate;
    this.unmet = unmet;
  }
}
