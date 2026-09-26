"use client";

import Link from "next/link";

import { CodeText } from "@/components/atoms/code-text";
import { ControlledExceptionBadge } from "@/components/atoms/controlled-exception-badge";
import { EmptyValue } from "@/components/atoms/empty-value";
import { FractionValue } from "@/components/atoms/fraction-value";
import { isDataOrigin, OriginBadge } from "@/components/atoms/origin-badge";
import { StatusBadge } from "@/components/atoms/status-badge";
import { Badge } from "@/components/ui/badge";
import { formatDateTime, formatNumber } from "@/lib/format";
import { useT } from "@/lib/i18n/client";

import type { CellValue, DataTableColumn, DataTableRow } from "./types";

export function DataTableCell({
  column,
  value,
  row,
}: {
  column: DataTableColumn;
  value: CellValue;
  row: DataTableRow;
}) {
  const t = useT();
  const empty = <EmptyValue srLabel={t("common.empty")} />;

  if (value === null || value === "" || (Array.isArray(value) && value.length === 0)) {
    return column.kind === "exception" ? null : empty;
  }

  switch (column.kind) {
    case "code":
      return <CodeText>{String(value)}</CodeText>;
    case "link":
      return (
        <Link href={`${column.hrefBase ?? ""}${row.id}`} className={column.linkText ? "text-sm underline underline-offset-4" : "font-mono text-xs underline underline-offset-4"}>
          {column.linkText ?? String(value)}
        </Link>
      );
    case "long":
      return <span className="line-clamp-2 max-w-md text-muted-foreground">{String(value)}</span>;
    case "number":
    case "decimal":
      return typeof value === "number" ? (
        <span className="tabular-nums">
          {formatNumber(value, t.locale, column.kind === "decimal" ? (column.digits ?? 3) : undefined)}
        </span>
      ) : (
        <span>{String(value)}</span>
      );
    case "fraction": {
      const denominator = column.denominatorId ? row[column.denominatorId] : null;
      return typeof value === "number" ? (
        <FractionValue
          value={value}
          denominator={typeof denominator === "number" ? denominator : null}
          locale={t.locale}
          digits={column.digits}
        />
      ) : (
        empty
      );
    }
    case "date":
      return <span className="whitespace-nowrap tabular-nums">{formatDateTime(String(value), t.locale)}</span>;
    case "boolean":
      return <span>{value === true ? t("common.yes") : t("common.no")}</span>;
    case "origin":
      return isDataOrigin(value) ? <OriginBadge origin={value} /> : <span>{String(value)}</span>;
    case "status": {
      const raw = String(value);
      return <StatusBadge value={raw} label={t.maybe(`enums.${raw}`) ?? raw} />;
    }
    case "enum": {
      const raw = String(value);
      return <span>{t.maybe(`enums.${raw}`) ?? raw}</span>;
    }
    case "tags":
      return (
        <span className="flex flex-wrap gap-1">
          {(Array.isArray(value) ? value : [String(value)]).map((tag) => (
            <Badge key={tag} variant="secondary">
              {t.maybe(`enums.${tag}`) ?? tag}
            </Badge>
          ))}
        </span>
      );
    case "exception":
      return value === true ? (
        <ControlledExceptionBadge label="CH-08" description={t("notices.controlledException")} />
      ) : null;
    default:
      return <span>{String(value)}</span>;
  }
}
