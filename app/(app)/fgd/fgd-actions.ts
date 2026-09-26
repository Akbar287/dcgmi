"use server";

import { randomInt } from "node:crypto";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";

import { fail, type ActionResult } from "@/lib/action-result";
import { can } from "@/lib/auth/roles";
import { getCurrentUser } from "@/lib/auth/session";
import { db } from "@/lib/db/client";
import { getArtifactHierarchy } from "@/lib/db/repository/artifact";
import { createFgdSession, pauseSession, setSessionState, setSuggestionAdoption } from "@/lib/db/repository/fgd-sessions";
import { listPanelsForEditor } from "@/lib/db/repository/panel-admin";
import { AGENDA_CORONG_11, buildAgendaPlan, estimateCalls, type StageKey } from "@/lib/fgd/agenda";
import { PROMPT_VERSIONS, runNextItem, type RunOutcome } from "@/lib/fgd/run-item";
import { validateSuggestionAdoption } from "@/lib/method/fgd";
import { parseBudget } from "@/lib/validation/budget";

import { getActiveVersionId } from "../_lib/active-version";

const STAGE_KEYS = AGENDA_CORONG_11.map((s) => s.key) as [StageKey, ...StageKey[]];

const createSchema = z.object({
  configId: z.string().min(1),
  mode: z.enum(["STEP", "AUTO"]),
  crossTalkRounds: z.coerce.number().int().min(0).max(2),
  seed: z
    .string()
    .optional()
    .transform((v) => (v ? Number(v) : null))
    .pipe(z.number().int().min(0).max(2_147_483_647).nullable()),
  stages: z.array(z.enum(STAGE_KEYS)).min(1),
  domains: z.array(z.string()),
});

async function runner() {
  const user = await getCurrentUser();
  return user && can(user.role, "simulation:run") ? user : null;
}

export async function createFgdSessionAction(_state: ActionResult | null, formData: FormData): Promise<ActionResult | null> {
  const user = await runner();
  if (!user) return fail("FORBIDDEN", "simulation:run");
  const parsed = createSchema.safeParse({
    configId: formData.get("configId"),
    mode: formData.get("mode"),
    crossTalkRounds: formData.get("crossTalkRounds"),
    seed: formData.get("seed") ?? undefined,
    stages: formData.getAll("stages"),
    domains: formData.getAll("domains"),
  });
  if (!parsed.success) return fail("VALIDATION_ERROR", parsed.error.issues.map((i) => `${i.path.join(".")}: ${i.message}`).join("; "));
  const versionId = await getActiveVersionId();
  if (!versionId) return fail("VALIDATION_ERROR", "Tidak ada versi artefak aktif.");

  // SPECIFICATION §3 / docs/01: stage FGD refuses to start until G1 is PASSED.
  const prisma = await db();
  const g1 = await prisma.gateRecord.findUnique({ where: { versionId_gate: { versionId, gate: "G1_BASELINE" } } });
  if (g1?.status !== "PASSED") return fail("GATE_BLOCKED", "G1_BASELINE belum diluluskan Admin.", ["G1_BASELINE"]);

  const panel = (await listPanelsForEditor()).find((p) => p.id === parsed.data.configId);
  if (!panel || panel.preset !== "FGD_6") return fail("VALIDATION_ERROR", "Pilih panel berpreset FGD_6.");
  if (!panel.validation.ready) return fail("VALIDATION_ERROR", "Panel belum siap: " + panel.validation.issues.map((i) => i.code).join(", "));

  const plan = buildAgendaPlan(await getArtifactHierarchy(versionId), { stages: parsed.data.stages, domains: parsed.data.domains });
  const estimate = estimateCalls(plan, panel.seats.length, parsed.data.crossTalkRounds);
  if (estimate.components === 0) return fail("VALIDATION_ERROR", "Pilihan tahap/domain tidak menghasilkan komponen.");

  const budget = parseBudget(formData.get("budget"));
  if (!budget.ok) return fail("VALIDATION_ERROR", "Anggaran harus angka USD positif.");
  const sessionId = await createFgdSession({
    budgetUsd: budget.value,
    actorId: user.id,
    versionId,
    configId: panel.id,
    mode: parsed.data.mode,
    seed: parsed.data.seed ?? randomInt(0, 2_147_483_647),
    settings: {
      selection: { stages: parsed.data.stages, domains: parsed.data.domains },
      crossTalkRounds: parsed.data.crossTalkRounds,
      promptVersions: PROMPT_VERSIONS,
      estimatedCalls: estimate.calls,
    },
    plan,
  });
  revalidatePath("/fgd", "layout");
  redirect(`/fgd/ruang/${sessionId}`);
}

export async function runNextItemAction(sessionId: string): Promise<ActionResult<RunOutcome>> {
  const user = await runner();
  if (!user) return fail("FORBIDDEN", "simulation:run");
  const outcome = await runNextItem(sessionId);
  revalidatePath(`/fgd/ruang/${sessionId}`);
  return { ok: true, data: outcome };
}

export async function sessionControlAction(sessionId: string, action: "PAUSE" | "CANCEL" | "RETRY_FAILED"): Promise<ActionResult> {
  const user = await runner();
  if (!user) return fail("FORBIDDEN", "simulation:run");
  if (action === "PAUSE") await pauseSession(sessionId);
  else await setSessionState(user.id, sessionId, action);
  revalidatePath(`/fgd/ruang/${sessionId}`);
  return { ok: true, data: null };
}

const adoptionSchema = z.object({
  suggestionId: z.string().min(1),
  adopted: z.enum(["yes", "no", ""]).transform((v) => (v === "yes" ? true : v === "no" ? false : null)),
  reason: z
    .string()
    .trim()
    .max(1000)
    .optional()
    .transform((v) => v || null),
});

export async function saveAdoptionAction(_state: ActionResult | null, formData: FormData): Promise<ActionResult | null> {
  const user = await runner();
  if (!user) return fail("FORBIDDEN", "simulation:run");
  const parsed = adoptionSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return fail("VALIDATION_ERROR", "adoption");
  // Tabel 3.5, last row: a suggestion that is not adopted needs an explicit reason.
  const check = validateSuggestionAdoption({ adopted: parsed.data.adopted, notAdoptedReason: parsed.data.reason });
  if (!check.ok) return fail("VALIDATION_ERROR", check.issue ?? "adoption");
  await setSuggestionAdoption(user.id, parsed.data.suggestionId, parsed.data.adopted, parsed.data.reason);
  revalidatePath("/fgd/revisi");
  return { ok: true, data: null };
}
