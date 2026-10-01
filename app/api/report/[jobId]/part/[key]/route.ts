import { can } from "@/lib/auth/roles";
import { getCurrentUser } from "@/lib/auth/session";
import { buildReportPart, ReportError } from "@/lib/db/repository/report-jobs";
import { REPORT_CHAPTERS, type ChapterKey } from "@/lib/report/chapters";

export const runtime = "nodejs";
export const maxDuration = 300;

const TYPES = { pdf: "application/pdf", docx: "application/vnd.openxmlformats-officedocument.wordprocessingml.document" } as const;

// One chapter of the G1–G7 report: ?format=pdf|docx, built on demand from the approved chapters.
export async function GET(request: Request, { params }: RouteContext<"/api/report/[jobId]/part/[key]">) {
  const user = await getCurrentUser();
  if (!user || !can(user.role, "console:read")) return new Response("Forbidden", { status: 403 });
  const { jobId, key } = await params;
  const format = new URL(request.url).searchParams.get("format") === "docx" ? "docx" : "pdf";
  if (!REPORT_CHAPTERS.some((c) => c.key === key)) return new Response("Not found", { status: 404 });
  try {
    const { bytes, filename } = await buildReportPart(user.id, jobId, key as ChapterKey, format, { withIdentities: user.role === "ADMIN" });
    return new Response(new Uint8Array(bytes), { headers: { "Content-Type": TYPES[format], "Content-Disposition": `attachment; filename="${filename}"` } });
  } catch (error) {
    if (error instanceof ReportError) return new Response(error.message, { status: error.code === "NOT_FOUND" ? 404 : 409 });
    throw error;
  }
}
