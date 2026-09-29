"use client";

import { ColumnInsertIcon, Download04Icon, Search01Icon } from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";
import type { ReactTable } from "@tanstack/react-table";
import { useMemo } from "react";

import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { NativeSelect, NativeSelectOption } from "@/components/ui/native-select";
import { useT } from "@/lib/i18n/client";

import type { DataTableFeatures } from "./data-table";
import type { DataTableColumn, DataTableRow } from "./types";

type Table = ReactTable<DataTableFeatures, DataTableRow>;

function facetOptions(rows: DataTableRow[], id: string): string[] {
  const values = new Set<string>();
  for (const row of rows) {
    const v = row[id];
    if (v !== null && v !== undefined && !Array.isArray(v)) values.add(String(v));
  }
  return [...values].sort();
}

export function DataTableToolbar({
  table,
  columns,
  rows,
  exportHref,
}: {
  table: Table;
  columns: DataTableColumn[];
  rows: DataTableRow[];
  /** Base URL of the watermarked export (docs/07 P4); `&format=` is appended. */
  exportHref?: string;
}) {
  const t = useT();
  const facets = useMemo(
    () => columns.filter((c) => c.facet).map((c) => ({ column: c, options: facetOptions(rows, c.id) })),
    [columns, rows],
  );
  const globalFilter = typeof table.state.globalFilter === "string" ? table.state.globalFilter : "";
  const filtered = table.getFilteredRowModel().rows.length;

  return (
    <div className="flex flex-wrap items-center gap-2">
      <div className="relative w-full sm:w-64">
        <HugeiconsIcon
          icon={Search01Icon}
          strokeWidth={2}
          aria-hidden="true"
          className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground"
        />
        <Input
          type="search"
          aria-label={t("common.search")}
          placeholder={t("common.search")}
          value={globalFilter}
          onChange={(event) => table.setGlobalFilter(event.target.value)}
          className="pl-9"
        />
      </div>

      {facets.map(({ column, options }) => {
        const current = table.getColumn(column.id)?.getFilterValue();
        return (
          <NativeSelect
            key={column.id}
            size="sm"
            aria-label={column.header}
            value={typeof current === "string" ? current : ""}
            onChange={(event) => table.getColumn(column.id)?.setFilterValue(event.target.value || undefined)}
          >
            <NativeSelectOption value="">
              {column.header}: {t("common.all")}
            </NativeSelectOption>
            {options.map((o) => (
              <NativeSelectOption key={o} value={o}>
                {t.maybe(`enums.${o}`) ?? o}
              </NativeSelectOption>
            ))}
          </NativeSelect>
        );
      })}

      <div className="ml-auto flex items-center gap-2">
        <span className="text-xs text-muted-foreground tabular-nums" aria-live="polite">
          {filtered} / {rows.length} {t("common.rows")}
        </span>
        {exportHref ? (
          <DropdownMenu>
            <DropdownMenuTrigger render={<Button variant="outline" size="sm" />}>
              <HugeiconsIcon icon={Download04Icon} strokeWidth={2} aria-hidden="true" data-icon="inline-start" />
              {t("exports.menu")}
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              {(["csv", "xlsx", "json", "pdf"] as const).map((f) => (
                <DropdownMenuItem key={f} render={<a href={`${exportHref}&format=${f}`} download />}>
                  {f.toUpperCase()}
                </DropdownMenuItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>
        ) : null}
        <DropdownMenu>
          <DropdownMenuTrigger render={<Button variant="outline" size="sm" />}>
            <HugeiconsIcon icon={ColumnInsertIcon} strokeWidth={2} aria-hidden="true" data-icon="inline-start" />
            {t("common.columns")}
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            {table.getAllLeafColumns().map((col) => (
              <DropdownMenuCheckboxItem
                key={col.id}
                checked={col.getIsVisible()}
                onCheckedChange={(checked) => col.toggleVisibility(checked)}
              >
                {columns.find((c) => c.id === col.id)?.header ?? col.id}
              </DropdownMenuCheckboxItem>
            ))}
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </div>
  );
}
