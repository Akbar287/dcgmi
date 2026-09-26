import { listModelProfiles, listPanelConfigs, listProviders } from "@/lib/db/repository/panel";

import { GatewayView } from "./fgd-views";
import { ConnectionTestView, SeatEditorView } from "./panel-views";
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
      header: (ctx) => GatewayView(ctx),
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
    permission: "panel:manage",
    view: { kind: "custom", render: () => SeatEditorView() },
  },
  "uji-koneksi": {
    permission: "panel:manage",
    notices: [{ key: "panelAdmin.ping.note" }],
    view: { kind: "custom", render: () => ConnectionTestView() },
  },
};
