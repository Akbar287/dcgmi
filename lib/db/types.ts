// Flat, serializable record handed to Server Components for list screens.
export type FlatValue = string | number | boolean | null | readonly string[];
export type FlatRecord = { id: string } & Record<string, FlatValue>;

export function iso(date: Date | null | undefined): string | null {
  return date ? date.toISOString() : null;
}

export function decimal(value: { toNumber(): number } | null | undefined): number | null {
  return value ? value.toNumber() : null;
}
