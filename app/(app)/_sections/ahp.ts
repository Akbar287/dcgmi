import {
  listAhpMatrices,
  listAhpSessions,
  listAhpWeights,
  listSensitivityScenarios,
} from "@/lib/db/repository/ahp";
import { METHOD } from "@/lib/method/constants";

import { AhpConfigView } from "./ahp-views";
import { col, type ModuleSections } from "./types";
import type { Translator } from "@/lib/i18n";

const matrixColumns = (t: Translator) => [
  col(t, "origin", "origin", { facet: true }),
  col(t, "level", "code", { facet: true }),
  col(t, "parent", "code"),
  col(t, "seat"),
  col(t, "attempt", "number"),
  col(t, "size", "number"),
  col(t, "lambdaMax", "decimal", { digits: 4 }),
  col(t, "ci", "decimal", { digits: 4 }),
  col(t, "cr", "decimal", { digits: 4 }),
  col(t, "status", "status", { facet: true }),
];

export const ahpSections: ModuleSections<"ahp"> = {
  konfigurasi: {
    view: {
      kind: "table",
      scope: "version",
      load: listAhpSessions,
      header: (ctx) => AhpConfigView(ctx),
      columns: (t) => [
        col(t, "origin", "origin", { facet: true }),
        col(t, "createdAt", "date"),
        col(t, "config"),
        col(t, "scope", "code"),
        col(t, "aggregation", "code"),
        col(t, "status", "status"),
        col(t, "matrices", "number"),
        col(t, "action", "link", { hrefBase: "/ahp/sesi/", linkText: t("ahpSim.openSession") }),
      ],
    },
  },
  pairwise: {
    view: { kind: "table", scope: "version", load: (v) => listAhpMatrices(v), columns: matrixColumns },
  },
  bobot: {
    view: {
      kind: "table",
      scope: "version",
      load: listAhpWeights,
      columns: (t) => [
        col(t, "origin", "origin", { facet: true }),
        col(t, "level", "code", { facet: true }),
        col(t, "parent", "code"),
        col(t, "target", "code"),
        col(t, "seat"),
        col(t, "weight", "decimal", { digits: 4 }),
        col(t, "archived", "boolean"),
      ],
    },
  },
  sensitivitas: {
    view: {
      kind: "table",
      scope: "version",
      load: listSensitivityScenarios,
      columns: (t) => [col(t, "origin", "origin"), col(t, "name"), col(t, "rankChanged", "boolean")],
    },
  },
  dikembalikan: {
    notices: [{ tone: "warning", key: "notices.ahpReturned", vars: { crMax: METHOD.CR_MAX } }],
    view: { kind: "table", scope: "version", load: (v) => listAhpMatrices(v, true), columns: matrixColumns },
  },
};
