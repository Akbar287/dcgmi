import { isPreReviewSettings, parseSnapshot } from "@/lib/instruments/pre-review/snapshot";

import { db } from "../client";

export interface FgdPrerequisites {
  panelSeats: number | null;
  personasApproved: number;
  providersReady: number;
  mockAi: boolean;
  preReview: { submitted: number; total: number; status: string } | null;
}

/** Facts the FGD stage needs before it can run, read from stored data only. */
export async function getFgdPrerequisites(): Promise<FgdPrerequisites> {
  const prisma = await db();
  const [panel, form] = await Promise.all([
    prisma.panelConfig.findFirst({
      where: { preset: "FGD_6" },
      orderBy: { createdAt: "desc" },
      include: {
        seats: {
          include: {
            expert: { select: { persona: { select: { status: true } } } },
            modelProfile: { select: { provider: { select: { envKeyName: true } } } },
          },
        },
      },
    }),
    prisma.form.findFirst({
      where: { settings: { path: ["kind"], equals: "PRE_REVIEW" } },
      orderBy: { createdAt: "desc" },
      include: { responses: { where: { completed: true, respondentRef: { not: null } }, select: { id: true } } },
    }),
  ]);
  const seats = panel?.seats ?? [];
  return {
    panelSeats: panel ? seats.length : null,
    personasApproved: seats.filter((s) => s.expert?.persona?.status === "APPROVED").length,
    // Presence only; key values never leave the server.
    providersReady: seats.filter((s) => Boolean(process.env[s.modelProfile.provider.envKeyName])).length,
    mockAi: process.env.MOCK_AI === "1",
    preReview:
      form && isPreReviewSettings(form.settings)
        ? { submitted: form.responses.length, total: parseSnapshot(form.settings).data.experts.length, status: form.status }
        : null,
  };
}
