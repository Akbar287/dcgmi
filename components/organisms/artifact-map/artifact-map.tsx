"use client";

import Link from "next/link";
import { useMemo, useState } from "react";

import { Card, CardAction, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { useT } from "@/lib/i18n/client";
import { cn } from "@/lib/utils";

import { computeLayout, GEOMETRY as G, lineage, linkPath, truncate, type MapDomain, type MapNode } from "./layout";
import { MapList } from "./map-list";
import { MapTooltip } from "./map-tooltip";

const color = (slot: number) => `var(--viz-${slot})`;

function Pill({ node, width, onHover }: { node: MapNode; width: number; onHover: (id: string | null) => void }) {
  const h = G.pillH;
  const tint = node.level === "domain" ? 0.14 : 0.07;
  const max = node.level === "domain" ? G.maxChars.domain : G.maxChars.aspect;
  return (
    <g transform={`translate(${node.x},${node.y - h / 2})`} onMouseEnter={() => onHover(node.id)}>
      <rect width={width} height={h} rx={8} fill={color(node.slot)} fillOpacity={tint} />
      <rect width={4} height={h} rx={2} fill={color(node.slot)} />
      <text x={14} y={h / 2} dominantBaseline="central" className="fill-foreground text-[12px]">
        <tspan className="font-mono font-semibold">{node.code}</tspan>
        <tspan dx={6}>{truncate(node.name, max)}</tspan>
      </text>
      <text x={width - 10} y={h / 2} dominantBaseline="central" textAnchor="end" className="fill-muted-foreground text-[11px] tabular-nums">
        {node.leafCount}
      </text>
    </g>
  );
}

export function ArtifactMap({ domains }: { domains: MapDomain[] }) {
  const t = useT();
  const { nodes, links, height } = useMemo(() => computeLayout(domains), [domains]);
  const [activeId, setActiveId] = useState<string | null>(null);
  const lit = useMemo(() => lineage(nodes, activeId), [nodes, activeId]);
  const active = activeId ? nodes.find((n) => n.id === activeId) : undefined;
  const byId = useMemo(() => new Map(nodes.map((n) => [n.id, n])), [nodes]);
  const dim = (id: string) => (lit && !lit.has(id) ? "opacity-20" : "opacity-100");

  const aspects = nodes.filter((n) => n.level === "aspect").length;
  const indicators = nodes.filter((n) => n.level === "indicator").length;
  const summary = t("dashboard.map.summary", { domains: domains.length, aspects, indicators });

  return (
    <Card>
      <CardHeader>
        <CardTitle>{t("dashboard.map.title")}</CardTitle>
        <CardDescription>
          {summary}. {t("dashboard.map.description")}
        </CardDescription>
        <CardAction>
          <Link href="/artefak/indikator" className="text-sm underline underline-offset-4">
            {t("dashboard.map.openTable")}
          </Link>
        </CardAction>
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        <p className="flex items-center gap-2 text-xs text-muted-foreground">
          <svg width="12" height="12" aria-hidden="true">
            <circle cx="6" cy="6" r="4" fill="none" stroke="currentColor" strokeWidth="2" />
          </svg>
          {t("dashboard.map.incompleteLegend")}
        </p>
        {/* Wide diagram scrolls inside its own container (docs/06 §5). */}
        <div className="overflow-x-auto">
          <div className="relative w-full" style={{ minWidth: G.minRenderWidth }} onMouseLeave={() => setActiveId(null)}>
            <svg
              viewBox={`0 0 ${G.width} ${height}`}
              className="block h-auto w-full"
              role="img"
              aria-label={`${t("dashboard.map.title")}: ${summary}`}
            >
              <g fill="none" strokeWidth={2} strokeLinecap="round">
                {links.map((l) => (
                  <path
                    key={l.id}
                    d={linkPath(l.from, l.to)}
                    stroke={color(l.from.slot)}
                    strokeOpacity={0.55}
                    className={cn("transition-opacity duration-150 motion-reduce:transition-none", dim(l.to.id))}
                  />
                ))}
              </g>
              {nodes.map((n) => (
                <g key={n.id} className={cn("transition-opacity duration-150 motion-reduce:transition-none", dim(n.id))}>
                  {n.level === "domain" ? <Pill node={n} width={G.domainW} onHover={setActiveId} /> : null}
                  {n.level === "aspect" ? <Pill node={n} width={G.aspectW} onHover={setActiveId} /> : null}
                  {n.level === "indicator" && n.indicator ? (
                    <g onMouseEnter={() => setActiveId(n.id)}>
                      {/* Hit target spans the whole row, not just the 8px marker. */}
                      <rect x={G.indicatorX - 12} y={n.y - G.row / 2} width={G.width - G.indicatorX + 12} height={G.row} fill="transparent" />
                      <circle
                        cx={G.indicatorX - 2}
                        cy={n.y}
                        r={4}
                        stroke={color(n.slot)}
                        strokeWidth={2}
                        className={n.indicator.complete ? undefined : "fill-card"}
                        fill={n.indicator.complete ? color(n.slot) : undefined}
                      />
                      <text x={G.indicatorX + 10} y={n.y} dominantBaseline="central" className="fill-foreground text-[12px]">
                        <tspan className="fill-muted-foreground font-mono text-[11px]">{n.code}</tspan>
                        <tspan dx={6}>{truncate(n.name, G.maxChars.indicator)}</tspan>
                        {n.indicator.isControlledException ? (
                          <tspan dx={6} className="fill-muted-foreground text-[10px] font-medium">
                            CH-08
                          </tspan>
                        ) : null}
                      </text>
                    </g>
                  ) : null}
                </g>
              ))}
            </svg>
            {active ? (
              <MapTooltip
                height={height}
                node={active}
                parents={{ domain: byId.get(active.domainId), aspect: active.aspectId ? byId.get(active.aspectId) : undefined }}
              />
            ) : null}
          </div>
        </div>
        <details className="group rounded-xl border p-3">
          <summary className="cursor-pointer text-sm font-medium">{t("dashboard.map.showList")}</summary>
          <div className="mt-3">
            <MapList domains={domains} />
          </div>
        </details>
      </CardContent>
    </Card>
  );
}
