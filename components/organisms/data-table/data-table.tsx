"use client";

import { ArrowDown01Icon, ArrowUp01Icon, ArrowUpDownIcon, DatabaseIcon } from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";
import {
  columnFilteringFeature,
  columnVisibilityFeature,
  createColumnHelper,
  createFilteredRowModel,
  createPaginatedRowModel,
  createSortedRowModel,
  filterFn_equalsString,
  filterFn_includesString,
  globalFilteringFeature,
  rowPaginationFeature,
  rowSortingFeature,
  sortFn_alphanumeric,
  sortFn_basic,
  tableFeatures,
  useTable,
} from "@tanstack/react-table";
import { useEffect, useMemo } from "react";

import { EmptyState } from "@/components/molecules/empty-state";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useT } from "@/lib/i18n/client";

import { DataTableCell } from "./data-table-cell";
import { DataTablePagination } from "./data-table-pagination";
import { DataTableToolbar } from "./data-table-toolbar";
import type { CellValue, DataTableColumn, DataTableRow } from "./types";

const features = tableFeatures({
  rowSortingFeature,
  columnFilteringFeature,
  globalFilteringFeature,
  columnVisibilityFeature,
  rowPaginationFeature,
  sortedRowModel: createSortedRowModel(),
  filteredRowModel: createFilteredRowModel(),
  paginatedRowModel: createPaginatedRowModel(),
  filterFns: { includesString: filterFn_includesString, equalsString: filterFn_equalsString },
  sortFns: { alphanumeric: sortFn_alphanumeric, basic: sortFn_basic },
});

export type DataTableFeatures = typeof features;

const helper = createColumnHelper<typeof features, DataTableRow>();
const NUMERIC_KINDS = new Set(["number", "decimal", "fraction"]);
const PAGE_SIZE_DEFAULT = 25;

function readPageSize(key: string): number | null {
  try {
    const stored = Number(window.localStorage.getItem(key));
    return Number.isInteger(stored) && stored > 0 ? stored : null;
  } catch {
    return null;
  }
}

export function DataTable({
  columns,
  rows,
  storageKey,
  exportHref,
}: {
  columns: DataTableColumn[];
  rows: DataTableRow[];
  /** Remembers page size per table (docs/06 §3). */
  storageKey: string;
  exportHref?: string;
}) {
  const t = useT();
  const pageSizeKey = `ddc:table:${storageKey}:pageSize`;

  const columnDefs = useMemo(
    () =>
      helper.columns(
        columns.map((c) =>
          helper.accessor((row) => row[c.id] ?? null, {
            id: c.id,
            header: c.header,
            sortFn: NUMERIC_KINDS.has(c.kind ?? "text") ? "basic" : "alphanumeric",
            filterFn: "equalsString",
            sortUndefined: "last",
          }),
        ),
      ),
    [columns],
  );

  const initialVisibility = useMemo(
    () => Object.fromEntries(columns.filter((c) => c.hidden).map((c) => [c.id, false])),
    [columns],
  );

  const specById = useMemo(() => new Map(columns.map((c) => [c.id, c])), [columns]);

  const table = useTable({
    features,
    columns: columnDefs,
    data: rows,
    globalFilterFn: "includesString",
    initialState: {
      columnVisibility: initialVisibility,
      pagination: { pageIndex: 0, pageSize: PAGE_SIZE_DEFAULT },
    },
  });

  // localStorage is read after mount so server and client markup agree.
  useEffect(() => {
    const stored = readPageSize(pageSizeKey);
    if (stored) table.setPageSize(stored);
  }, [pageSizeKey, table]);

  const setPageSize = (size: number) => {
    table.setPageSize(size);
    try {
      window.localStorage.setItem(pageSizeKey, String(size));
    } catch {
      // Storage may be blocked; the size still applies for this visit.
    }
  };

  if (rows.length === 0) {
    return <EmptyState icon={DatabaseIcon} title={t("common.empty")} description={t("common.emptyHint")} />;
  }

  const visibleRows = table.getRowModel().rows;

  return (
    <div className="flex flex-col gap-3">
      <DataTableToolbar table={table} columns={columns} rows={rows} exportHref={exportHref} />
      {/* Wide tables scroll inside their own container (docs/06 §5). */}
      <div className="overflow-x-auto rounded-2xl border">
        <Table>
          <TableHeader>
            {table.getHeaderGroups().map((group) => (
              <TableRow key={group.id}>
                {group.headers.map((header) => {
                  const sorted = header.column.getIsSorted();
                  const label = specById.get(header.column.id)?.header ?? header.column.id;
                  return (
                    <TableHead
                      key={header.id}
                      aria-sort={sorted === "asc" ? "ascending" : sorted === "desc" ? "descending" : "none"}
                    >
                      <button
                        type="button"
                        onClick={header.column.getToggleSortingHandler()}
                        className="inline-flex items-center gap-1 rounded-md outline-none hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring"
                      >
                        {label}
                        <HugeiconsIcon
                          icon={sorted === "asc" ? ArrowUp01Icon : sorted === "desc" ? ArrowDown01Icon : ArrowUpDownIcon}
                          strokeWidth={2}
                          aria-hidden="true"
                          className="size-3.5 text-muted-foreground"
                        />
                      </button>
                    </TableHead>
                  );
                })}
              </TableRow>
            ))}
          </TableHeader>
          <TableBody>
            {visibleRows.length === 0 ? (
              <TableRow>
                <TableCell colSpan={table.getVisibleLeafColumns().length} className="h-24 text-center text-muted-foreground">
                  {t("common.noMatch")}
                </TableCell>
              </TableRow>
            ) : (
              visibleRows.map((row) => (
                <TableRow key={row.id}>
                  {row.getVisibleCells().map((cell) => {
                    const spec = specById.get(cell.column.id);
                    return (
                      <TableCell key={cell.id} className="align-top">
                        {spec ? <DataTableCell column={spec} value={cell.getValue() as CellValue} row={row.original} /> : null}
                      </TableCell>
                    );
                  })}
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>
      <DataTablePagination table={table} onPageSizeChange={setPageSize} />
    </div>
  );
}
