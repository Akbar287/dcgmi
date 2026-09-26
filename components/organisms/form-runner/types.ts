import type { ActionResult } from "@/lib/action-result";
import type { AnswerIssue } from "@/lib/instruments/pre-review/answers";
import type { Answers, PlanItem, SourceData } from "@/lib/instruments/pre-review/types";

export interface RunnerActions {
  saveDraft: (slug: string, answers: Answers, pageIndex: number) => Promise<ActionResult<{ savedAt: string }>>;
  submit: (slug: string, answers: Answers) => Promise<ActionResult<{ issues?: AnswerIssue[] } | null>>;
  decline: (slug: string) => Promise<ActionResult>;
}

export interface RunnerDefinition {
  slug: string;
  title: string;
  description: string;
  expertCode: string;
  plan: PlanItem[];
  options: SourceData["options"];
  indicatorNames: Record<string, string>;
}

export function fieldDomId(key: string): string {
  return `f-${key.replace(/[^a-zA-Z0-9_-]/g, "-")}`;
}
