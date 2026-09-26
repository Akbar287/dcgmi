import { describe, expect, it } from "vitest";

import { checkStructure, nextTarget, visitedPath } from "../branching";
import { answerKeys, type FieldDef, type FormDef, type SectionDef } from "../types";
import { checkField, parsePair, validateDraft, validateSection } from "../validate";

const field = (over: Partial<FieldDef>): FieldDef => ({ id: over.key ?? "f", key: "f", type: "SHORT_TEXT", label: "F", helpText: null, required: false, options: [], config: null, branching: null, ...over });
const section = (order: number, fields: FieldDef[], next: SectionDef["next"] = "NEXT"): SectionDef => ({ id: `s${order}`, order, title: `S${order}`, description: null, next, fields });
const form = (sections: SectionDef[]): FormDef => ({ id: "x", slug: "x", title: "X", purpose: "p", instructions: null, sections });

describe("answer validation", () => {
  it("checks each type", () => {
    expect(checkField(field({ type: "SINGLE_CHOICE", options: ["a", "b"] }), { f: "c" }, false)[0]?.code).toBe("INVALID_CHOICE");
    expect(checkField(field({ type: "MULTI_CHOICE", options: ["a", "b"] }), { f: '["a","b"]' }, true)).toEqual([]);
    expect(checkField(field({ type: "LINEAR_SCALE", config: { min: 1, max: 5 } }), { f: "6" }, false)[0]?.code).toBe("INVALID_SCALE");
    expect(checkField(field({ type: "RELEVANCE_4", config: { clarity: true } }), { f: "5" }, false)[0]?.code).toBe("INVALID_SCALE");
    expect(checkField(field({ type: "DATE" }), { f: "2026-13-40" }, false)[0]?.code).toBe("INVALID_DATE");
    expect(checkField(field({ type: "PARAGRAPH" }), { f: "x".repeat(5001) }, false)[0]?.code).toBe("TOO_LONG");
    expect(checkField(field({ type: "SHORT_TEXT", required: true }), {}, true)[0]?.code).toBe("REQUIRED");
    expect(checkField(field({ type: "SHORT_TEXT", required: true }), {}, false)).toEqual([]);
  });

  it("pairwise writes one key per pair and parses Saaty answers", () => {
    const f = field({ type: "PAIRWISE", key: "p", required: true, config: { elements: [{ code: "D1", label: "a" }, { code: "D2", label: "b" }, { code: "D3", label: "c" }] } });
    expect(answerKeys(f)).toEqual(["p:0-1", "p:0-2", "p:1-2"]);
    expect(parsePair("A:5")).toEqual({ preferred: "A", intensity: 5 });
    expect(parsePair("B:1")).toBeNull();
    expect(checkField(f, { "p:0-1": "EQ", "p:0-2": "A:9" }, true)).toEqual([{ key: "p:1-2", code: "REQUIRED" }]);
  });

  it("draft refuses unknown keys but not missing answers", () => {
    const f = form([section(0, [field({ key: "a", required: true })])]);
    expect(validateDraft(f, { a: "x" })).toEqual([]);
    expect(validateDraft(f, { zzz: "x" })).toEqual([{ key: "zzz", code: "UNKNOWN_FIELD" }]);
    expect(validateSection(f.sections[0], {})).toEqual([{ key: "a", code: "REQUIRED" }]);
  });
});

describe("branching", () => {
  const q = field({ key: "q", type: "SINGLE_CHOICE", options: ["ya", "tidak"], branching: { tidak: "SUBMIT", ya: 2 } });
  const f = form([section(0, [q]), section(1, [field({ key: "b" })]), section(2, [field({ key: "c" })], "SUBMIT")]);

  it("follows the answer, else the section default", () => {
    expect(nextTarget(f, f.sections[0], { q: "tidak" })).toBe("SUBMIT");
    expect(nextTarget(f, f.sections[0], { q: "ya" })).toBe(2);
    expect(nextTarget(f, f.sections[0], {})).toBe(1);
    expect(visitedPath(f, { q: "ya" })).toEqual([0, 2]);
  });

  it("reports unreachable sections, bad targets, and cycles", () => {
    expect(checkStructure(f).map((i) => i.code)).toEqual([]);
    const loop = form([section(0, [field({ key: "a" })]), section(1, [field({ key: "b", type: "DROPDOWN", options: ["x", "y"], branching: { x: 0 } })])]);
    expect(checkStructure(loop).map((i) => i.code)).toContain("CYCLE");
    const bad = form([section(0, [field({ key: "a" })], 7), section(1, [])]);
    expect(checkStructure(bad).map((i) => i.code).sort()).toEqual(["BAD_TARGET", "EMPTY_SECTION", "UNREACHABLE"]);
  });
});

import { buildDelphiForm, ratingFrom } from "../delphi-form";

describe("Delphi round form", () => {
  const item = (code: string, domainCode: string) => ({
    code, name: `Ind ${code}`, isControlledException: false, operationalDefinition: "def", assessmentObject: null, boundaryNote: null,
    rubric: [{ level: 1, label: "L1", descriptor: "d1" }], evidence: [], domainCode, domainName: `Dom ${domainCode}`, aspectCode: "A01", aspectName: "Asp",
  });
  const built = buildDelphiForm({ versionLabel: "A1.1", roundNumber: 1, items: [item("C01", "D1"), item("C02", "D1"), item("C03", "D2")], feedback: false });

  it("has an intro with consent, one section per domain, and a closing section", () => {
    expect(built.sections.map((s) => s.title)).toEqual(["Pengantar", "D1 Dom D1", "D2 Dom D2", "Penutup"]);
    expect(built.sections[1].fields.map((f) => [f.key, f.type])).toEqual([["C01", "RELEVANCE_4"], ["C02", "RELEVANCE_4"]]);
    expect(built.sections[0].fields[1].branching).toEqual({ "Tidak bersedia": "SUBMIT" });
  });

  it("never carries the decision thresholds", () => {
    expect(JSON.stringify(built)).not.toMatch(/0[.,]78|I-CVI|S-CVI|PERTAHANKAN|HAPUS_DARI_INTI/);
  });

  it("maps answers to ratings; declined or blank stays null", () => {
    expect(ratingFrom({ consent: "Bersedia", C01: "3", "C01:clarity": "1", "C01:clarityNote": " ambigu " }, "C01")).toEqual({ relevance: 3, clarityFlag: true, clarityNote: "ambigu" });
    expect(ratingFrom({ consent: "Tidak bersedia", C01: "3" }, "C01").relevance).toBeNull();
    expect(ratingFrom({ consent: "Bersedia" }, "C01").relevance).toBeNull();
  });
});
