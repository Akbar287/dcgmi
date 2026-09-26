import { listAuditEvents } from "@/lib/db/repository/audit";
import { listModelCallLedger } from "@/lib/db/repository/model-calls";

import { ExportView, ReproductionView } from "./audit-views";
import { col, type ModuleSections } from "./types";

export const auditSections: ModuleSections<"audit"> = {
  aktivitas: {
    view: {
      kind: "table",
      scope: "global",
      load: () => listAuditEvents(),
      columns: (t) => [
        col(t, "createdAt", "date"),
        col(t, "actorKind", "code", { facet: true }),
        col(t, "actor", "code"),
        col(t, "action", "code", { facet: true }),
        col(t, "targetType", "text", { facet: true }),
        col(t, "target", "code"),
      ],
    },
  },
  "log-model": {
    view: {
      kind: "table",
      scope: "global",
      load: () => listModelCallLedger(),
      columns: (t) => [
        col(t, "origin", "origin", { facet: true }),
        col(t, "createdAt", "date"),
        col(t, "kind", "code", { facet: true }),
        col(t, "speaker", "code", { facet: true }),
        col(t, "model", "code", { facet: true }),
        col(t, "promptHash", "code", { hidden: true }),
        col(t, "tokensIn", "number"),
        col(t, "tokensOut", "number"),
        col(t, "latency", "number"),
        col(t, "cost", "decimal", { digits: 6 }),
        col(t, "ok", "boolean", { facet: true }),
        col(t, "error", "long", { hidden: true }),
      ],
    },
  },
  ekspor: { view: { kind: "custom", render: (ctx) => ExportView(ctx) } },
  reproduksi: { view: { kind: "custom", render: (ctx) => ReproductionView(ctx) } },
};
