import type { ReactNode } from "react";

import type { DataTableColumn } from "@/components/organisms/data-table/types";
import type { Permission } from "@/lib/auth/roles";
import type { CurrentUser } from "@/lib/auth/session";
import type { FlatRecord } from "@/lib/db/types";
import type { Dictionary, TranslationKey, TranslationVars, Translator } from "@/lib/i18n";
import type { ModuleKey, SectionSlug } from "@/lib/navigation";

export interface SectionContext {
  t: Translator;
  user: CurrentUser;
  /** Active artifact version; null when the database has none. */
  versionId: string | null;
}

export interface SectionNotice {
  tone?: "info" | "warning" | "locked";
  key: TranslationKey;
  vars?: TranslationVars;
}

export type SectionView =
  | {
      kind: "table";
      /** `version` screens are scoped to the active artifact version. */
      scope: "version" | "global";
      columns: (t: Translator) => DataTableColumn[];
      load: (versionId: string) => Promise<FlatRecord[]>;
      /** Rendered above the table, e.g. cards with actions. */
      header?: (ctx: SectionContext) => Promise<ReactNode>;
    }
  | { kind: "pending"; milestone: `M${number}` }
  | { kind: "custom"; render: (ctx: SectionContext) => Promise<ReactNode> | ReactNode };

export interface SectionDef {
  view: SectionView;
  /** Beyond `console:read`, which every section requires. */
  permission?: Permission;
  notices?: SectionNotice[];
}

export type ModuleSections<M extends ModuleKey> = Record<SectionSlug<M>, SectionDef>;

type ColumnId = keyof Dictionary["columns"];

/** Column whose header comes from `columns.<id>` in the dictionary. */
export function col(
  t: Translator,
  id: ColumnId,
  kind?: DataTableColumn["kind"],
  options?: Omit<DataTableColumn, "id" | "header" | "kind">,
): DataTableColumn {
  return { id, header: t(`columns.${id}`), kind, ...options };
}
