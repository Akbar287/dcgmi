import { describe, expect, it } from 'vitest';

import { runMethodSelfCheck } from '../selfcheck';

// SPECIFICATION §6.1 at runtime: the docs/05 vectors, executed by the app itself.
describe('runMethodSelfCheck', () => {
  it('runs every docs/05 vector group and they all pass', () => {
    const r = runMethodSelfCheck();
    expect(r.map((c) => c.id)).toEqual(expect.arrayContaining(['C1', 'C3', 'C7', 'SCVI', 'A1', 'A2', 'A3', 'A4', 'A5', 'S1', 'S2', 'S3', 'S4', 'S5', 'FGD-R', 'E3']));
    expect(r.filter((c) => !c.ok)).toEqual([]);
  });
});
