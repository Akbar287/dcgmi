import { redirect } from "next/navigation";
import { cache } from "react";

import { auth } from "@/auth";
import { db } from "@/lib/db/client";

import { can, homePathFor, type Permission, type Role } from "./roles";

export interface CurrentUser {
  id: string;
  email: string;
  name: string | null;
  image: string | null;
  role: Role;
}

// Data Access Layer: the JWT says who signed in, the database says what they
// may do now. A revoked or demoted account loses access on the next request.
export const getCurrentUser = cache(async (): Promise<CurrentUser | null> => {
  const session = await auth();
  const id = session?.user?.id;
  if (!id) return null;
  const prisma = await db();
  const user = await prisma.user.findUnique({
    where: { id },
    select: { id: true, email: true, name: true, image: true, role: true, active: true },
  });
  if (!user?.active) return null;
  return { id: user.id, email: user.email, name: user.name, image: user.image, role: user.role };
});

export async function requireUser(): Promise<CurrentUser> {
  const user = await getCurrentUser();
  if (!user) redirect((await auth())?.user ? "/login?error=SessionRevoked" : "/login");
  return user;
}

/** For pages: sends users without the permission to their own home. */
export async function requirePermission(permission: Permission): Promise<CurrentUser> {
  const user = await requireUser();
  if (!can(user.role, permission)) redirect(homePathFor(user.role));
  return user;
}
