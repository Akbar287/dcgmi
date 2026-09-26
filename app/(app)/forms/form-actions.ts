"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { fail, type ActionResult } from "@/lib/action-result";
import { can } from "@/lib/auth/roles";
import { getCurrentUser } from "@/lib/auth/session";
import { FormStateError, setFormOpen } from "@/lib/db/repository/pre-review";

const schema = z.object({ formId: z.string().min(1), open: z.enum(["true", "false"]).transform((v) => v === "true") });

// SPECIFICATION §4.2: only the Admin (former Owner) may set a form ACTIVE.
export async function toggleFormAction(_state: ActionResult | null, formData: FormData): Promise<ActionResult | null> {
  const user = await getCurrentUser();
  if (!user || !can(user.role, "instrument:manage")) return fail("FORBIDDEN", "instrument:manage");
  const parsed = schema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return fail("VALIDATION_ERROR", parsed.error.message);
  try {
    await setFormOpen(user.id, parsed.data.formId, parsed.data.open);
  } catch (error) {
    if (error instanceof FormStateError) return fail(error.code === "NOT_READY" ? "NOT_READY" : "VALIDATION_ERROR", error.message);
    throw error;
  }
  revalidatePath("/forms/formulir");
  return { ok: true, data: null };
}
