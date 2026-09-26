import { getActiveVersionId } from "@/app/(app)/_lib/active-version";
import { can } from "@/lib/auth/roles";
import { getCurrentUser } from "@/lib/auth/session";
import { db } from "@/lib/db/client";
import { buildRecomputeExport } from "@/lib/db/repository/scoring-runs";

// docs/05 §7: input for `python scripts/recompute.py <file> --report <out>`.
// Watermarked (docs/07 P4): `_warning` + `_dataOrigin` at the root, `SIM_` prefix.
export async function GET() {
  const user = await getCurrentUser();
  if (!user || !can(user.role, "console:read")) return new Response("Forbidden", { status: 403 });
  const versionId = await getActiveVersionId();
  if (!versionId) return new Response("No active version", { status: 404 });
  const { json, sha256, filename } = await buildRecomputeExport(versionId);
  const prisma = await db();
  await prisma.auditEvent.create({ data: { actorId: user.id, actorKind: "USER", action: "EXPORT_RECOMPUTE", targetType: "ArtifactVersion", targetId: versionId, payload: { sha256, filename } } });
  return new Response(json, {
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "Content-Disposition": `attachment; filename="${filename}"`,
      "X-Export-SHA256": sha256,
    },
  });
}
