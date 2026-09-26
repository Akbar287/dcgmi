// Display formatting only. Methodological rounding lives in lib/method.
export function formatNumber(value: number, locale: string, digits?: number): string {
  return new Intl.NumberFormat(locale, {
    minimumFractionDigits: digits ?? 0,
    maximumFractionDigits: digits ?? 20,
  }).format(value);
}

export function formatDateTime(value: string | Date, locale: string): string {
  const date = typeof value === "string" ? new Date(value) : value;
  if (Number.isNaN(date.getTime())) return String(value);
  return new Intl.DateTimeFormat(locale, { dateStyle: "medium", timeStyle: "short" }).format(date);
}
