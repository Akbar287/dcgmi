import { listExpertCoi, listExperts } from "@/lib/db/repository/experts";

import { ExpertRegistryView, IdentityView, PersonaListView } from "./panel-views";

import { col, type ModuleSections } from "./types";

export const expertsSections: ModuleSections<"experts"> = {
  registry: {
    permission: "panel:manage",
    notices: [{ key: "notices.personaEthics" }],
    view: { kind: "custom", render: () => ExpertRegistryView() },
  },
  cv: {
    notices: [{ key: "notices.personaEthics" }],
    view: {
      kind: "table",
      scope: "global",
      load: () => listExperts(),
      columns: (t) => [col(t, "panelCode", "code"), col(t, "field", "enum", { facet: true }), col(t, "hasCv", "boolean")],
    },
  },
  persona: {
    notices: [{ key: "notices.personaEthics" }, { key: "panelAdmin.persona.manualNote" }],
    view: { kind: "custom", render: (ctx) => PersonaListView(ctx) },
  },
  coi: {
    view: {
      kind: "table",
      scope: "global",
      load: () => listExpertCoi(),
      columns: (t) => [
        col(t, "panelCode", "code"),
        col(t, "field", "enum", { facet: true }),
        col(t, "coi", "boolean"),
        col(t, "coiNote", "long"),
      ],
    },
  },
  // Admin-only (R1-V1.7 §3.13.2). The permission check runs before `load`, so
  // other roles never query the table.
  identitas: {
    permission: "identity:read",
    notices: [{ tone: "locked", key: "restricted.ownerBody" }, { key: "panelAdmin.identity.usedForDeid" }],
    view: { kind: "custom", render: () => IdentityView() },
  },
};
