import { formatNumber } from "@/lib/format";

// R1-V1.7 §3.8.3: the actual denominator is shown alongside every I-CVI.
export function FractionValue({
  value,
  denominator,
  locale,
  digits = 3,
}: {
  value: number;
  denominator: number | null;
  locale: string;
  digits?: number;
}) {
  return (
    <span className="inline-flex items-baseline gap-1.5 tabular-nums">
      <span>{formatNumber(value, locale, digits)}</span>
      <span className="text-xs text-muted-foreground">(n={denominator ?? "?"})</span>
    </span>
  );
}
