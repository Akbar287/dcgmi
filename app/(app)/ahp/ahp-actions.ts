"use server";

import { randomInt } from "node:crypto";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";

import { fail, type ActionResult } from "@/lib/action-result";
import { parseScenarios } from "@/lib/ahp/scenarios";
import { AHP_PROMPT_VERSIONS, runNextAhpMatrix, type AhpRunOutcome } from "@/lib/ahp/run-matrix";
import { can } from "@/lib/auth/roles";
import { getCurrentUser } from "@/lib/auth/session";
import { parseBudget } from "@/lib/validation/budget";
import { AhpError, createAhpSession, planAhpSession, setAhpSessionStatus, type SeatScope } from "@/lib/db/repository/ahp-sessions";

import { getActiveVersionId } from "../_lib/active-version";

async function runner() {
  const user = await getCurrentUser();
  return user && can(user.role, "simulation:run") ? user : null;
}

const createSchema = z.object({
  configId: z.string().min(1),
  seed: z
    .string()
    .optional()
    .transform((v) => (v ? Number(v) : null))
    .pipe(z.number().int().min(0).max(2_147_483_647).nullable()),
  scenarios: z.string().max(10_000),
});

// SPECIFICATION §4.7: configuration is fixed before the session runs.
export async function createAhpSessionAction(_s: ActionResult | null, formData: FormData): Promise<ActionResult | null> {
  const user = await runner();
  if (!user) return fail("FORBIDDEN", "simulation:run");
  const parsed = createSchema.safeParse({ configId: formData.get("configId"), seed: formData.get("seed") ?? undefined, scenarios: formData.get("scenarios") ?? "" });
  if (!parsed.success) return fail("VALIDATION_ERROR", parsed.error.issues.map((i) => i.message).join("; "));
  const versionId = await getActiveVersionId();
  if (!versionId) return fail("VALIDATION_ERROR", "Tidak ada versi artefak aktif.");
  const plan = await planAhpSession(versionId);
  const { scenarios, errors } = parseScenarios(parsed.data.scenarios, plan.domainCodes);
  if (errors.length) return fail("VALIDATION_ERROR", "Skenario sensitivitas tidak sah.", errors);
  const seatScopes: Record<string, SeatScope> = {};
  for (const [k, v] of formData.entries()) {
    const m = /^scope-(\d+)$/.exec(k);
    if (m && (v === "BOTH" || v === "DOMAIN" || v === "ASPECT")) seatScopes[m[1]] = v;
  }
  const budget = parseBudget(formData.get("budget"));
  if (!budget.ok) return fail("VALIDATION_ERROR", "Anggaran harus angka USD positif.");
  let sessionId: string;
  try {
    sessionId = await createAhpSession({ actorId: user.id, versionId, configId: parsed.data.configId, seed: parsed.data.seed ?? randomInt(0, 2_147_483_647), seatScopes, scenarios, promptVersions: AHP_PROMPT_VERSIONS, budgetUsd: budget.value });
  } catch (error) {
    if (error instanceof AhpError) return fail(error.code === "GATE" ? "GATE_BLOCKED" : error.code === "PANEL" ? "NOT_READY" : "VALIDATION_ERROR", error.message, error.details);
    throw error;
  }
  revalidatePath("/ahp", "layout");
  redirect(`/ahp/sesi/${sessionId}`);
}

export async function runNextAhpMatrixAction(sessionId: string): Promise<ActionResult<AhpRunOutcome>> {
  const user = await runner();
  if (!user) return fail("FORBIDDEN", "simulation:run");
  const outcome = await runNextAhpMatrix(sessionId);
  revalidatePath(`/ahp/sesi/${sessionId}`);
  return { ok: true, data: outcome };
}

export async function ahpSessionControlAction(sessionId: string, action: "PAUSE" | "RETRY"): Promise<ActionResult> {
  const user = await runner();
  if (!user) return fail("FORBIDDEN", "simulation:run");
  await setAhpSessionStatus(user.id, sessionId, action);
  revalidatePath(`/ahp/sesi/${sessionId}`);
  return { ok: true, data: null };
}
