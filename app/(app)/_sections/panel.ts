import { listModelProfiles, listPanelConfigs, listPanelSeats, listProviders } from "@/lib/db/repository/panel";

import { col, type ModuleSections } from "./types";

export const panelSections: ModuleSections<"panel"> = {
  provider: {
    notices: [{ key: "notices.apiKeysServerOnly" }],
    view: {
      kind: "table",
      scope: "global",
      load: () => listProviders(),
      columns: (t) => [
        col(t, "key", "code"),
        col(t, "name"),
        col(t, "approved", "boolean"),
        col(t, "enabled", "boolean"),
        col(t, "envStatus", "status"),
        col(t, "models", "number"),
      ],
    },
  },
  model: {
    view: {
      kind: "table",
      scope: "global",
      load: () => listModelProfiles(),
      columns: (t) => [
        col(t, "provider", "text", { facet: true }),
        col(t, "name"),
        col(t, "modelId", "code"),
        col(t, "contextWindow", "number"),
        col(t, "inputCost", "decimal", { digits: 6, hidden: true }),
        col(t, "outputCost", "decimal", { digits: 6, hidden: true }),
      ],
    },
  },
  konfigurasi: {
    view: {
      kind: "table",
      scope: "global",
      load: () => listPanelConfigs(),
      columns: (t) => [
        col(t, "name"),
        col(t, "preset", "code", { facet: true }),
        col(t, "panelSize", "number"),
        col(t, "seats", "number"),
        col(t, "createdAt", "date"),
      ],
    },
  },
  kursi: {
    view: {
      kind: "table",
      scope: "global",
      load: () => listPanelSeats(),
      columns: (t) => [
        col(t, "config", "text", { facet: true }),
        col(t, "seat"),
        col(t, "field", "enum", { facet: true }),
        col(t, "panelCode", "code"),
        col(t, "provider", "text", { facet: true }),
        col(t, "model"),
        col(t, "temperature", "number"),
        col(t, "seed", "number", { hidden: true }),
        col(t, "newMember", "boolean"),
        col(t, "contextScope", "code"),
      ],
    },
  },
  "uji-koneksi": { view: { kind: "pending", milestone: "M4" } },
};
