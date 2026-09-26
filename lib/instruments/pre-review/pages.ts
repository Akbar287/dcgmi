import type { PlanItem } from "./types";

export interface PlanPage {
  /** The PAGE item that opens this page; null for the intro page before the first break. */
  page: PlanItem | null;
  fields: PlanItem[];
}

/** Groups the flat Google Forms plan into pages at each PAGE break. */
export function toPages(plan: PlanItem[]): PlanPage[] {
  const pages: PlanPage[] = [{ page: null, fields: [] }];
  for (const item of plan) {
    if (item.type === "PAGE") pages.push({ page: item, fields: [] });
    else pages[pages.length - 1].fields.push(item);
  }
  return pages;
}
