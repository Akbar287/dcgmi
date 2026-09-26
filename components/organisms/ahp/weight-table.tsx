import { getTranslator } from "@/lib/i18n/server";
import { formatNumber } from "@/lib/format";

export interface WeightRow {
  code: string;
  name: string;
  aggregate: number | null;
  individual: number[];
}

/**
 * Aggregate weight as a bar, with the individual range drawn on the same
 * axis (docs/05 §4.4: inter-expert variation is never hidden). Values are
 * always printed, so nothing depends on reading the bar.
 */
export async function WeightTable({ rows }: { rows: WeightRow[] }) {
  const t = await getTranslator();
  const max = Math.max(0.0001, ...rows.flatMap((r) => [r.aggregate ?? 0, ...r.individual]));
  const pct = (v: number) => `${(v / max) * 100}%`;
  return (
    <div className="overflow-x-auto rounded-2xl border">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b text-left text-xs text-muted-foreground">
            <th className="px-3 py-2 font-medium">{t("columns.code")}</th>
            <th className="px-3 py-2 font-medium">{t("ahpSim.room.aggregate")}</th>
            <th className="w-2/5 px-3 py-2 font-medium">
              <span className="sr-only">{t("ahpSim.room.weights")}</span>
            </th>
            <th className="px-3 py-2 font-medium">{t("ahpSim.room.range")}</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => {
            const lo = r.individual.length ? Math.min(...r.individual) : null;
            const hi = r.individual.length ? Math.max(...r.individual) : null;
            return (
              <tr key={r.code} className="border-b last:border-0">
                <td className="px-3 py-2">
                  <span className="font-mono text-xs">{r.code}</span> <span className="text-xs text-muted-foreground">{r.name}</span>
                </td>
                <td className="px-3 py-2 tabular-nums">{r.aggregate === null ? "—" : formatNumber(r.aggregate, t.locale, 4)}</td>
                <td className="px-3 py-2">
                  <div className="relative h-4" title={`${r.code}: ${r.aggregate?.toFixed(4) ?? "—"} (${lo?.toFixed(3)}–${hi?.toFixed(3)})`}>
                    {r.aggregate !== null ? <div className="absolute top-1 left-0 h-2 rounded-r-[4px] bg-primary/70" style={{ width: pct(r.aggregate) }} /> : null}
                    {lo !== null && hi !== null ? (
                      <div className="absolute top-[7px] h-0.5 bg-foreground/60" style={{ left: pct(lo), width: `calc(${pct(hi)} - ${pct(lo)})` }} />
                    ) : null}
                    {r.individual.map((v, i) => (
                      <div key={i} className="absolute top-[5px] size-1.5 -translate-x-1/2 rounded-full bg-foreground/70 ring-2 ring-background" style={{ left: pct(v) }} />
                    ))}
                  </div>
                </td>
                <td className="px-3 py-2 text-xs tabular-nums text-muted-foreground">
                  {lo === null ? "—" : `${formatNumber(lo, t.locale, 3)}–${formatNumber(hi!, t.locale, 3)} (n=${r.individual.length})`}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
