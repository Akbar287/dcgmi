/**
 * Seed baseline DCGMI-A1.0.
 *
 * Seed ini SENGAJA tidak mengisi rubrik untuk seluruh 43 indikator. Hanya satu
 * indikator contoh (C01) yang lengkap, agar tim melihat bentuk targetnya.
 * Akibatnya G1_BASELINE akan GAGAL sampai rubrik dan persyaratan bukti
 * dilengkapi lewat aplikasi. Itu disengaja — gate harus punya gigi.
 *
 * Jalankan: pnpm db:seed
 */
// tsx does not read .env by itself; prisma.config.ts does the same.
import "dotenv/config";

import { prisma } from "../lib/prisma";
import {
  evaluateBaselineGate,
  type ArtifactSnapshot,
} from "../lib/method/gates";
import { BASELINE_A1_0, EXAMPLE_PACKAGE } from "./baseline/dcgmi-a1-0";
import { seedAdmin } from "./seed-admin";
import { validateBaseline } from "./validate-baseline";

const PROVIDERS = [
  {
    key: "openai",
    label: "OpenAI",
    envKeyName: "OPENAI_API_KEY",
    approved: true,
    models: [{ modelId: "gpt-4o", label: "GPT-4o", contextWindow: 128_000 }],
  },
  {
    key: "anthropic",
    label: "Anthropic",
    envKeyName: "ANTHROPIC_API_KEY",
    approved: true,
    models: [
      {
        modelId: "claude-sonnet-4-6",
        label: "Claude Sonnet 4.6",
        contextWindow: 200_000,
      },
    ],
  },
  {
    key: "google",
    label: "Google",
    envKeyName: "GOOGLE_GENERATIVE_AI_API_KEY",
    approved: true,
    models: [
      {
        modelId: "gemini-2.0-flash",
        label: "Gemini 2.0 Flash",
        contextWindow: 1_000_000,
      },
    ],
  },
  {
    key: "deepseek",
    label: "DeepSeek",
    envKeyName: "DEEPSEEK_API_KEY",
    approved: true,
    models: [
      {
        modelId: "deepseek-chat",
        label: "DeepSeek Chat",
        contextWindow: 64_000,
      },
    ],
  },
  {
    key: "qwen",
    label: "Alibaba Qwen",
    envKeyName: "QWEN_API_KEY",
    approved: true,
    baseUrl: "https://dashscope-intl.aliyuncs.com/compatible-mode/v1",
    models: [{ modelId: "qwen-max", label: "Qwen Max", contextWindow: 32_000 }],
  },
  {
    key: "mistral",
    label: "Mistral",
    envKeyName: "MISTRAL_API_KEY",
    approved: true,
    models: [
      {
        modelId: "mistral-large-latest",
        label: "Mistral Large",
        contextWindow: 128_000,
      },
    ],
  },
] as const;

/** Komposisi panel FGD — R1-V1.7 §3.7.1. Total 6. */
const FGD_SEATS = [
  {
    seatIndex: 1,
    label: "Pakar 1",
    field: "IT_GOVERNANCE",
    provider: "openai",
  },
  {
    seatIndex: 2,
    label: "Pakar 2",
    field: "IT_GOVERNANCE",
    provider: "deepseek",
  },
  { seatIndex: 3, label: "Pakar 3", field: "MANAJEMEN_PT", provider: "qwen" },
  {
    seatIndex: 4,
    label: "Pakar 4",
    field: "MANAJEMEN_PT",
    provider: "anthropic",
  },
  { seatIndex: 5, label: "Pakar 5", field: "SPBE", provider: "google" },
  {
    seatIndex: 6,
    label: "Pakar 6",
    field: "SUSTAINABILITY",
    provider: "mistral",
  },
] as const;

/** Panel Delphi — enam kursi FGD + dua pakar baru (§3.8.1). Total 8. */
const DELPHI_EXTRA_SEATS = [
  {
    seatIndex: 7,
    label: "Pakar 7 (baru)",
    field: "SPBE",
    provider: "openai",
    isNewMember: true,
  },
  {
    seatIndex: 8,
    label: "Pakar 8 (baru)",
    field: "SUSTAINABILITY",
    provider: "anthropic",
    isNewMember: true,
  },
] as const;

