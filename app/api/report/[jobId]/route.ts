import { can } from "@/lib/auth/roles";
import { getCurrentUser } from "@/lib/auth/session";
import { db } from "@/lib/db/client";

export const runtime = "nodejs";

// The stored report PDF (no watermark or SIM_ prefix at the researcher's request, docs/07 P4 exception).
export async function GET(_request: Request, { params }: RouteContext<"/api/report/[jobId]">) {
  const user = await getCurrentUser();
  if (!user || !can(user.role, "console:read")) return new Response("Forbidden", { status: 403 });
  const { jobId } = await params;
  const prisma = await db();
  const job = await prisma.reportJob.findUnique({ where: { id: jobId }, select: { pdf: true, pdfSha256: true, versionId: true } });
  if (!job?.pdf) return new Response("Not found", { status: 404 });
  const version = await prisma.artifactVersion.findUnique({ where: { id: job.versionId }, select: { label: true } });
  const filename = `Laporan_G1-G7_${(version?.label ?? "versi").replace(/[^A-Za-z0-9._-]+/g, "_")}.pdf`;
  await prisma.auditEvent.create({ data: { actorId: user.id, actorKind: "USER", action: "EXPORT_REPORT", targetType: "ReportJob", targetId: jobId, payload: { filename, sha256: job.pdfSha256 } } });
  return new Response(new Uint8Array(job.pdf), { headers: { "Content-Type": "application/pdf", "Content-Disposition": `attachment; filename="${filename}"`, "X-Report-SHA256": job.pdfSha256 ?? "" } });
}
