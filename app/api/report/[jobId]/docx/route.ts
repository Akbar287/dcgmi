import { can } from "@/lib/auth/roles";
import { getCurrentUser } from "@/lib/auth/session";
import { buildReportDocx, ReportError } from "@/lib/db/repository/report-jobs";

export const runtime = "nodejs";
export const maxDuration = 300;

// Word version of the G1–G7 report, built on demand from the approved chapters.
export async function GET(_request: Request, { params }: RouteContext<"/api/report/[jobId]/docx">) {
  const user = await getCurrentUser();
  if (!user || !can(user.role, "console:read")) return new Response("Forbidden", { status: 403 });
  const { jobId } = await params;
  try {
    const { bytes, sha256, filename } = await buildReportDocx(user.id, jobId, { withIdentities: user.role === "ADMIN" });
    return new Response(new Uint8Array(bytes), {
      headers: {
        "Content-Type": "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
        "Content-Disposition": `attachment; filename="${filename}"`,
        "X-Report-SHA256": sha256,
      },
    });
  } catch (error) {
    if (error instanceof ReportError) return new Response(error.message, { status: error.code === "NOT_FOUND" ? 404 : 409 });
    throw error;
  }
}
