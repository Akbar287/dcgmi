"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { fail, type ActionResult } from "@/lib/action-result";
import { gatewayFamily, listGatewayModels } from "@/lib/ai/models";
import { pingModel, type PingResult } from "@/lib/ai/ping";
import { can } from "@/lib/auth/roles";
import { getCurrentUser } from "@/lib/auth/session";
import {
  addGatewayModel,
  listModelOptions,
  PanelStateError,
  recordModelPing,
  setPanelRoles,
  updateSeat,
} from "@/lib/db/repository/panel-admin";
import { seatSchema } from "@/lib/validation/panel";

export async function updateSeatAction(_state: ActionResult | null, formData: FormData): Promise<ActionResult | null> {
  const user = await getCurrentUser();
  if (!user || !can(user.role, "panel:manage")) return fail("FORBIDDEN", "panel:manage");
  const parsed = seatSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return fail("VALIDATION_ERROR", parsed.error.issues.map((i) => `${i.path.join(".")}: ${i.message}`).join("; "));
  try {
    await updateSeat(user.id, parsed.data);
  } catch (error) {
    if (error instanceof PanelStateError) return fail(error.code === "CONFLICT" ? "CONFLICT" : "VALIDATION_ERROR", error.message);
    throw error;
  }
  revalidatePath("/panel/kursi");
  revalidatePath("/", "layout");
  return { ok: true, data: null };
}

export async function pingModelAction(modelProfileId: string): Promise<ActionResult<PingResult>> {
  const user = await getCurrentUser();
  if (!user || !can(user.role, "panel:manage")) return fail("FORBIDDEN", "panel:manage");
  const model = (await listModelOptions()).find((m) => m.id === modelProfileId);
  if (!model) return fail("VALIDATION_ERROR", "model");
  const result = await pingModel(model);
  await recordModelPing(user.id, model.id, { provider: model.providerKey, modelId: model.modelId, ...result });
  return { ok: true, data: result };
}


const gatewayModelSchema = z.object({
  modelId: z.string().trim().min(3).max(120).regex(/^[a-z0-9-]+\/[\w.:-]+$/, "Format provider/model, mis. anthropic/claude-sonnet-5"),
  label: z.string().trim().min(1).max(80),
});

export async function addGatewayModelAction(_state: ActionResult<unknown> | null, formData: FormData): Promise<ActionResult<unknown> | null> {
  const user = await getCurrentUser();
  if (!user || !can(user.role, "panel:manage")) return fail("FORBIDDEN", "panel:manage");
  const parsed = gatewayModelSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return fail("VALIDATION_ERROR", parsed.error.issues.map((i) => i.message).join("; "));
  // docs/07 §5: only families of approved providers may be routed through the gateway.
  if (!gatewayFamily(parsed.data.modelId)) return fail("VALIDATION_ERROR", `Keluarga model ${parsed.data.modelId.split("/")[0]} tidak disetujui di docs/07 §5.`);
  try {
    await addGatewayModel(user.id, parsed.data.modelId, parsed.data.label);
  } catch (error) {
    if (error instanceof PanelStateError) return fail("CONFLICT", error.message);
    throw error;
  }
  revalidatePath("/panel", "layout");
  return { ok: true, data: null };
}

export async function loadGatewayCatalogAction(): Promise<ActionResult<{ id: string; name: string; family: string }[]>> {
  const user = await getCurrentUser();
  if (!user || !can(user.role, "panel:manage")) return fail("FORBIDDEN", "panel:manage");
  try {
    return { ok: true, data: await listGatewayModels() };
  } catch (error) {
    return fail("VALIDATION_ERROR", error instanceof Error ? error.message : String(error));
  }
}

const rolesSchema = z.object({ configId: z.string().min(1), facilitatorModelId: z.string().min(1), notetakerModelId: z.string().min(1) });

export async function setPanelRolesAction(_state: ActionResult | null, formData: FormData): Promise<ActionResult | null> {
  const user = await getCurrentUser();
  if (!user || !can(user.role, "panel:manage")) return fail("FORBIDDEN", "panel:manage");
  const parsed = rolesSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return fail("VALIDATION_ERROR", "roles");
  await setPanelRoles(user.id, parsed.data.configId, parsed.data.facilitatorModelId, parsed.data.notetakerModelId);
  revalidatePath("/panel/kursi");
  return { ok: true, data: null };
}
