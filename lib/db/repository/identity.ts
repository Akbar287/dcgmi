import { db } from "../client";
import type { FlatRecord } from "../types";

// Owner/Admin-only mapping (R1-V1.7 §3.13.2). Callers must check
// `identity:read` first; this table never joins analysis queries or exports.
export async function listPanelistIdentities(): Promise<FlatRecord[]> {
  const prisma = await db();
  const rows = await prisma.panelistIdentity.findMany({ orderBy: { panelCode: "asc" } });
  return rows.map((p) => ({
    id: p.id,
    panelCode: p.panelCode,
    fullName: p.fullName,
    email: p.email,
    institution: p.institution,
    note: p.note,
  }));
}
