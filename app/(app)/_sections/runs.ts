import { listPipelineRuns, listRunSteps } from "@/lib/db/repository/runs";

import { EstimatorView } from "./budget-views";
import { RunDesignerView } from "./pipeline-views";
import { col, type ModuleSections } from "./types";

export const runsSections: ModuleSections<"runs"> = {
  daftar: {
    view: {
      kind: "table",
      scope: "version",
      load: listPipelineRuns,
      columns: (t) => [
        col(t, "name"),
        col(t, "mode", "enum", { facet: true }),
        col(t, "status", "status", { facet: true }),
        col(t, "steps", "number"),
        col(t, "budget", "decimal", { digits: 2 }),
        col(t, "spent", "decimal", { digits: 2 }),
        col(t, "startedAt", "date"),
        col(t, "endedAt", "date"),
        col(t, "action", "link", { hrefBase: "/runs/jalur/", linkText: t("pipeline.open") }),
      ],
    },
  },
  perancang: { notices: [{ key: "banner.simulatedDetail" }], view: { kind: "custom", render: (ctx) => RunDesignerView(ctx) } },
  monitor: {
    view: {
      kind: "table",
      scope: "version",
      load: listRunSteps,
      columns: (t) => [
        col(t, "run", "text", { facet: true }),
        col(t, "order", "number"),
        col(t, "stage", "code", { facet: true }),
        col(t, "label"),
        col(t, "status", "status", { facet: true }),
        col(t, "gateChecked", "code"),
        col(t, "tokensIn", "number"),
        col(t, "tokensOut", "number"),
        col(t, "cost", "decimal", { digits: 4 }),
        col(t, "error", "long"),
      ],
    },
  },
  estimator: { view: { kind: "custom", render: (ctx) => EstimatorView(ctx) } },
};
