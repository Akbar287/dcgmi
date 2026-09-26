import type { Prisma } from "@/generated/prisma/client";
import type { Role } from "@/lib/auth/roles";

import { db } from "../client";
import { iso } from "../types";

export class LastAdminError extends Error {
  constructor() {
    super("At least one active ADMIN must remain");
    this.name = "LastAdminError";
  }
}

export class EmailTakenError extends Error {
  constructor(email: string) {
    super(`Email already registered: ${email}`);
    this.name = "EmailTakenError";
  }
}

export async function listManagedUsers() {
  const prisma = await db();
  const rows = await prisma.user.findMany({ orderBy: [{ role: "asc" }, { email: "asc" }] });
  return rows.map((u) => ({
    id: u.id,
    email: u.email,
    name: u.name,
    role: u.role,
    active: u.active,
    hasPassword: Boolean(u.passwordHash),
    panelCode: u.panelCode,
    lastLoginAt: iso(u.lastLoginAt),
  }));
}

type Tx = Prisma.TransactionClient;

// Every user-management mutation writes its AuditEvent in the same transaction.
// Payloads never contain password material.
function audit(tx: Tx, actorId: string, action: string, targetId: string, payload: Prisma.InputJsonValue) {
  return tx.auditEvent.create({ data: { actorId, actorKind: "USER", action, targetType: "User", targetId, payload } });
}

async function assertAdminRemains(tx: Tx, userId: string) {
  const others = await tx.user.count({ where: { role: "ADMIN", active: true, id: { not: userId } } });
  if (others === 0) throw new LastAdminError();
}

export async function createUser(
  actorId: string,
  input: { email: string; name?: string; role: Role; passwordHash?: string },
) {
  const prisma = await db();
  return prisma.$transaction(async (tx) => {
    if (await tx.user.findUnique({ where: { email: input.email }, select: { id: true } })) {
      throw new EmailTakenError(input.email);
    }
    const user = await tx.user.create({
      data: { email: input.email, name: input.name, role: input.role, passwordHash: input.passwordHash },
    });
    await audit(tx, actorId, "USER_CREATE", user.id, { email: user.email, role: user.role, password: Boolean(input.passwordHash) });
    return user.id;
  });
}

export async function updateUserRole(actorId: string, userId: string, role: Role) {
  const prisma = await db();
  await prisma.$transaction(async (tx) => {
    const current = await tx.user.findUniqueOrThrow({ where: { id: userId }, select: { role: true, active: true } });
    if (current.role === role) return;
    if (current.role === "ADMIN" && current.active) await assertAdminRemains(tx, userId);
    await tx.user.update({ where: { id: userId }, data: { role } });
    await audit(tx, actorId, "USER_ROLE_CHANGE", userId, { from: current.role, to: role });
  });
}

export async function setUserActive(actorId: string, userId: string, active: boolean) {
  const prisma = await db();
  await prisma.$transaction(async (tx) => {
    const current = await tx.user.findUniqueOrThrow({ where: { id: userId }, select: { role: true, active: true } });
    if (current.active === active) return;
    if (!active && current.role === "ADMIN") await assertAdminRemains(tx, userId);
    await tx.user.update({ where: { id: userId }, data: { active } });
    await audit(tx, actorId, active ? "USER_ACTIVATE" : "USER_DEACTIVATE", userId, { active });
  });
}

export async function setUserPassword(actorId: string, userId: string, passwordHash: string) {
  const prisma = await db();
  await prisma.$transaction(async (tx) => {
    await tx.user.update({ where: { id: userId }, data: { passwordHash } });
    await audit(tx, actorId, "USER_PASSWORD_SET", userId, {});
  });
}

export async function findActiveRoleByEmail(email: string): Promise<Role | null> {
  const prisma = await db();
  const user = await prisma.user.findUnique({ where: { email: email.trim().toLowerCase() }, select: { role: true, active: true } });
  return user?.active ? user.role : null;
}

export async function findPanelCode(userId: string): Promise<string | null> {
  const prisma = await db();
  const user = await prisma.user.findUnique({ where: { id: userId }, select: { panelCode: true } });
  return user?.panelCode ?? null;
}

export class PanelCodeTakenError extends Error {
  constructor(code: string) {
    super(`Panel code already bound: ${code}`);
    this.name = "PanelCodeTakenError";
  }
}

/** Binds an expert code to a PAKAR account; the mapping itself is Admin-only data. */
export async function setUserPanelCode(actorId: string, userId: string, panelCode: string | null) {
  const prisma = await db();
  await prisma.$transaction(async (tx) => {
    const user = await tx.user.findUniqueOrThrow({ where: { id: userId }, select: { panelCode: true } });
    if (user.panelCode === panelCode) return;
    if (panelCode) {
      const holder = await tx.user.findUnique({ where: { panelCode }, select: { id: true } });
      if (holder && holder.id !== userId) throw new PanelCodeTakenError(panelCode);
    }
    await tx.user.update({ where: { id: userId }, data: { panelCode } });
    await tx.auditEvent.create({
      data: {
        actorId,
        actorKind: "USER",
        action: "USER_PANEL_CODE_SET",
        targetType: "User",
        targetId: userId,
        payload: { from: user.panelCode, to: panelCode },
      },
    });
  });
}
