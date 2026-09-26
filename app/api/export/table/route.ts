import { getActiveVersionId } from "@/app/(app)/_lib/active-version";
import { SECTIONS } from "@/app/(app)/_sections/registry";
import type { SectionDef } from "@/app/(app)/_sections/types";
import { can } from "@/lib/auth/roles";
import { getCurrentUser } from "@/lib/auth/session";
import { db } from "@/lib/db/client";
import { exportFilename, exportOrigin, toCsv, toJson, type Cell } from "@/lib/export/watermark";
import { toXlsx } from "@/lib/export/xlsx";
import { getTranslator } from "@/lib/i18n/server";
import { isSection, type ModuleKey } from "@/lib/navigation";

const FORMATS = ["csv", "xlsx", "json"] as const;
type Format = (typeof FORMATS)[number];

// SPECIFICATION §4.10: every table view exports as CSV/XLSX/JSON with the
// docs/07 P4 watermark, which the caller cannot turn off.
export async function GET(request: Request) {
  const user = await getCurrentUser();
  if (!user || !can(user.role, "console:read")) return new Response("Forbidden", { status: 403 });
  const url = new URL(request.url);
  const moduleKey = url.searchParams.get("module") ?? "";
  const section = url.searchParams.get("section") ?? "";
  const format = url.searchParams.get("format") as Format;
  if (!FORMATS.includes(format) || !(moduleKey in SECTIONS) || !isSection(moduleKey as ModuleKey, section)) return new Response("Not found", { status: 404 });
  const def: SectionDef = (SECTIONS[moduleKey as ModuleKey] as Record<string, SectionDef>)[section];
  if (def.view.kind !== "table") return new Response("Not a table", { status: 400 });
  if (def.permission && !can(user.role, def.permission)) return new Response("Forbidden", { status: 403 });

  const t = await getTranslator();
  const versionId = await getActiveVersionId();
  if (def.view.scope === "version" && !versionId) return new Response("No active version", { status: 404 });
  const rows = await def.view.load(versionId ?? "");
  const columns = def.view.columns(t).filter((c) => c.kind !== "link");
  const value = (v: unknown): Cell => (Array.isArray(v) ? v.join("; ") : v === undefined ? null : (v as Cell));
  const origin = exportOrigin(rows.map((r) => (typeof r.origin === "string" ? r.origin : null)), moduleKey);
  const prisma = await db();
  const version = versionId ? await prisma.artifactVersion.findUnique({ where: { id: versionId }, select: { label: true } }) : null;
  const base = `${moduleKey}_${section}${def.view.scope === "version" && version ? `_${version.label}` : ""}`;
  const filename = exportFilename(base, format, origin);

  let body: string | Buffer;
  let type: string;
  if (format === "csv") {
    body = toCsv(columns.map((c) => c.header), rows.map((r) => columns.map((c) => value(r[c.id]))), origin);
    type = "text/csv; charset=utf-8";
  } else if (format === "json") {
    body = toJson({ table: `${moduleKey}/${section}`, version: version?.label ?? null, exportedAt: new Date().toISOString() }, columns.map((c) => c.id), rows.map((r) => Object.fromEntries(columns.map((c) => [c.id, value(r[c.id])]))), origin);
    type = "application/json; charset=utf-8";
  } else {
    body = await toXlsx(`${moduleKey}_${section}`, columns.map((c) => c.header), rows.map((r) => columns.map((c) => value(r[c.id]))), origin);
    type = "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";
  }
  await prisma.auditEvent.create({ data: { actorId: user.id, actorKind: "USER", action: "EXPORT_TABLE", targetType: "Section", targetId: `${moduleKey}/${section}`, payload: { format, rows: rows.length, origin, filename, version: version?.label ?? null } } });
  return new Response(new Uint8Array(typeof body === "string" ? Buffer.from(body, "utf8") : body), { headers: { "Content-Type": type, "Content-Disposition": `attachment; filename="${filename}"` } });
}
