"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { fail, type ActionResult } from "@/lib/action-result";
import { can } from "@/lib/auth/roles";
import { getCurrentUser } from "@/lib/auth/session";
import { passGate } from "@/lib/db/repository/gates";
import { GateError } from "@/lib/method/errors";
import { GATE_ORDER } from "@/lib/method/gates";

import { getActiveVersionId } from "./_lib/active-version";

const schema = z.object({
  gate: z.enum(GATE_ORDER as [string, ...string[]]),
  note: z.string().trim().min(10).max(2000),
});

// docs/03 passGate — ADMIN only; conditions re-evaluated server-side (P7).
export async function passGateAction(_state: ActionResult | null, formData: FormData): Promise<ActionResult | null> {
  const user = await getCurrentUser();
  if (!user || !can(user.role, "gate:pass")) return fail("FORBIDDEN", "gate:pass");
  const parsed = schema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return fail("VALIDATION_ERROR", parsed.error.message);
  const versionId = await getActiveVersionId();
  if (!versionId) return fail("VALIDATION_ERROR", "no active version");
  try {
    await passGate(user.id, versionId, parsed.data.gate as (typeof GATE_ORDER)[number], parsed.data.note);
  } catch (error) {
    if (error instanceof GateError) return fail("GATE_BLOCKED", error.message, error.unmet);
    throw error;
  }
  revalidatePath("/", "layout");
  return { ok: true, data: null };
}
