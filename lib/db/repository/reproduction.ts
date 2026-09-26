import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import path from "node:path";

import JSZip from "jszip";

import { WATERMARK } from "@/lib/export/watermark";

import { db } from "../client";
import { buildRecomputeExport } from "./scoring-runs";

const sha = (b: Buffer | string) => createHash("sha256").update(b).digest("hex");

/** Source files shipped verbatim so every prompt and formula can be read (§3.14). */
const SOURCE_FILES = [
  "lib/ai/prompts/fgd.ts",
  "lib/ai/prompts/delphi.ts",
  "lib/ai/prompts/ahp.ts",
  "lib/ai/prompts/scoring.ts",
  "lib/persona/prompt.ts",
  "lib/method/constants.ts",
  "scripts/recompute.py",
  "docs/05-METHOD-RULES.md",
];

/**
 * Reproducibility package (SPECIFICATION §4.10): artifact definitions of the
 * active version and its ancestors, gates, change logs, panel configurations
 * with the persona prompts actually sent, prompt sources, every raw output,
 * computed results, the model-call ledger, the recompute export and reports,
 * and a manifest with the SHA-256 of every file. Watermarked (docs/07 P4).
 */
export async function buildReproductionPackage(versionId: string) {
  const prisma = await db();
  const lineage: { id: string; label: string; status: string; parentId: string | null }[] = [];
  for (let id: string | null = versionId; id; ) {
    const v: { id: string; label: string; status: string; parentId: string | null } | null = await prisma.artifactVersion.findUnique({ where: { id }, select: { id: true, label: true, status: true, parentId: true } });
    if (!v) break;
    lineage.push(v);
    id = v.parentId;
  }
  const ids = lineage.map((v) => v.id);
  const files = new Map<string, string | Buffer>();
  const json = (p: string, data: unknown) => files.set(p, `${JSON.stringify({ _warning: WATERMARK, _dataOrigin: "SIMULATED", ...(data as object) }, null, 2)}\n`);

  for (const v of lineage) {
    const [domains, changeLog, gates] = await Promise.all([
      prisma.domain.findMany({ where: { versionId: v.id }, orderBy: { order: "asc" }, include: { aspects: { orderBy: { order: "asc" }, include: { indicators: { orderBy: { order: "asc" }, include: { rubricLevels: { orderBy: { level: "asc" } }, evidence: true } } } } } }),
      prisma.changeLogEntry.findMany({ where: { versionId: v.id }, orderBy: { createdAt: "asc" } }),
      prisma.gateRecord.findMany({ where: { versionId: v.id } }),
    ]);
    json(`artifact/${v.label}.json`, { version: v, domains, changeLog, gates });
  }

  const [fgd, delphi, ahp, assessments, profiles] = await Promise.all([
    prisma.fgdSession.findMany({
      where: { versionId: { in: ids } },
      include: { stages: { orderBy: { order: "asc" }, include: { items: { orderBy: { order: "asc" }, include: { utterances: { orderBy: { turn: "asc" } }, positions: true, decision: true, suggestions: true } } } } },
    }),
    prisma.delphiRound.findMany({ where: { versionId: { in: ids } }, orderBy: { roundNumber: "asc" }, include: { ratings: true, results: true } }),
    prisma.ahpSession.findMany({ where: { versionId: { in: ids } }, include: { matrices: true, weights: true, sensitivity: true } }),
    prisma.assessment.findMany({ where: { versionId: { in: ids } }, include: { scores: true } }),
    prisma.institutionProfile.findMany(),
  ]);
  const configIds = [...new Set([...fgd.map((s) => s.configId), ...delphi.map((r) => r.configId), ...ahp.map((s) => s.configId)])];
  const panels = await prisma.panelConfig.findMany({
    where: { id: { in: configIds } },
    include: {
      seats: {
        orderBy: { seatIndex: "asc" },
        // Panel code and the de-identified persona prompt only; PanelistIdentity never leaves the Admin screens.
        include: { expert: { select: { panelCode: true, field: true, persona: { select: { status: true, promptVersion: true, systemPrompt: true, approvedAt: true } } } }, modelProfile: { include: { provider: { select: { key: true, label: true } } } } },
      },
    },
  });
  json("panels.json", { panels });
  json("outputs/fgd.json", { sessions: fgd });
  json("outputs/delphi.json", { rounds: delphi });
  json("outputs/ahp.json", { sessions: ahp });
  json("outputs/scoring.json", { profiles, assessments });
  const refIds = [...fgd.map((s) => s.id), ...delphi.map((r) => r.id), ...ahp.map((s) => s.id), ...assessments.map((a) => a.id)];
  json("ledger.json", { calls: await prisma.modelCall.findMany({ where: { refId: { in: refIds } }, orderBy: { createdAt: "asc" } }) });

  const recompute = await buildRecomputeExport(versionId);
  files.set(`recompute/${recompute.filename}`, recompute.json);
  json("recompute/reports.json", { reports: await prisma.recomputeCheck.findMany({ where: { versionId }, orderBy: { createdAt: "asc" } }) });

  for (const f of SOURCE_FILES) {
    try {
      files.set(`source/${f}`, await readFile(path.join(process.cwd(), f)));
    } catch {
      files.set(`source/${f}.MISSING`, "Berkas tidak tersedia di lingkungan server ini.\n");
    }
  }

  files.set(
    "README.md",
    `# Paket reproduksibilitas — ${lineage[0]?.label}\n\n> ${WATERMARK}\n\nIsi: definisi artefak dan gate tiap versi dalam garis turunan (artifact/), konfigurasi panel dengan prompt persona yang dikirim (panels.json), seluruh keluaran mentah dan hasil hitungan (outputs/), log panggilan model (ledger.json), ekspor dan laporan rekalkulasi (recompute/), serta sumber prompt, konstanta, dan skrip rekalkulasi (source/). SHA-256 setiap berkas ada di manifest.json.\n\nRekalkulasi: \`python source/scripts/recompute.py recompute/${recompute.filename} --check\`\n`,
  );

  const manifest = {
    _warning: WATERMARK,
    _dataOrigin: "SIMULATED",
    generatedAt: new Date().toISOString(),
    version: lineage[0]?.label,
    lineage: lineage.map((v) => `${v.label} (${v.status})`),
    recomputeExportSha256: recompute.sha256,
    files: [...files.entries()].map(([p, c]) => ({ path: p, bytes: Buffer.byteLength(c), sha256: sha(c) })).sort((a, b) => a.path.localeCompare(b.path)),
  };
  const zip = new JSZip();
  for (const [p, c] of files) zip.file(p, c);
  zip.file("manifest.json", `${JSON.stringify(manifest, null, 2)}\n`);
  const buffer = await zip.generateAsync({ type: "nodebuffer", compression: "DEFLATE" });
  return { buffer, filename: `SIM_reproduksi_${lineage[0]?.label ?? "versi"}.zip`, sha256: sha(buffer), files: manifest.files.length };
}
