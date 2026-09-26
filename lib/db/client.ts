import type { PrismaClient } from "@/generated/prisma/client";

// Imported lazily so a missing DATABASE_URL surfaces as a query failure the
// page can render, not as a module-evaluation crash of the whole route.
export async function db(): Promise<PrismaClient> {
  const { prisma } = await import("@/lib/prisma");
  return prisma;
}
