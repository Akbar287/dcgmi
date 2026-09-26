import { PreReviewFormCard } from "@/components/organisms/pre-review-form-card";
import { can } from "@/lib/auth/roles";
import { getReadiness, listPreReviewForms } from "@/lib/db/repository/pre-review";

import { toggleFormAction } from "../forms/form-actions";
import type { SectionContext } from "./types";

export async function PreReviewForms({ user }: SectionContext) {
  const forms = await listPreReviewForms();
  const readiness = await Promise.all(forms.map((f) => getReadiness(f.id)));
  return (
    <div className="flex flex-col gap-4">
      {forms.map((f, i) => (
        <PreReviewFormCard
          key={f.id}
          form={f}
          issues={[...readiness[i].contentIssues, ...readiness[i].readinessIssues]}
          canManage={can(user.role, "instrument:manage")}
          toggleAction={toggleFormAction}
        />
      ))}
    </div>
  );
}
