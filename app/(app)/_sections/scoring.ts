import { listAssessments, listIndicatorScores } from "@/lib/db/repository/scoring";
import type { Translator } from "@/lib/i18n";

import { AssessmentHeaderView, CalculatorView, ProfileSectionView } from "./scoring-views";
import { col, type ModuleSections } from "./types";

const scoreColumns = (t: Translator) => [
  col(t, "origin", "origin", { facet: true }),
  col(t, "institution", "text", { facet: true }),
  col(t, "indicator", "code"),
  col(t, "level", "number"),
  col(t, "missingKind", "status", { facet: true }),
  col(t, "evidenceLocator", "long"),
  col(t, "rationale", "long", { hidden: true }),
];

export const scoringSections: ModuleSections<"scoring"> = {
  asesmen: {
    notices: [{ key: "notices.scoringProvisional" }],
    view: {
      kind: "table",
      scope: "version",
      load: listAssessments,
      header: (ctx) => AssessmentHeaderView(ctx),
      columns: (t) => [
        col(t, "origin", "origin", { facet: true }),
        col(t, "institution"),
        col(t, "assessor", "code"),
        col(t, "status", "status", { facet: true }),
        col(t, "scores", "number"),
        col(t, "createdAt", "date"),
        col(t, "action", "link", { hrefBase: "/scoring/asesmen/", linkText: t("scoringSim.openAssessment") }),
      ],
    },
  },
  bukti: {
    view: { kind: "table", scope: "version", load: (v) => listIndicatorScores(v, "evidence"), columns: scoreColumns },
  },
  skor: {
    notices: [{ key: "notices.missingNoImputation" }],
    view: { kind: "table", scope: "version", load: (v) => listIndicatorScores(v), columns: scoreColumns },
  },
  "data-hilang": {
    notices: [{ key: "notices.missingNoImputation" }],
    view: { kind: "table", scope: "version", load: (v) => listIndicatorScores(v, "missing"), columns: scoreColumns },
  },
  profil: { notices: [{ key: "notices.scoringProvisional" }], view: { kind: "custom", render: (ctx) => ProfileSectionView(ctx) } },
  kalkulator: { notices: [{ key: "notices.scoringProvisional" }], view: { kind: "custom", render: (ctx) => CalculatorView(ctx) } },
};
