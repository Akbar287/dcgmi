"use client";

import { StatusBadge } from "@/components/atoms/status-badge";
import { useT } from "@/lib/i18n/client";

import type { RoomSeat, RoomSelected } from "./types";

export function SeatPanel({ seats, selected }: { seats: RoomSeat[]; selected: RoomSelected | null }) {
  const t = useT();
  return (
    <ul className="flex flex-col gap-2" aria-label={t("fgdSim.room.seats")}>
      {seats.map((s) => {
        const p = selected?.positions.find((x) => x.seatIndex === s.seatIndex);
        return (
          <li key={s.seatIndex} className="rounded-xl border p-3">
            <div className="flex items-start justify-between gap-2">
              <div className="min-w-0">
                <p className="text-sm font-medium">
                  {s.label} {s.panelCode ? <span className="font-mono text-xs text-muted-foreground">· {s.panelCode}</span> : null}
                </p>
                <p className="truncate text-xs text-muted-foreground">
                  {t.maybe(`enums.${s.field}`) ?? s.field} · {s.model}
                </p>
              </div>
              {p ? (
                <StatusBadge value={p.position} label={t.maybe(`enums.${p.position}`) ?? p.position} />
              ) : (
                <span className="text-xs text-muted-foreground">{t("fgdSim.room.waiting")}</span>
              )}
            </div>
            {p ? (
              <p className="mt-2 text-xs text-muted-foreground">
                {p.reason}
                {p.proposedAction ? ` · ${t.maybe(`enums.${p.proposedAction}`) ?? p.proposedAction}` : null}
              </p>
            ) : null}
          </li>
        );
      })}
    </ul>
  );
}
