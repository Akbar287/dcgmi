import { listExpertCoi, listExperts, listPersonaBriefs } from "@/lib/db/repository/experts";
import { listPanelistIdentities } from "@/lib/db/repository/identity";

import { col, type ModuleSections } from "./types";

export const expertsSections: ModuleSections<"experts"> = {
  registry: {
    notices: [{ key: "notices.personaEthics" }],
    view: {
      kind: "table",
      scope: "global",
      load: () => listExperts(),
      columns: (t) => [
        col(t, "panelCode", "code"),
        col(t, "name", "text", { hidden: true }),
        col(t, "field", "enum", { facet: true }),
        col(t, "affiliation", "text", { hidden: true }),
        col(t, "participation", "tags"),
        col(t, "coi", "boolean"),
        col(t, "hasCv", "boolean"),
        col(t, "persona", "status"),
      ],
    },
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
    notices: [{ key: "notices.personaEthics" }],
    view: {
      kind: "table",
      scope: "global",
      load: () => listPersonaBriefs(),
      columns: (t) => [
        col(t, "panelCode", "code"),
        col(t, "field", "enum", { facet: true }),
        col(t, "expertise", "tags"),
        col(t, "years", "number"),
        col(t, "status", "status", { facet: true }),
        col(t, "promptVersion", "code"),
        col(t, "approvedAt", "date"),
      ],
    },
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
    notices: [{ tone: "locked", key: "restricted.ownerBody" }],
    view: {
      kind: "table",
      scope: "global",
      load: () => listPanelistIdentities(),
      columns: (t) => [
        col(t, "panelCode", "code"),
        col(t, "fullName"),
        col(t, "email"),
        col(t, "institution"),
        col(t, "note", "long", { hidden: true }),
      ],
    },
  },
};
