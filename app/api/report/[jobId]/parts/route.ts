import { can } from "@/lib/auth/roles";
import { getCurrentUser } from "@/lib/auth/session";
import { buildReportPartsZip, ReportError } from "@/lib/db/repository/report-jobs";

export const runtime = "nodejs";
export const maxDuration = 300;

// Every chapter of the G1–G7 report as Word and PDF in one ZIP.
export async function GET(_request: Request, { params }: RouteContext<"/api/report/[jobId]/parts">) {
  const user = await getCurrentUser();
  if (!user || !can(user.role, "console:read")) return new Response("Forbidden", { status: 403 });
  const { jobId } = await params;
  try {
    const { bytes, filename } = await buildReportPartsZip(user.id, jobId, { withIdentities: user.role === "ADMIN" });
    return new Response(new Uint8Array(bytes), { headers: { "Content-Type": "application/zip", "Content-Disposition": `attachment; filename="${filename}"` } });
  } catch (error) {
    if (error instanceof ReportError) return new Response(error.message, { status: error.code === "NOT_FOUND" ? 404 : 409 });
    throw error;
  }
}
