import { readFileSync } from "node:fs";
import { createContext, runInContext } from "node:vm";

import { beforeAll, describe, expect, it } from "vitest";

import { CONSENT_NO, CONSENT_YES, validatePage, validateSubmission } from "../answers";
import { BUILDER_SCRIPT_PATH, loadBuilderScript } from "../load-builder-script";
import { normalizeResponses, type ResponseRecord } from "../normalize";
import { toPages } from "../pages";
import { productionReadiness } from "../readiness";
import { parseSnapshot, toSettings, verifySnapshot } from "../snapshot";
import type { Answers, PreReviewSnapshot } from "../types";
import { validateSource } from "../validate-source";

let snap: PreReviewSnapshot;

beforeAll(() => {
  snap = loadBuilderScript();
});

function completeAnswers(code: string, decision?: (id: string) => string): Answers {
  const a: Answers = { consent: CONSENT_YES, expert: code, overallComment: "", fgdAvailability: "Bersedia" };
  for (const x of snap.data.items) {
    const d = decision?.(x.id) ?? snap.data.options.decision[0];
    a[`${x.id}:decision`] = d;
    a[`${x.id}:evidence`] = snap.data.options.evidence[0];
    a[`${x.id}:clarity`] = snap.data.options.clarity[0];
    a[`${x.id}:comment`] = d === snap.data.options.decision[0] ? "Tidak ada catatan" : "Definisi terlalu luas.";
    a[`${x.id}:revision`] = d === snap.data.options.decision[0] ? "Tidak ada usulan" : "Batasi pada layanan inti.";
  }
  return a;
}

describe("R1–V2.1.2B source", () => {
  it("loads the verified snapshot with the Google Forms plan", () => {
    expect(snap.dataSha256).toBe("352364f6c735f5102751de3583af858b1d44b1f6476b9c10c00566ab0786c4eb");
    expect(snap.plan).toHaveLength(272);
    expect(snap.plan.filter((p) => p.type !== "PAGE")).toHaveLength(262);
    expect(toPages(snap.plan)).toHaveLength(11);
    expect(snap.plan[0]).toMatchObject({ key: "consent", choices: [CONSENT_YES, CONSENT_NO], consent: true });
  });

  it("rejects a snapshot whose content changed by one character", () => {
    const tampered = structuredClone(snap.data);
    tampered.items[0].definition += ".";
    expect(validateSource(tampered, snap.dataSha256)[0]).toMatch(/Isi snapshot berubah/);
  });

  it("keeps hashes valid through JSONB key reordering and flags tampering", () => {
    const settings = toSettings(snap);
    const reordered = JSON.parse(JSON.stringify({ snapshot: settings.snapshot, signature: settings.signature, kind: settings.kind }));
    expect(verifySnapshot(reordered, snap.dataSha256)).toEqual([]);
    const tampered = { ...settings, snapshot: settings.snapshot.replace("Konektivitas jaringan kampus", "Konektivitas") };
    expect(verifySnapshot(tampered, snap.dataSha256).length).toBeGreaterThan(0);
    expect(parseSnapshot(settings).signature).toBe(snap.signature);
  });

  it("is ready for production with the researcher's CONFIG", () => {
    expect(productionReadiness(snap.config)).toEqual([]);
    expect(productionReadiness({ ...snap.config, SUMMARY_URL: "http://x" })).toHaveLength(1);
  });
});

describe("answer validation", () => {
  it("requires every mandatory field on a page", () => {
    const issues = validatePage(snap.plan, 2, {}, snap.data.options);
    const required = toPages(snap.plan)[2].fields.filter((f) => f.required);
    expect(issues.filter((i) => i.code === "REQUIRED")).toHaveLength(required.length);
  });

  it("allows 'Tidak ada catatan' only when the item is kept", () => {
    const id = snap.data.items[0].id;
    const answers = completeAnswers("P01", (x) => (x === id ? "Perlu dibahas dalam FGD" : snap.data.options.decision[0]));
    answers[`${id}:comment`] = "Tidak ada catatan";
    const issues = validateSubmission(snap.plan, answers, snap.data.options, "P01");
    expect(issues).toEqual([{ key: `${id}:comment`, canonicalId: id, code: "QUALITATIVE_REQUIRED" }]);
    expect(validateSubmission(snap.plan, completeAnswers("P01"), snap.data.options, "P01")).toEqual([]);
  });

  it("binds the expert code to the account", () => {
    const issues = validateSubmission(snap.plan, completeAnswers("P02"), snap.data.options, "P01");
    expect(issues.map((i) => i.code)).toEqual(["EXPERT_MISMATCH"]);
  });
});

describe("normalizeResponses parity with normalize_()", () => {
  function original(records: ResponseRecord[]) {
    const code = readFileSync(BUILDER_SCRIPT_PATH, "utf8");
    const ctx = createContext({ records });
    return JSON.parse(runInContext(`${code}\n;JSON.stringify(normalize_(records, "PRODUCTION"));`, ctx)) as unknown;
  }

  it("produces identical DataEntry, Supplement, and QC sheets", () => {
    const bad = completeAnswers("P03", () => "Perlu dibahas dalam FGD");
    bad[`${snap.data.items[1].id}:comment`] = "-";
    bad[`${snap.data.items[2].id}:evidence`] = "salah";
    const records: ResponseRecord[] = [
      { id: "r1", timestamp: "2026-09-26T01:00:00.000Z", values: completeAnswers("P01") },
      { id: "r2", timestamp: "2026-09-26T01:05:00.000Z", values: completeAnswers("P02") },
      { id: "r3", timestamp: "2026-09-26T01:06:00.000Z", values: completeAnswers("P02") },
      { id: "r4", timestamp: "2026-09-26T01:07:00.000Z", values: bad },
      { id: "r5", timestamp: "2026-09-26T01:08:00.000Z", values: { consent: CONSENT_NO } },
      { id: "r6", timestamp: "2026-09-26T01:09:00.000Z", values: completeAnswers("T01") },
    ];
    expect(JSON.parse(JSON.stringify(normalizeResponses(records, snap.data)))).toEqual(original(records));
  });
});
