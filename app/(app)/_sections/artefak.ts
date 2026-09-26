import {
  listAspects,
  listChangeLog,
  listDomains,
  listEvidence,
  listIndicators,
  listRubricLevels,
  listVersions,
} from "@/lib/db/repository/artifact";

import { col, type ModuleSections } from "./types";

export const artefakSections: ModuleSections<"artefak"> = {
  versi: {
    view: {
      kind: "table",
      scope: "global",
      load: () => listVersions(),
      columns: (t) => [
        col(t, "label", "code"),
        col(t, "status", "status", { facet: true }),
        col(t, "parent", "code"),
        col(t, "domainCount", "number"),
        col(t, "lockedAt", "date"),
        col(t, "createdAt", "date"),
        col(t, "note", "long"),
      ],
    },
  },
  domain: {
    view: {
      kind: "table",
      scope: "version",
      load: listDomains,
      columns: (t) => [
        col(t, "order", "number"),
        col(t, "code", "code"),
        col(t, "name"),
        col(t, "aspectCount", "number"),
        col(t, "indicatorCount", "number"),
        col(t, "note", "long", { hidden: true }),
      ],
    },
  },
  aspek: {
    view: {
      kind: "table",
      scope: "version",
      load: listAspects,
      columns: (t) => [
        col(t, "domain", "code", { facet: true }),
        col(t, "code", "code"),
        col(t, "name"),
        col(t, "indicatorCount", "number"),
        col(t, "note", "long", { hidden: true }),
      ],
    },
  },
  indikator: {
    notices: [{ tone: "warning", key: "notices.controlledException" }],
    view: {
      kind: "table",
      scope: "version",
      load: listIndicators,
      columns: (t) => [
        col(t, "domain", "code", { facet: true }),
        col(t, "aspect", "code", { facet: true }),
        col(t, "code", "code"),
        col(t, "exception", "exception"),
        col(t, "name"),
        col(t, "operationalDefinition", "long", { hidden: true }),
        col(t, "rubricCount", "number"),
        col(t, "evidenceCount", "number"),
      ],
    },
  },
  rubrik: {
    view: {
      kind: "table",
      scope: "version",
      load: listRubricLevels,
      columns: (t) => [
        col(t, "indicator", "code", { facet: true }),
        col(t, "level", "number"),
        col(t, "label"),
        col(t, "descriptor", "long"),
        col(t, "cumulative", "boolean"),
      ],
    },
  },
  bukti: {
    view: {
      kind: "table",
      scope: "version",
      load: listEvidence,
      columns: (t) => [
        col(t, "indicator", "code", { facet: true }),
        col(t, "kind", "enum", { facet: true }),
        col(t, "mandatory", "boolean"),
        col(t, "minimumFor", "number"),
        col(t, "description", "long"),
      ],
    },
  },
  sdgs: {
    view: {
      kind: "table",
      scope: "version",
      load: listDomains,
      columns: (t) => [col(t, "code", "code"), col(t, "name"), col(t, "sdgTags", "tags")],
    },
  },
  "change-log": {
    view: {
      kind: "table",
      scope: "version",
      load: listChangeLog,
      columns: (t) => [
        col(t, "createdAt", "date"),
        col(t, "targetType", "text", { facet: true }),
        col(t, "target", "code"),
        col(t, "action", "enum", { facet: true }),
        col(t, "reason", "long"),
        col(t, "decisionSource"),
        col(t, "impact", "long", { hidden: true }),
      ],
    },
  },
  bandingkan: { view: { kind: "pending", milestone: "M2" } },
};
