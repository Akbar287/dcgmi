import { describe, expect, it } from "vitest";

import { findIdentifiers } from "../deidentify";
import { PERSONA_PROMPT_VERSION, renderPersonaPrompt } from "../prompt";
import { personaBriefSchema, type PersonaBriefInput } from "../schema";

const clean: PersonaBriefInput = {
  expertiseAreas: ["Tata kelola TI perguruan tinggi", "Manajemen risiko digital"],
  yearsExperience: 15,
  institutionType: "PTN_BESAR",
  researchFocus: ["Keselarasan strategi TI", "Audit sistem informasi"],
  methodStance: "Menekankan keterukuran indikator dan keterlacakan bukti; skeptis terhadap skor komposit tunggal.",
  vocabularyHints: ["COBIT", "value delivery", "akreditasi"],
  emphasisBias: "Kelayakan bukti di PTS kecil dan beban administratif asesmen.",
};

describe("persona de-identification", () => {
  it("passes a competence-only brief", () => {
    expect(findIdentifiers(clean, ["Budi Santoso", "Universitas Contoh Raya"])).toEqual([]);
  });

  it("catches titles, institutions, places, contacts, numbers, and publication titles", () => {
    const leaky: PersonaBriefInput = {
      ...clean,
      expertiseAreas: ["Prof. tata kelola TI", "Dosen Universitas Gadjah Mada"],
      researchFocus: ["SPBE di Bandung", "Riset bersama ITB"],
      methodStance: 'Penulis "Model Kematangan Tata Kelola TI untuk Kampus" (2021); NIDN 0412345678',
      emphasisBias: "Hubungi budi@kampus.ac.id atau 081234567890, lihat https://orcid.org/x",
    };
    const rules = new Set(findIdentifiers(leaky).map((f) => f.rule));
    for (const r of ["ACADEMIC_TITLE", "NAMED_INSTITUTION", "PLACE", "INSTITUTION_ACRONYM", "QUOTED_TITLE", "LONG_NUMBER", "EMAIL", "PHONE", "URL"]) {
      expect(rules.has(r as never), r).toBe(true);
    }
  });

  it("refuses the expert's own name and affiliation, including single name parts", () => {
    const brief = { ...clean, emphasisBias: "Gaya pak Santoso: menanyakan data mentah; pengalaman di contoh raya." };
    const matches = findIdentifiers(brief, ["Budi Santoso", "Universitas Contoh Raya"]).map((f) => f.match.toLowerCase());
    expect(matches).toContain("santoso");
    expect(matches).toContain("contoh raya");
  });

  it("does not treat words that merely contain a name part as a hit", () => {
    expect(findIdentifiers({ ...clean, methodStance: "Pendekatan santosoisme tidak dipakai." }, ["Budi Santoso"])).toEqual([]);
  });
});

describe("persona prompt", () => {
  it("renders the docs/04 §4.4 template with a version and stable hash", () => {
    const a = renderPersonaPrompt(clean, "8 domain, 15 aspek, 43 indikator");
    const b = renderPersonaPrompt(clean, "8 domain, 15 aspek, 43 indikator");
    expect(a.promptVersion).toBe(PERSONA_PROMPT_VERSION);
    expect(a.promptHash).toBe(b.promptHash);
    expect(a.prompt).toContain("- Bidang: Tata kelola TI perguruan tinggi, Manajemen risiko digital");
    expect(a.prompt).toContain("Anda TIDAK menghitung validitas isi.");
    expect(a.prompt).not.toMatch(/\{[a-zA-Z]+\}/);
  });

  it("limits list sizes as in PersonaExtractionSchema", () => {
    expect(personaBriefSchema.safeParse({ ...clean, vocabularyHints: Array(16).fill("x") }).success).toBe(false);
  });
});
