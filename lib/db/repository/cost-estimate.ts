import { DEFAULT_TOKENS } from "@/lib/costs/defaults";
import { callCost, type Price } from "@/lib/costs/pricing";
import { AGENDA_CORONG_11, buildAgendaPlan } from "@/lib/fgd/agenda";

import { db } from "../client";
import { ahpGroupsFor } from "./ahp-sessions";
import { getArtifactHierarchy } from "./artifact";
import { modelPrices, tokenHistory } from "./model-calls";
import { listPanelsForEditor } from "./panel-admin";

export interface EstimateLine {
  kind: "FGD" | "DELPHI" | "AHP" | "SCORING";
  target: string;
  calls: number;
  tokensIn: number;
  tokensOut: number;
  /** null = at least one model without a price. */
  costUsd: number | null;
  fromHistory: number;
}

/**
 * Upper-level estimate per simulator for the active version (SPECIFICATION
 * §4.9 "estimasi biaya sebelum jalan"): calls from the same planners the
 * sessions use, tokens from real history per prompt or DEFAULT_TOKENS.
 */
export async function estimateForVersion(versionId: string): Promise<EstimateLine[]> {
  const prisma = await db();
  const [hierarchy, panels, prices, history, groups, models, indicators] = await Promise.all([
    getArtifactHierarchy(versionId),
    listPanelsForEditor(),
    modelPrices(),
    tokenHistory(),
    ahpGroupsFor(versionId),
    prisma.modelProfile.findMany({ where: { provider: { approved: true, enabled: true } }, include: { provider: { select: { label: true } } } }),
    prisma.indicator.count({ where: { aspect: { domain: { versionId } }, deletedAt: null } }),
  ]);
  const modelIdOf = new Map(models.map((m) => [m.id, m.modelId]));
  const tokens = (promptId: string) => history.get(promptId) ?? { ...DEFAULT_TOKENS[promptId], n: 0 };

  const line = (kind: EstimateLine["kind"], target: string, calls: { promptId: string; modelId: string | undefined; n: number }[]): EstimateLine => {
    let tin = 0;
    let tout = 0;
    let cost: number | null = 0;
    let fromHistory = 0;
    for (const c of calls) {
      const t = tokens(c.promptId);
      tin += t.in * c.n;
      tout += t.out * c.n;
      if (t.n) fromHistory += c.n;
      const price: Price | undefined = c.modelId ? prices.get(c.modelId) : undefined;
      cost = price && cost !== null ? cost + callCost(t.in * c.n, t.out * c.n, price) : null;
    }
    return { kind, target, calls: calls.reduce((n, c) => n + c.n, 0), tokensIn: Math.round(tin), tokensOut: Math.round(tout), costUsd: cost, fromHistory };
  };

  const out: EstimateLine[] = [];
  const plan = buildAgendaPlan(hierarchy, { stages: AGENDA_CORONG_11.map((s) => s.key), domains: [] });
  const components = plan.reduce((n, s) => n + s.items.length, 0);
  for (const p of panels.filter((x) => x.preset === "FGD_6")) {
    out.push(
      line("FGD", p.name, [
        { promptId: "fgd.facilitator.present", modelId: modelIdOf.get(p.facilitatorModelId ?? ""), n: components },
        ...p.seats.flatMap((s) => [
          { promptId: "fgd.seat.argue", modelId: modelIdOf.get(s.model.id), n: components },
          { promptId: "fgd.seat.vote", modelId: modelIdOf.get(s.model.id), n: components },
        ]),
        { promptId: "fgd.notetaker.extract", modelId: modelIdOf.get(p.notetakerModelId ?? ""), n: components },
      ]),
    );
  }
  for (const p of panels.filter((x) => x.preset === "DELPHI_8")) {
    out.push(line("DELPHI", p.name, p.seats.map((s) => ({ promptId: "delphi.seat.rate", modelId: modelIdOf.get(s.model.id), n: indicators }))));
  }
  const pairs = groups.reduce((n, g) => n + (g.elements.length * (g.elements.length - 1)) / 2, 0);
  for (const p of panels.filter((x) => x.preset === "FGD_6" || x.preset === "DELPHI_8")) {
    out.push(line("AHP", p.name, p.seats.map((s) => ({ promptId: "ahp.seat.pairwise", modelId: modelIdOf.get(s.model.id), n: pairs }))));
  }
  for (const m of models) out.push(line("SCORING", `${m.provider.label} · ${m.label}`, [{ promptId: "scoring.assessor.evidence", modelId: m.modelId, n: indicators }]));
  return out;
}

