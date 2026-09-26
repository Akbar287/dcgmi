import { listDelphiItemResults, listDelphiRounds } from "@/lib/db/repository/delphi";

import { col, type ModuleSections } from "./types";

export const delphiSections: ModuleSections<"delphi"> = {
  ronde: {
    view: {
      kind: "table",
      scope: "version",
      load: listDelphiRounds,
      columns: (t) => [
        col(t, "origin", "origin", { facet: true }),
        col(t, "round", "number"),
        col(t, "config"),
        col(t, "panelSize", "number"),
        col(t, "status", "status", { facet: true }),
        col(t, "ratings", "number"),
      ],
    },
  },
  matriks: { notices: [{ key: "notices.delphiDenominator" }], view: { kind: "pending", milestone: "M6" } },
  hasil: {
    notices: [{ key: "notices.delphiDenominator" }],
    view: {
      kind: "table",
      scope: "version",
      load: listDelphiItemResults,
      columns: (t) => [
        col(t, "origin", "origin", { facet: true }),
        col(t, "round", "number", { facet: true }),
        col(t, "indicator", "code"),
        col(t, "iCvi", "fraction", { denominatorId: "validRaters" }),
        col(t, "validRaters", "number", { hidden: true }),
        col(t, "median", "decimal", { digits: 1 }),
        col(t, "iqr", "decimal", { digits: 2 }),
        col(t, "decision", "status", { facet: true }),
        col(t, "reason", "long"),
      ],
    },
  },
  ringkasan: {
    view: {
      kind: "table",
      scope: "version",
      load: listDelphiRounds,
      columns: (t) => [
        col(t, "origin", "origin"),
        col(t, "round", "number"),
        col(t, "panelSize", "number"),
        col(t, "sCviAve", "decimal", { digits: 3 }),
        col(t, "status", "status"),
      ],
    },
  },
  "umpan-balik": { view: { kind: "pending", milestone: "M6" } },
};
