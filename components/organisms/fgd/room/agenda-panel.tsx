"use client";

import { Cancel01Icon, CheckmarkCircle02Icon, Clock01Icon, Loading03Icon } from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";
import Link from "next/link";

import { cn } from "@/lib/utils";
import { useT } from "@/lib/i18n/client";

import type { RoomStage } from "./types";

const ICON: Record<string, typeof Clock01Icon> = { COMPLETED: CheckmarkCircle02Icon, FAILED: Cancel01Icon, RUNNING: Loading03Icon };

export function AgendaPanel({ sessionId, stages, selectedId }: { sessionId: string; stages: RoomStage[]; selectedId: string | null }) {
  const t = useT();
  return (
    <nav aria-label={t("fgdSim.room.agenda")} className="flex max-h-[70vh] flex-col gap-3 overflow-y-auto pr-1">
      {stages.map((s, i) => (
        <section key={s.key}>
          <h3 className="mb-1 text-xs font-medium tracking-wide text-muted-foreground uppercase">
            {i + 1}. {s.title}
          </h3>
          <ul className="flex flex-col gap-0.5">
            {s.items.map((it) => (
              <li key={it.id}>
                <Link
                  href={`/fgd/ruang/${sessionId}?item=${it.id}`}
                  scroll={false}
                  aria-current={it.id === selectedId ? "true" : undefined}
                  className={cn("flex items-center gap-2 rounded-lg px-2 py-1 text-sm hover:bg-muted", it.id === selectedId && "bg-muted font-medium")}
                >
                  <HugeiconsIcon
                    icon={ICON[it.status] ?? Clock01Icon}
                    strokeWidth={2}
                    aria-hidden="true"
                    className={cn(
                      "size-3.5 shrink-0",
                      it.status === "COMPLETED" && "text-success",
                      it.status === "FAILED" && "text-destructive",
                      it.status === "RUNNING" && "animate-spin text-info motion-reduce:animate-none",
                      it.status === "QUEUED" && "text-muted-foreground",
                    )}
                  />
                  <span className="min-w-0 flex-1 truncate">{it.title}</span>
                  <span className="sr-only">{t.maybe(`enums.${it.status}`) ?? it.status}</span>
                  {it.decision ? <span className="shrink-0 text-[10px] text-muted-foreground">{t.maybe(`enums.${it.decision}`) ?? it.decision}</span> : null}
                </Link>
              </li>
            ))}
          </ul>
        </section>
      ))}
    </nav>
  );
}
