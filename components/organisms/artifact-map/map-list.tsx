"use client";

import { useT } from "@/lib/i18n/client";

import type { MapDomain } from "./layout";

/** Non-visual equivalent of the tree: the same hierarchy as nested lists, with status in text. */
export function MapList({ domains }: { domains: MapDomain[] }) {
  const t = useT();
  return (
    <ol className="grid gap-4 text-sm sm:grid-cols-2 xl:grid-cols-4">
      {domains.map((d) => (
        <li key={d.code}>
          <p className="font-medium">
            <span className="mr-1 font-mono text-xs text-muted-foreground">{d.code}</span>
            {d.name}
          </p>
          <ol className="mt-1 flex flex-col gap-1.5 border-l pl-3">
            {d.aspects.map((a) => (
              <li key={a.code}>
                <p>
                  <span className="mr-1 font-mono text-xs text-muted-foreground">{a.code}</span>
                  {a.name}
                </p>
                <ul className="mt-0.5 flex flex-col gap-0.5 pl-3 text-muted-foreground">
                  {a.indicators.map((i) => (
                    <li key={i.code}>
                      <span className="mr-1 font-mono text-xs">{i.code}</span>
                      {i.name}
                      {i.isControlledException ? " · CH-08" : null}
                      {!i.complete ? ` · ${t("dashboard.map.incomplete")}` : null}
                    </li>
                  ))}
                </ul>
              </li>
            ))}
          </ol>
        </li>
      ))}
    </ol>
  );
}
