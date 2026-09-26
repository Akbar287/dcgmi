import { getTranslator } from "@/lib/i18n/server";
import { cn } from "@/lib/utils";

export interface MatrixItem {
  code: string;
  ratings: { seatIndex: number; relevance: number | null; clarityFlag: boolean; reason: string | null; error: string | null }[];
}

// Sequential single-hue steps (magnitude); the number is always printed, so the
// score is never carried by color alone.
const STEP: Record<number, string> = {
  1: "bg-muted text-foreground",
  2: "bg-primary/15 text-foreground",
  3: "bg-primary/40 text-foreground",
  4: "bg-primary/70 text-primary-foreground",
};

export async function RatingMatrix({ seats, items }: { seats: { seatIndex: number; label: string; isNewMember: boolean }[]; items: MatrixItem[] }) {
  const t = await getTranslator();
  return (
    <div className="flex flex-col gap-2">
      <p className="text-xs text-muted-foreground">{t("delphiSim.matrixLegend")}</p>
      <div className="overflow-x-auto rounded-2xl border">
        <table className="w-full border-separate border-spacing-0.5 p-1 text-sm">
          <thead>
            <tr>
              <th className="px-2 py-1 text-left text-xs font-medium">{t("columns.indicator")}</th>
              {seats.map((s) => (
                <th key={s.seatIndex} scope="col" className="px-1 py-1 text-center text-xs font-medium" title={s.label}>
                  {s.seatIndex}
                  {s.isNewMember ? "*" : ""}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {items.map((item) => (
              <tr key={item.code}>
                <th scope="row" className="px-2 py-0.5 text-left font-mono text-xs font-normal">
                  {item.code}
                </th>
                {seats.map((s) => {
                  const r = item.ratings.find((x) => x.seatIndex === s.seatIndex);
                  const v = r?.relevance ?? null;
                  return (
                    <td
                      key={s.seatIndex}
                      title={r?.error ?? r?.reason ?? ""}
                      className={cn("h-7 min-w-8 rounded-md text-center text-xs tabular-nums", v ? STEP[v] : "bg-background text-muted-foreground")}
                    >
                      {r?.error ? "!" : (v ?? "·")}
                      {r?.clarityFlag ? <span aria-label={t("delphiSim.review.flags", { n: 1 })}>•</span> : null}
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="text-xs text-muted-foreground">* {t("delphiSim.room.newMember")}</p>
    </div>
  );
}
