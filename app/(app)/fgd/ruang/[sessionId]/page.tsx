import { notFound } from "next/navigation";
import Link from "next/link";

import { SessionRoom } from "@/components/organisms/fgd/room/session-room";
import type { RoomView } from "@/components/organisms/fgd/room/types";
import { SectionTemplate } from "@/components/templates/section-template";
import { LiveFeed } from "@/components/organisms/live-feed";
import { requirePermission } from "@/lib/auth/session";
import { getSessionRoom } from "@/lib/db/repository/fgd-sessions";
import { getTranslator } from "@/lib/i18n/server";

import { runNextItemAction, sessionControlAction } from "../../fgd-actions";

export default async function FgdRoomPage({ params, searchParams }: PageProps<"/fgd/ruang/[sessionId]">) {
  await requirePermission("simulation:run");
  const { sessionId } = await params;
  const item = (await searchParams).item;
  const t = await getTranslator();
  const data = await getSessionRoom(sessionId, typeof item === "string" ? item : null);
  if (!data) notFound();
  const { session, selected, totals } = data;

  const room: RoomView = {
    sessionId: session.id,
    status: session.status,
    mode: session.mode,
    seed: session.seed,
    versionLabel: session.version.label,
    calls: totals._count,
    tokensIn: totals._sum.tokensIn ?? 0,
    tokensOut: totals._sum.tokensOut ?? 0,
    stages: session.stages.map((s) => ({
      key: s.key,
      title: s.title,
      status: s.status,
      items: s.items.map((i) => ({ id: i.id, title: i.title, status: i.status, decision: i.decision?.decision ?? null })),
    })),
    seats: session.config.seats.map((s) => ({
      seatIndex: s.seatIndex,
      label: s.label,
      field: s.field,
      panelCode: s.expert?.panelCode ?? null,
      model: `${s.modelProfile.provider.label} · ${s.modelProfile.label}`,
    })),
    selected: selected
      ? {
          id: selected.id,
          title: selected.title,
          stageTitle: selected.stage.title,
          status: selected.status,
          error: selected.error,
          utterances: selected.utterances.map((u) => ({
            id: u.id,
            kind: u.kind,
            speaker: u.speaker,
            seatIndex: u.seatIndex,
            content: u.content,
            modelId: u.modelId,
            tokensIn: u.tokensIn,
            tokensOut: u.tokensOut,
            latencyMs: u.latencyMs,
          })),
          positions: selected.positions.map((p) => ({ seatIndex: p.seatIndex, position: p.position, reason: p.reason, proposedAction: p.proposedAction })),
          suggestions: selected.suggestions.map((s) => ({ id: s.id, seatIndex: s.seatIndex, action: s.action, quote: s.quote, rationale: s.rationale })),
          decision: selected.decision
            ? { decision: selected.decision.decision, ruleFired: selected.decision.ruleFired, tally: selected.decision.tally as Record<string, number>, note: selected.decision.note }
            : null,
        }
      : null,
  };

  return (
    <SectionTemplate
      eyebrow={t("nav.modules.fgd")}
      title={t("fgdSim.room.title")}
      actions={
        <Link href="/fgd/ruang" className="text-sm underline underline-offset-4">
          {t("fgdSim.sessions")}
        </Link>
      }
    >
      <LiveFeed refKey={`FgdSession:${session.id}`} />
      <SessionRoom room={room} runAction={runNextItemAction} controlAction={sessionControlAction} />
    </SectionTemplate>
  );
}
