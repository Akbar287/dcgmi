import { DatabaseIcon, HourglassIcon, Layers01Icon, SquareLock01Icon } from "@hugeicons/core-free-icons";
import { notFound } from "next/navigation";

import { EmptyState } from "@/components/molecules/empty-state";
import { Notice } from "@/components/molecules/notice";
import { DataTable } from "@/components/organisms/data-table/data-table";
import { SectionTemplate } from "@/components/templates/section-template";
import { can } from "@/lib/auth/roles";
import { requirePermission, type CurrentUser } from "@/lib/auth/session";
import { tryQuery } from "@/lib/db/result";
import type { Translator } from "@/lib/i18n";
import { getTranslator } from "@/lib/i18n/server";
import { isSection, type ModuleKey } from "@/lib/navigation";

import { getActiveVersionId } from "../_lib/active-version";
import { SECTIONS } from "./registry";
import type { SectionDef } from "./types";

function DbUnavailable({ t }: { t: Translator }) {
  return <EmptyState icon={DatabaseIcon} title={t("db.unavailableTitle")} description={t("db.unavailableBody")} />;
}

async function renderView(module: ModuleKey, slug: string, def: SectionDef, t: Translator, user: CurrentUser) {
  const view = def.view;

  if (def.permission && !can(user.role, def.permission)) {
    return <EmptyState icon={SquareLock01Icon} title={t("forbidden.title")} description={t("forbidden.body")} />;
  }

  if (view.kind === "pending") {
    return (
      <EmptyState icon={HourglassIcon} title={t("pending.title")} description={t("pending.body", { milestone: view.milestone })} />
    );
  }

  const active = await tryQuery(() => getActiveVersionId());
  if (!active.ok) return <DbUnavailable t={t} />;

  if (view.kind === "custom") return view.render({ t, user, versionId: active.data });

  if (view.scope === "version" && !active.data) {
    return <EmptyState icon={Layers01Icon} title={t("noVersion.title")} description={t("noVersion.body")} />;
  }

  const rows = await tryQuery(() => view.load(active.data ?? ""));
  if (!rows.ok) return <DbUnavailable t={t} />;
  const header = view.header ? await tryQuery(() => view.header!({ t, user, versionId: active.data })) : null;

  return (
    <>
      {header?.ok ? header.data : null}
      <DataTable columns={view.columns(t)} rows={rows.data} storageKey={`${module}.${slug}`} />
    </>
  );
}

export async function renderSection(module: ModuleKey, slug: string) {
  const user = await requirePermission("console:read");
  if (!isSection(module, slug)) notFound();

  const t = await getTranslator();
  const def: SectionDef = (SECTIONS[module] as Record<string, SectionDef>)[slug];

  return (
    <SectionTemplate
      eyebrow={t(`nav.modules.${module}`)}
      title={t.maybe(`nav.sections.${module}.${slug}`) ?? slug}
      notices={def.notices?.map((n) => (
        <Notice key={n.key} tone={n.tone}>
          {t(n.key, n.vars)}
        </Notice>
      ))}
    >
      {await renderView(module, slug, def, t, user)}
    </SectionTemplate>
  );
}
