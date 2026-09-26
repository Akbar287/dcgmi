"use server";

import { randomInt } from "node:crypto";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";

import { fail, type ActionResult } from "@/lib/action-result";
import { defaultScenarios } from "@/lib/ahp/scenarios";
import { can } from "@/lib/auth/roles";
import { getCurrentUser } from "@/lib/auth/session";
import { ahpGroupsFor } from "@/lib/db/repository/ahp-sessions";
import { createPipelineRun } from "@/lib/db/repository/pipeline";
import { AGENDA_CORONG_11 } from "@/lib/fgd/agenda";
import { advanceRun, controlRun, type AdvanceOutcome } from "@/lib/pipeline/advance";
import { parseBudget } from "@/lib/validation/budget";

import { getActiveVersionId } from "../_lib/active-version";

async function runner() {
  const user = await getCurrentUser();
  return user && can(user.role, "simulation:run") ? user : null;
}

const schema = z.object({
  name: z.string().trim().min(3).max(120),
  mode: z.enum(["STEP", "AUTO"]),
  fgdConfigId: z.string().min(1),
  crossTalkRounds: z.coerce.number().int().min(0).max(2),
  delphiConfigId: z.string().min(1),
  ahpConfigId: z.string().min(1),
  assessorModelId: z.string().min(1),
  profileIds: z.array(z.string().min(1)).min(1),
  seed: z
    .string()
    .optional()
    .transform((v) => (v ? Number(v) : null))
    .pipe(z.number().int().min(0).max(2_000_000_000).nullable()),
});

// SPECIFICATION §4.9: the whole chain is defined before the run starts.
export async function createRunAction(_s: ActionResult | null, formData: FormData): Promise<ActionResult | null> {
  const user = await runner();
  if (!user) return fail("FORBIDDEN", "simulation:run");
  const parsed = schema.safeParse({ ...Object.fromEntries(formData), profileIds: formData.getAll("profileIds"), seed: formData.get("seed") ?? undefined });
  if (!parsed.success) return fail("VALIDATION_ERROR", parsed.error.issues.map((i) => `${i.path.join(".")}: ${i.message}`).join("; "));
  const budget = parseBudget(formData.get("budget"));
  if (!budget.ok) return fail("VALIDATION_ERROR", "Anggaran harus angka USD positif.");
  const versionId = await getActiveVersionId();
  if (!versionId) return fail("VALIDATION_ERROR", "Tidak ada versi artefak aktif.");
  const d = parsed.data;
  const seed = d.seed ?? randomInt(0, 2_000_000_000);
  const domainCodes = (await ahpGroupsFor(versionId)).find((g) => g.key === "DOMAIN")?.elements.map((e) => e.code) ?? [];
  const id = await createPipelineRun({
    actorId: user.id,
    name: d.name,
    versionId,
    mode: d.mode,
    budgetUsd: budget.value,
    plan: {
      fgd: { configId: d.fgdConfigId, crossTalkRounds: d.crossTalkRounds, stages: AGENDA_CORONG_11.map((s) => s.key), domains: [], seed },
      delphi: { configId: d.delphiConfigId, seed },
      ahp: { configId: d.ahpConfigId, seatScopes: {}, scenarios: defaultScenarios(domainCodes), seed },
      scoring: { modelProfileId: d.assessorModelId, profileIds: d.profileIds, seed },
    },
  });
  revalidatePath("/runs", "layout");
  redirect(`/runs/jalur/${id}`);
}

export async function advanceRunAction(runId: string): Promise<ActionResult<AdvanceOutcome>> {
  const user = await runner();
  if (!user) return fail("FORBIDDEN", "simulation:run");
  const outcome = await advanceRun(runId);
  revalidatePath(`/runs/jalur/${runId}`);
  return { ok: true, data: outcome };
}

export async function runControlAction(runId: string, action: "PAUSE" | "CANCEL" | "RETRY"): Promise<ActionResult> {
  const user = await runner();
  if (!user) return fail("FORBIDDEN", "simulation:run");
  await controlRun(user.id, runId, action);
  revalidatePath(`/runs/jalur/${runId}`);
  return { ok: true, data: null };
}
