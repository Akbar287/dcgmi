"use client";

import { ArrowLeft01Icon, ArrowRight01Icon } from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";
import type { ReactTable } from "@tanstack/react-table";

import { Button } from "@/components/ui/button";
import { NativeSelect, NativeSelectOption } from "@/components/ui/native-select";
import { useT } from "@/lib/i18n/client";

import type { DataTableFeatures } from "./data-table";
import type { DataTableRow } from "./types";

const PAGE_SIZES = [10, 25, 50, 100];

export function DataTablePagination({
  table,
  onPageSizeChange,
}: {
  table: ReactTable<DataTableFeatures, DataTableRow>;
  onPageSizeChange: (size: number) => void;
}) {
  const t = useT();
  const { pageIndex, pageSize } = table.state.pagination;
  const pageCount = Math.max(table.getPageCount(), 1);

  return (
    <div className="flex flex-wrap items-center justify-end gap-3 text-sm">
      <label className="flex items-center gap-2 text-muted-foreground">
        {t("common.rowsPerPage")}
        <NativeSelect size="sm" value={pageSize} onChange={(event) => onPageSizeChange(Number(event.target.value))}>
          {PAGE_SIZES.map((s) => (
            <NativeSelectOption key={s} value={s}>
              {s}
            </NativeSelectOption>
          ))}
        </NativeSelect>
      </label>
      <span className="text-muted-foreground tabular-nums">
        {t("common.page")} {pageIndex + 1} {t("common.of")} {pageCount}
      </span>
      <div className="flex items-center gap-1">
        <Button
          variant="outline"
          size="icon-sm"
          aria-label={t("common.previous")}
          disabled={!table.getCanPreviousPage()}
          onClick={() => table.previousPage()}
        >
          <HugeiconsIcon icon={ArrowLeft01Icon} strokeWidth={2} aria-hidden="true" />
        </Button>
        <Button
          variant="outline"
          size="icon-sm"
          aria-label={t("common.next")}
          disabled={!table.getCanNextPage()}
          onClick={() => table.nextPage()}
        >
          <HugeiconsIcon icon={ArrowRight01Icon} strokeWidth={2} aria-hidden="true" />
        </Button>
      </div>
    </div>
  );
}
