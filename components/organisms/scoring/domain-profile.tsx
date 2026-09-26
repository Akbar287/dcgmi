"use client";

import { Badge } from "@/components/ui/badge";
import { formatNumber } from "@/lib/format";
import { useT } from "@/lib/i18n/client";
import type { ScoringResult } from "@/lib/method/types";

const TICKS = [1, 2, 3, 4, 5];

/**
 * docs/05 §5.3: the 8-domain profile is the main output and always comes
 * first; the composite is a secondary, PROVISIONAL summary on the same screen
 * and is never rendered on its own. Values are printed, not read off bars.
 */
export function DomainProfile({ result, domains }: { result: ScoringResult; domains: { code: string; name: string }[] }) {
  const t = useT();
  const pct = (v: number) => `${(v / 5) * 100}%`;
  return (
    <div className="flex flex-col gap-4">
      <div>
        <p className="text-sm font-medium">{t("scoringSim.domainProfile")}</p>
        <p className="text-xs text-muted-foreground">{t("scoringSim.domainProfileHint")}</p>
      </div>
      <div className="flex flex-col gap-1.5" role="list">
        {domains.map((d) => {
          const v = result.domainProfile[d.code] ?? null;
          return (
            <div key={d.code} role="listitem" className="grid grid-cols-[minmax(0,12rem)_1fr_4.5rem] items-center gap-3 text-sm">
              <span className="truncate" title={d.name}>
                <span className="font-mono text-xs">{d.code}</span> <span className="text-xs text-muted-foreground">{d.name}</span>
              </span>
              <div className="relative h-5 rounded-sm bg-muted/40">
                {TICKS.map((tick) => (
                  <div key={tick} className="absolute inset-y-0 w-px bg-border" style={{ left: pct(tick) }} aria-hidden="true" />
                ))}
                {v === null ? (
                  <div className="absolute inset-y-0.5 left-0 right-0 rounded-sm border border-dashed border-warning/70" aria-hidden="true" />
                ) : (
                  <div className="absolute inset-y-1 left-0 rounded-r-[4px] bg-primary/75" style={{ width: pct(v) }} aria-hidden="true" />
                )}
              </div>
              <span className="text-right tabular-nums text-xs" title={v === null ? t("scoringSim.held") : undefined}>
                {v === null ? t("scoringSim.heldShort") : formatNumber(v, t.locale, 2)}
              </span>
            </div>
          );
        })}
        <div className="grid grid-cols-[minmax(0,12rem)_1fr_4.5rem] gap-3 text-[10px] text-muted-foreground" aria-hidden="true">
          <span />
          <div className="relative h-3">
            {TICKS.map((tick) => (
              <span key={tick} className="absolute -translate-x-1/2 tabular-nums" style={{ left: pct(tick) }}>
                {tick}
              </span>
            ))}
          </div>
          <span />
        </div>
      </div>
      <div className="flex flex-wrap items-center gap-2 rounded-xl border border-dashed p-3 text-sm">
        <span className="text-muted-foreground">{t("scoringSim.composite")}:</span>
        <span className="tabular-nums font-medium">{result.composite === null ? t("scoringSim.held") : formatNumber(result.composite, t.locale, 3)}</span>
        <Badge variant="outline">{t("scoringSim.provisional")}</Badge>
      </div>
      <div className="text-sm">
        <p className="font-medium">{t("scoringSim.missingReport")}</p>
        {result.missingReport.length === 0 ? (
          <p className="text-xs text-muted-foreground">{t("scoringSim.missingNone")}</p>
        ) : (
          <ul className="mt-1 flex flex-col gap-0.5 font-mono text-xs">
            {result.missingReport.map((m, i) => (
              <li key={i}>
                {m.indicatorCode} · {m.kind} → {m.blocks}
              </li>
            ))}
          </ul>
        )}
      </div>
      <details className="text-sm">
        <summary className="cursor-pointer font-medium">{t("scoringSim.aspects")}</summary>
        <ul className="mt-2 grid gap-1 sm:grid-cols-3">
          {Object.entries(result.aspectScores).map(([code, v]) => (
            <li key={code} className="flex justify-between gap-2 rounded-md bg-muted/40 px-2 py-1 text-xs">
              <span className="font-mono">{code}</span>
              <span className="tabular-nums">{v === null ? "—" : formatNumber(v, t.locale, 3)}</span>
            </li>
          ))}
        </ul>
      </details>
    </div>
  );
}
