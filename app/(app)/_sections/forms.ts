import { listFormResponses, listForms } from "@/lib/db/repository/instruments";

import { PreReviewForms } from "./pre-review-forms";
import { col, type ModuleSections } from "./types";

export const formsSections: ModuleSections<"forms"> = {
  formulir: {
    notices: [{ key: "preReview.realNotice" }, { key: "preReview.gateNote" }],
    view: {
      kind: "table",
      scope: "global",
      header: PreReviewForms,
      load: () => listForms(),
      columns: (t) => [
        col(t, "slug", "code"),
        col(t, "title"),
        col(t, "version", "code"),
        col(t, "stageTag", "enum", { facet: true }),
        col(t, "status", "status", { facet: true }),
        col(t, "sections", "number"),
        col(t, "responses", "number"),
        col(t, "createdAt", "date"),
      ],
    },
  },
  builder: { view: { kind: "pending", milestone: "M3" } },
  pratinjau: { view: { kind: "pending", milestone: "M3" } },
  respons: {
    view: {
      kind: "table",
      scope: "global",
      load: () => listFormResponses(),
      columns: (t) => [
        col(t, "origin", "origin", { facet: true }),
        col(t, "slug", "code", { facet: true }),
        col(t, "respondent", "code"),
        col(t, "completed", "boolean"),
        col(t, "submittedAt", "date"),
      ],
    },
  },
  gform: { view: { kind: "pending", milestone: "M3" } },
};
