"use client";

import { StatusBadge } from "@/components/atoms/status-badge";
import { Notice } from "@/components/molecules/notice";
import { useT } from "@/lib/i18n/client";

import type { RoomSelected } from "./types";

export function DecisionPanel({ selected }: { selected: RoomSelected | null }) {
  const t = useT();
  const d = selected?.decision;
  return (
    <section className="flex flex-col gap-3" aria-label={t("fgdSim.room.decision")}>
      {/* R1-V1.7 §3.7.3: shown on every FGD result screen. */}
      <Notice>{t("notices.fgdRuleAssist")}</Notice>
      {d ? (
        <div className="grid gap-4 md:grid-cols-2">
          <div className="flex flex-col gap-1.5">
            <StatusBadge value={d.decision} label={t.maybe(`enums.${d.decision}`) ?? d.decision} className="self-start" />
            <p className="text-sm tabular-nums">
              {t("fgdSim.room.tally", {
                TERIMA: d.tally.TERIMA ?? 0,
                TERIMA_DENGAN_REVISI: d.tally.TERIMA_DENGAN_REVISI ?? 0,
                TOLAK: d.tally.TOLAK ?? 0,
                total: d.tally.total ?? 0,
              })}
            </p>
            <p className="font-mono text-xs text-muted-foreground">{t("fgdSim.room.rule", { rule: d.ruleFired })}</p>
            {d.note ? <p className="text-xs text-muted-foreground">{d.note}</p> : null}
          </div>
          <div>
            <h4 className="mb-1 text-sm font-medium">{t("fgdSim.room.suggestions")}</h4>
            {selected!.suggestions.length === 0 ? (
              <p className="text-sm text-muted-foreground">{t("fgdSim.room.noSuggestions")}</p>
            ) : (
              <ul className="flex flex-col gap-1 text-sm">
                {selected!.suggestions.map((s) => (
                  <li key={s.id}>
                    <span className="font-medium">
                      Pakar {s.seatIndex} · {t.maybe(`enums.${s.action}`) ?? s.action}
                    </span>
                    : “{s.quote}”
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      ) : null}
    </section>
  );
}
