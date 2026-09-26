"use server";

import { revalidatePath } from "next/cache";

import { fail, type ActionResult } from "@/lib/action-result";
import { can, type Permission } from "@/lib/auth/roles";
import { getCurrentUser } from "@/lib/auth/session";
import { refreshCatalogPrices, setModelPrice, setMonthlyCap } from "@/lib/db/repository/model-calls";
import { parseBudget } from "@/lib/validation/budget";

async function actor(permission: Permission) {
  const user = await getCurrentUser();
  return user && can(user.role, permission) ? user : null;
}

// Global monthly cap is an Admin setting (SPECIFICATION §4.11 "batas biaya").
export async function setMonthlyCapAction(_s: ActionResult | null, formData: FormData): Promise<ActionResult | null> {
  const user = await actor("users:manage");
  if (!user) return fail("FORBIDDEN", "users:manage");
  const cap = parseBudget(formData.get("cap"));
  if (!cap.ok) return fail("VALIDATION_ERROR", "Plafon harus angka USD positif, atau kosong.");
  await setMonthlyCap(user.id, cap.value);
  revalidatePath("/settings/anggaran");
  return { ok: true, data: null };
}

function price(v: FormDataEntryValue | null): number | null | undefined {
  if (v === null || v === "") return null;
  const n = Number(String(v).replace(",", "."));
  return Number.isFinite(n) && n >= 0 && n < 1000 ? n : undefined;
}

export async function setModelPriceAction(_s: ActionResult | null, formData: FormData): Promise<ActionResult | null> {
  const user = await actor("panel:manage");
  if (!user) return fail("FORBIDDEN", "panel:manage");
  const id = String(formData.get("modelProfileId") ?? "");
  const input = price(formData.get("input"));
  const output = price(formData.get("output"));
  if (!id || input === undefined || output === undefined || (input === null) !== (output === null)) return fail("VALIDATION_ERROR", "Isi harga input dan output (USD per 1.000 token), atau kosongkan keduanya.");
  await setModelPrice(user.id, id, input, output);
  revalidatePath("/settings/anggaran");
  return { ok: true, data: null };
}

export async function refreshCatalogPricesAction(): Promise<ActionResult<number> | null> {
  const user = await actor("panel:manage");
  if (!user) return fail("FORBIDDEN", "panel:manage");
  try {
    const n = await refreshCatalogPrices(user.id);
    revalidatePath("/settings/anggaran");
    return { ok: true, data: n };
  } catch (error) {
    return fail("NOT_READY", error instanceof Error ? error.message : String(error));
  }
}
