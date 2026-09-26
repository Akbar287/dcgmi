import { listFgdDecisions, listFgdSessions, listFgdSuggestions } from "@/lib/db/repository/fgd";

import { col, type ModuleSections, type SectionNotice } from "./types";

// R1-V1.7 §3.7.3: every FGD result screen states the rules assist, not validate.
const RULE_ASSIST: SectionNotice[] = [{ key: "notices.fgdRuleAssist" }];

export const fgdSections: ModuleSections<"fgd"> = {
  sesi: {
    view: {
      kind: "table",
      scope: "version",
      load: listFgdSessions,
      columns: (t) => [
        col(t, "origin", "origin", { facet: true }),
        col(t, "config"),
        col(t, "agenda", "code"),
        col(t, "mode", "enum"),
        col(t, "status", "status", { facet: true }),
        col(t, "stages", "number"),
        col(t, "startedAt", "date"),
        col(t, "endedAt", "date"),
      ],
    },
  },
  agenda: { view: { kind: "pending", milestone: "M5" } },
  ruang: { notices: RULE_ASSIST, view: { kind: "pending", milestone: "M5" } },
  keputusan: {
    notices: RULE_ASSIST,
    view: {
      kind: "table",
      scope: "version",
      load: listFgdDecisions,
      columns: (t) => [
        col(t, "origin", "origin", { facet: true }),
        col(t, "stage", "text", { facet: true }),
        col(t, "targetType", "text", { hidden: true }),
        col(t, "target", "code"),
        col(t, "decision", "status", { facet: true }),
        col(t, "rule", "code"),
        col(t, "tally"),
        col(t, "note", "long"),
      ],
    },
  },
  revisi: {
    notices: RULE_ASSIST,
    view: {
      kind: "table",
      scope: "version",
      load: listFgdSuggestions,
      columns: (t) => [
        col(t, "origin", "origin", { facet: true }),
        col(t, "target", "code", { facet: true }),
        col(t, "seat"),
        col(t, "action", "enum", { facet: true }),
        col(t, "quote", "long"),
        col(t, "rationale", "long", { hidden: true }),
        col(t, "adopted", "boolean"),
        col(t, "notAdoptedReason", "long"),
      ],
    },
  },
  terapkan: { notices: RULE_ASSIST, view: { kind: "pending", milestone: "M5" } },
};
