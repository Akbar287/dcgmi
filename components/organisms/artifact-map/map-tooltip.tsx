"use client";

import { ControlledExceptionBadge } from "@/components/atoms/controlled-exception-badge";
import { StatusBadge } from "@/components/atoms/status-badge";
import { useT } from "@/lib/i18n/client";

import { GEOMETRY, truncate, type MapNode } from "./layout";

// All labels are rendered as React text nodes (never HTML), since names come from stored data.
// Placed under the hovered node inside its own column, so it never covers the
// highlighted children to the right. Coordinates are percentages of the
// diagram box because the SVG scales with the card width.
export function MapTooltip({
  node,
  height,
  parents,
}: {
  node: MapNode;
  height: number;
  parents: { domain?: MapNode; aspect?: MapNode };
}) {
  const t = useT();
  const x = node.level === "indicator" ? GEOMETRY.indicatorX + 24 : node.x + 8;
  const left = `${(Math.min(x, GEOMETRY.width - 340) / GEOMETRY.width) * 100}%`;
  const below = node.y + (node.level === "indicator" ? GEOMETRY.row / 2 + 4 : GEOMETRY.pillH / 2 + 6);
  const top = `${(below / height) * 100}%`;
  return (
    <div
      role="tooltip"
      className="pointer-events-none absolute z-10 w-80 rounded-xl border bg-popover p-3 text-sm text-popover-foreground shadow-md"
      style={{ left, top }}
    >
      <p className="font-medium">
        <span className="mr-1.5 font-mono text-xs text-muted-foreground">{node.code}</span>
        {node.name}
      </p>
      {node.level !== "domain" && parents.domain ? (
        <p className="mt-1 text-xs text-muted-foreground">
          {parents.domain.code} — {parents.domain.name}
          {node.level === "indicator" && parents.aspect ? ` · ${parents.aspect.code} — ${parents.aspect.name}` : null}
        </p>
      ) : null}
      {node.level === "domain" ? (
        <p className="mt-1 text-xs text-muted-foreground">
          {t("dashboard.map.aspects", { n: node.childCount })} · {t("dashboard.map.indicators", { n: node.leafCount })}
        </p>
      ) : null}
      {node.level === "aspect" ? (
        <p className="mt-1 text-xs text-muted-foreground">{t("dashboard.map.indicators", { n: node.childCount })}</p>
      ) : null}
      {node.indicator ? (
        <div className="mt-2 flex flex-col gap-2">
          <div className="flex flex-wrap gap-1.5">
            <StatusBadge
              value={node.indicator.complete ? "PASSED" : "PENDING"}
              label={node.indicator.complete ? t("dashboard.map.complete") : t("dashboard.map.incomplete")}
            />
            {node.indicator.isControlledException ? (
              <ControlledExceptionBadge label="CH-08" description={t("notices.controlledException")} />
            ) : null}
          </div>
          <p className="text-xs leading-relaxed text-muted-foreground">
            {node.indicator.operationalDefinition ? truncate(node.indicator.operationalDefinition, 240) : t("dashboard.map.noDefinition")}
          </p>
        </div>
      ) : null}
    </div>
  );
}
