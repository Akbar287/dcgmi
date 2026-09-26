// Column specs are plain data so Server Components can describe a table
// without shipping render functions across the RSC boundary.
export type CellValue = string | number | boolean | null | readonly string[];

export type DataTableRow = { id: string } & Record<string, CellValue>;

export type ColumnKind =
  | "text"
  | "long"
  | "code"
  | "number"
  | "decimal"
  | "date"
  | "boolean"
  | "origin"
  | "status"
  | "enum"
  | "tags"
  | "fraction"
  | "exception";

export interface DataTableColumn {
  id: string;
  header: string;
  kind?: ColumnKind;
  /** `fraction`: key of the row value holding the denominator. */
  denominatorId?: string;
  /** `decimal` / `fraction`: fixed digits. */
  digits?: number;
  /** Adds a per-column select filter built from the distinct row values. */
  facet?: boolean;
  /** Hidden until the user enables it from the column menu. */
  hidden?: boolean;
}
