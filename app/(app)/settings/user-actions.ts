"use server";

import { revalidatePath } from "next/cache";

import { fail, type ActionResult } from "@/lib/action-result";
import { hashPassword } from "@/lib/auth/password";
import { can } from "@/lib/auth/roles";
import { getCurrentUser, type CurrentUser } from "@/lib/auth/session";
import { listKnownExpertCodes } from "@/lib/db/repository/pre-review";
import {
  createUser,
  EmailTakenError,
  LastAdminError,
  PanelCodeTakenError,
  setUserPanelCode,
  setUserActive,
  setUserPassword,
  updateUserRole,
} from "@/lib/db/repository/users";
import {
  createUserSchema,
  setUserActiveSchema,
  setUserPanelCodeSchema,
  setUserPasswordSchema,
  updateUserRoleSchema,
} from "@/lib/validation/auth";

type State = ActionResult | null;
const PATH = "/settings/pengguna";

async function authorize(): Promise<CurrentUser | null> {
  const user = await getCurrentUser();
  return user && can(user.role, "users:manage") ? user : null;
}

function toFailure(error: unknown): ActionResult<never> {
  if (error instanceof LastAdminError) return fail("LAST_ADMIN", error.message);
  if (error instanceof EmailTakenError || error instanceof PanelCodeTakenError) return fail("CONFLICT", error.message);
  throw error;
}

export async function createUserAction(
  _state: ActionResult<{ id: string }> | null,
  formData: FormData,
): Promise<ActionResult<{ id: string }>> {
  const actor = await authorize();
  if (!actor) return fail("FORBIDDEN", "users:manage");
  const parsed = createUserSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return fail("VALIDATION_ERROR", parsed.error.message, parsed.error.issues);
  try {
    const { password, ...rest } = parsed.data;
    const id = await createUser(actor.id, { ...rest, passwordHash: password ? await hashPassword(password) : undefined });
    revalidatePath(PATH);
    return { ok: true, data: { id } };
  } catch (error) {
    return toFailure(error);
  }
}

export async function updateUserRoleAction(_state: State, formData: FormData): Promise<State> {
  const actor = await authorize();
  if (!actor) return fail("FORBIDDEN", "users:manage");
  const parsed = updateUserRoleSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return fail("VALIDATION_ERROR", parsed.error.message, parsed.error.issues);
  try {
    await updateUserRole(actor.id, parsed.data.userId, parsed.data.role);
    revalidatePath(PATH);
    return { ok: true, data: null };
  } catch (error) {
    return toFailure(error);
  }
}

export async function setUserActiveAction(_state: State, formData: FormData): Promise<State> {
  const actor = await authorize();
  if (!actor) return fail("FORBIDDEN", "users:manage");
  const parsed = setUserActiveSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return fail("VALIDATION_ERROR", parsed.error.message, parsed.error.issues);
  // An admin cannot lock themselves out from their own session.
  if (parsed.data.userId === actor.id && !parsed.data.active) return fail("LAST_ADMIN", "self-deactivation");
  try {
    await setUserActive(actor.id, parsed.data.userId, parsed.data.active);
    revalidatePath(PATH);
    return { ok: true, data: null };
  } catch (error) {
    return toFailure(error);
  }
}

export async function setUserPasswordAction(_state: State, formData: FormData): Promise<State> {
  const actor = await authorize();
  if (!actor) return fail("FORBIDDEN", "users:manage");
  const parsed = setUserPasswordSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return fail("VALIDATION_ERROR", parsed.error.message, parsed.error.issues);
  await setUserPassword(actor.id, parsed.data.userId, await hashPassword(parsed.data.password));
  revalidatePath(PATH);
  return { ok: true, data: null };
}

export async function setUserPanelCodeAction(_state: State, formData: FormData): Promise<State> {
  const actor = await authorize();
  if (!actor) return fail("FORBIDDEN", "users:manage");
  const parsed = setUserPanelCodeSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return fail("VALIDATION_ERROR", parsed.error.message, parsed.error.issues);
  const { userId, panelCode } = parsed.data;
  // Only codes defined by an imported instrument snapshot can be bound.
  if (panelCode && !(await listKnownExpertCodes()).includes(panelCode)) return fail("VALIDATION_ERROR", "unknown panel code");
  try {
    await setUserPanelCode(actor.id, userId, panelCode);
    revalidatePath(PATH);
    return { ok: true, data: null };
  } catch (error) {
    return toFailure(error);
  }
}
