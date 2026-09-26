import { getActiveVersionId } from "@/app/(app)/_lib/active-version";
import { can } from "@/lib/auth/roles";
import { getCurrentUser } from "@/lib/auth/session";
import { db } from "@/lib/db/client";
import { buildReproductionPackage } from "@/lib/db/repository/reproduction";

// SPECIFICATION §4.10 / §3.14: ZIP with everything needed to trace and recompute a run.
export async function GET() {
  const user = await getCurrentUser();
  if (!user || !can(user.role, "console:read")) return new Response("Forbidden", { status: 403 });
  const versionId = await getActiveVersionId();
  if (!versionId) return new Response("No active version", { status: 404 });
  const pkg = await buildReproductionPackage(versionId);
  const prisma = await db();
  await prisma.auditEvent.create({ data: { actorId: user.id, actorKind: "USER", action: "EXPORT_REPRODUCTION", targetType: "ArtifactVersion", targetId: versionId, payload: { filename: pkg.filename, sha256: pkg.sha256, files: pkg.files } } });
  return new Response(new Uint8Array(pkg.buffer), { headers: { "Content-Type": "application/zip", "Content-Disposition": `attachment; filename="${pkg.filename}"`, "X-Package-SHA256": pkg.sha256 } });
}