async function main(): Promise<void> {
  console.log("\n─── Seed DCGMI-A1.0 ───\n");

  const check = validateBaseline();
  console.log(`  Baseline: ${check.summary}`);
  if (!check.ok) {
    for (const i of check.issues) console.error(`  x ${i}`);
    throw new Error("Baseline tidak konsisten. Seed dibatalkan.");
  }

  // ── 1. Versi artefak ────────────────────────────────────────────
  const version = await prisma.artifactVersion.upsert({
    where: { label: "DCGMI-A1.0" },
    update: {},
    create: {
      label: "DCGMI-A1.0",
      status: "PROVISIONAL",
      note: "Baseline provisional hasil SLR/LAM dan coding (R1-V1.7 §3.5). Objek yang akan diuji melalui FGD dan Delphi/CVI, bukan instrumen final.",
    },
  });

  // ── 2. Hierarki ─────────────────────────────────────────────────
  let domainOrder = 0;
  let indicatorTotal = 0;

  for (const d of BASELINE_A1_0) {
    const domain = await prisma.domain.upsert({
      where: { versionId_code: { versionId: version.id, code: d.code } },
      update: {},
      create: {
        versionId: version.id,
        code: d.code,
        order: ++domainOrder,
        name: d.name,
        rationale: d.rationale,
        sdgTags: [...d.sdgTags],
        slrStrings: [...d.slrStrings],
      },
    });

    let aspectOrder = 0;
    for (const a of d.aspects) {
      const aspect = await prisma.aspect.upsert({
        where: { domainId_code: { domainId: domain.id, code: a.code } },
        update: {},
        create: {
          domainId: domain.id,
          code: a.code,
          order: ++aspectOrder,
          name: a.name,
          rationale: a.rationale,
        },
      });

      let indicatorOrder = 0;
      for (const i of a.indicators) {
        const isExample = i.code === EXAMPLE_PACKAGE.indicatorCode;
        const indicator = await prisma.indicator.upsert({
          where: { aspectId_code: { aspectId: aspect.id, code: i.code } },
          update: {},
          create: {
            aspectId: aspect.id,
            code: i.code,
            order: ++indicatorOrder,
            name: i.name,
            isControlledException: i.isControlledException ?? false,
            exceptionNote: i.exceptionNote ?? null,
            operationalDefinition: isExample
              ? EXAMPLE_PACKAGE.operationalDefinition
              : null,
            assessmentObject: isExample
              ? EXAMPLE_PACKAGE.assessmentObject
              : null,
            boundaryNote: isExample ? EXAMPLE_PACKAGE.boundaryNote : null,
            sources: isExample ? [...EXAMPLE_PACKAGE.sources] : [],
          },
        });
        indicatorTotal += 1;

        // Hanya indikator contoh yang dilengkapi rubrik dan bukti.
        if (isExample) {
          for (const level of EXAMPLE_PACKAGE.rubric) {
            await prisma.rubricLevel.upsert({
              where: {
                indicatorId_level: {
                  indicatorId: indicator.id,
                  level: level.level,
                },
              },
              update: {},
              create: { indicatorId: indicator.id, ...level },
            });
          }
          for (const e of EXAMPLE_PACKAGE.evidence) {
            await prisma.evidenceRequirement.create({
              data: { indicatorId: indicator.id, ...e },
            });
          }
        }
      }
    }
  }

  console.log(
    `  Hierarki: ${domainOrder} domain, ${indicatorTotal} indikator tersimpan`,
  );

  // ── 3. Jejak versi awal ─────────────────────────────────────────
  await prisma.changeLogEntry.create({
    data: {
      versionId: version.id,
      targetType: "ArtifactVersion",
      targetCode: "DCGMI-A1.0",
      action: "TAMBAH",
      reason:
        "Inisialisasi baseline provisional dari hasil SLR/LAM dan coding.",
      decisionSource: "SEED:R1-V1.7",
      impactNote:
        "Struktur 8-15-43 dengan distribusi 7-5-6-6-4-5-4-6. C20b dan C42 ditandai controlled exception.",
      actorId: "system",
    },
  });

  // ── 4. Provider dan model ───────────────────────────────────────
  const modelIdByProvider = new Map<string, string>();
  for (const p of PROVIDERS) {
    const provider = await prisma.provider.upsert({
      where: { key: p.key },
      update: { approved: p.approved },
      create: {
        key: p.key,
        label: p.label,
        envKeyName: p.envKeyName,
        baseUrl: "baseUrl" in p ? p.baseUrl : null,
        approved: p.approved,
      },
    });
    for (const m of p.models) {
      const model = await prisma.modelProfile.upsert({
        where: {
          providerId_modelId: { providerId: provider.id, modelId: m.modelId },
        },
        update: {},
        create: { providerId: provider.id, ...m },
      });
      if (!modelIdByProvider.has(p.key)) modelIdByProvider.set(p.key, model.id);
    }
  }
  console.log(`  Provider: ${PROVIDERS.length} terdaftar`);

  // ── 5. Konfigurasi panel ────────────────────────────────────────
  const facilitator = modelIdByProvider.get("anthropic")!;
  const notetaker = modelIdByProvider.get("openai")!;

  const fgdConfig = await prisma.panelConfig.create({
    data: {
      name: "Panel FGD 6 kursi (baseline R1-V1.7 §3.7.1)",
      preset: "FGD_6",
      panelSize: 6,
      facilitatorModelId: facilitator,
      notetakerModelId: notetaker,
      seats: {
        create: FGD_SEATS.map((s) => ({
          seatIndex: s.seatIndex,
          label: s.label,
          field: s.field,
          modelProfileId: modelIdByProvider.get(s.provider)!,
          contextScope: "FULL",
        })),
      },
    },
  });

  await prisma.panelConfig.create({
    data: {
      name: "Panel Delphi 8 kursi (6 dari FGD + 2 pakar baru, §3.8.1)",
      preset: "DELPHI_8",
      panelSize: 8,
      facilitatorModelId: facilitator,
      notetakerModelId: notetaker,
      seats: {
        create: [
          ...FGD_SEATS.map((s) => ({
            seatIndex: s.seatIndex,
            label: s.label,
            field: s.field,
            modelProfileId: modelIdByProvider.get(s.provider)!,
            contextScope: "FULL",
          })),
          ...DELPHI_EXTRA_SEATS.map((s) => ({
            seatIndex: s.seatIndex,
            label: s.label,
            field: s.field,
            modelProfileId: modelIdByProvider.get(s.provider)!,
            isNewMember: true,
            // Dua pakar baru tidak menerima konteks FGD pada ronde pertama.
            contextScope: "ARTIFACT_ONLY",
          })),
        ],
      },
    },
  });
  console.log(
    `  Panel: FGD_6 (${fgdConfig.id.slice(0, 8)}) dan DELPHI_8 dibuat`,
  );

  // ── 5b. Admin pertama ───────────────────────────────────────────
  await seedAdmin();

  // ── 6. Evaluasi gate awal ───────────────────────────────────────
  const stored = await prisma.domain.findMany({
    where: { versionId: version.id },
    include: {
      aspects: {
        include: {
          indicators: {
            include: { rubricLevels: true, evidence: true },
          },
        },
      },
    },
    orderBy: { order: "asc" },
  });

  const snapshot: ArtifactSnapshot = {
    contentLocked: false,
    domains: stored.map((d) => ({
      code: d.code,
      aspects: d.aspects.map((a) => ({
        code: a.code,
        indicators: a.indicators.map((i) => ({
          code: i.code,
          hasOperationalDefinition: Boolean(i.operationalDefinition),
          rubricLevels: i.rubricLevels.map((r) => r.level),
          mandatoryEvidenceCount: i.evidence.filter((e) => e.mandatory).length,
        })),
      })),
    })),
  };

  const gate = evaluateBaselineGate(snapshot);
  await prisma.gateRecord.upsert({
    where: { versionId_gate: { versionId: version.id, gate: "G1_BASELINE" } },
    update: {
      status: gate.passed ? "PASSED" : "FAILED",
      unmet: gate.unmet,
      warnings: gate.warnings,
    },
    create: {
      versionId: version.id,
      gate: "G1_BASELINE",
      status: gate.passed ? "PASSED" : "FAILED",
      unmet: gate.unmet,
      warnings: gate.warnings,
      note: "Evaluasi otomatis saat seed.",
    },
  });

  console.log(`\n  G1_BASELINE: ${gate.passed ? "PASSED" : "FAILED"}`);
  console.log(`  Syarat belum terpenuhi: ${gate.unmet.length}`);
  if (gate.warnings.length > 0)
    console.log(`  Peringatan: ${gate.warnings.join("; ")}`);

  const missingRubric = gate.unmet.filter((u) =>
    u.startsWith("INDICATOR_WITHOUT_RUBRIC"),
  ).length;
  const missingEvidence = gate.unmet.filter((u) =>
    u.startsWith("INDICATOR_WITHOUT_EVIDENCE"),
  ).length;
  const missingDefinition = gate.unmet.filter((u) =>
    u.startsWith("MISSING_OPERATIONAL_DEFINITION"),
  ).length;

  console.log(`\n  Pekerjaan yang menunggu (ini disengaja):`);
  console.log(`    ${missingDefinition} indikator tanpa definisi operasional`);
  console.log(`    ${missingRubric} indikator tanpa rubrik 1-5`);
  console.log(`    ${missingEvidence} indikator tanpa bukti wajib`);
  console.log(`\n  Lihat C01 sebagai contoh paket penilaian yang lengkap.`);
  console.log(`  FGD belum dapat dimulai sampai G1_BASELINE lulus.\n`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
