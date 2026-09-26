// Pure layout for a three-column tidy tree (domain → aspect → indicator).
// Leaves are stacked in stored order; parents sit at the mean of their children.

export interface MapIndicator {
  code: string;
  name: string;
  isControlledException: boolean;
  operationalDefinition: string | null;
  complete: boolean;
}
export interface MapAspect {
  code: string;
  name: string;
  indicators: MapIndicator[];
}
export interface MapDomain {
  code: string;
  name: string;
  aspects: MapAspect[];
}

export type NodeLevel = "domain" | "aspect" | "indicator";

export interface MapNode {
  id: string;
  level: NodeLevel;
  code: string;
  name: string;
  x: number;
  y: number;
  /** Categorical slot 1–8, fixed by domain order (never by rank). */
  slot: number;
  domainId: string;
  aspectId: string | null;
  childCount: number;
  leafCount: number;
  indicator?: MapIndicator;
}

export interface MapLink {
  id: string;
  from: MapNode;
  to: MapNode;
}

export const GEOMETRY = {
  width: 1160,
  row: 22,
  domainGap: 14,
  top: 18,
  domainX: 0,
  domainW: 300,
  aspectX: 360,
  aspectW: 320,
  indicatorX: 740,
  pillH: 28,
  /** Label budgets (characters) per column; the tooltip carries the full name. */
  maxChars: { domain: 36, aspect: 40, indicator: 56 },
  /** Below this the diagram scrolls inside its card instead of shrinking further. */
  minRenderWidth: 960,
} as const;

export function computeLayout(domains: MapDomain[]) {
  const g = GEOMETRY;
  const nodes: MapNode[] = [];
  const links: MapLink[] = [];
  let y = g.top;

  domains.forEach((d, di) => {
    const domainId = `d:${d.code}`;
    const slot = (di % 8) + 1;
    const aspectNodes: MapNode[] = [];
    for (const a of d.aspects) {
      const aspectId = `a:${d.code}/${a.code}`;
      const leaves: MapNode[] = a.indicators.map((i) => {
        const node: MapNode = {
          id: `i:${i.code}`,
          level: "indicator",
          code: i.code,
          name: i.name,
          x: g.indicatorX,
          y: (y += g.row) - g.row,
          slot,
          domainId,
          aspectId,
          childCount: 0,
          leafCount: 1,
          indicator: i,
        };
        return node;
      });
      const aspect: MapNode = {
        id: aspectId,
        level: "aspect",
        code: a.code,
        name: a.name,
        x: g.aspectX,
        y: leaves.length ? (leaves[0].y + leaves[leaves.length - 1].y) / 2 : y,
        slot,
        domainId,
        aspectId,
        childCount: leaves.length,
        leafCount: leaves.length,
      };
      aspectNodes.push(aspect);
      nodes.push(aspect, ...leaves);
      leaves.forEach((l) => links.push({ id: `${aspect.id}>${l.id}`, from: aspect, to: l }));
    }
    const domain: MapNode = {
      id: domainId,
      level: "domain",
      code: d.code,
      name: d.name,
      x: g.domainX,
      y: aspectNodes.length ? (aspectNodes[0].y + aspectNodes[aspectNodes.length - 1].y) / 2 : y,
      slot,
      domainId,
      aspectId: null,
      childCount: aspectNodes.length,
      leafCount: aspectNodes.reduce((n, a) => n + a.leafCount, 0),
    };
    nodes.push(domain);
    aspectNodes.forEach((a) => links.push({ id: `${domain.id}>${a.id}`, from: domain, to: a }));
    y += g.domainGap;
  });

  return { nodes, links, height: y - g.domainGap + g.top };
}

/** Horizontal S-curve from a parent's right edge to a child's left edge. */
export function linkPath(from: MapNode, to: MapNode): string {
  const g = GEOMETRY;
  const x1 = from.level === "domain" ? g.domainX + g.domainW : g.aspectX + g.aspectW;
  const x2 = to.level === "aspect" ? g.aspectX : g.indicatorX - 8;
  const mid = (x1 + x2) / 2;
  return `M${x1},${from.y} C${mid},${from.y} ${mid},${to.y} ${x2},${to.y}`;
}

/** Ids in the hovered node's lineage: itself, its ancestors, and its descendants. */
export function lineage(nodes: MapNode[], activeId: string | null): Set<string> | null {
  if (!activeId) return null;
  const active = nodes.find((n) => n.id === activeId);
  if (!active) return null;
  const ids = new Set<string>([active.id, active.domainId]);
  if (active.aspectId) ids.add(active.aspectId);
  for (const n of nodes) {
    if (active.level === "domain" && n.domainId === active.id) ids.add(n.id);
    if (active.level === "aspect" && n.aspectId === active.id) ids.add(n.id);
  }
  return ids;
}

export function truncate(text: string, max: number): string {
  return text.length > max ? `${text.slice(0, max - 1).trimEnd()}…` : text;
}
