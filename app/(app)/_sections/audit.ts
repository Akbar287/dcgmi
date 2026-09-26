import { listAuditEvents, listModelCalls } from "@/lib/db/repository/audit";

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
      load: () => listModelCalls(),
      columns: (t) => [
        col(t, "origin", "origin", { facet: true }),
        col(t, "createdAt", "date"),
        col(t, "speaker"),
        col(t, "model", "code", { facet: true }),
        col(t, "promptHash", "code"),
        col(t, "tokensIn", "number"),
        col(t, "tokensOut", "number"),
        col(t, "latency", "number"),
      ],
    },
  },
  ekspor: { view: { kind: "pending", milestone: "M8" } },
  reproduksi: { view: { kind: "pending", milestone: "M8" } },
};
