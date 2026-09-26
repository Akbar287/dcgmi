"use client";

import { useState } from "react";

import { Field, FieldLabel } from "@/components/ui/field";
import { NativeSelect, NativeSelectOption } from "@/components/ui/native-select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { formatNumber } from "@/lib/format";
import { useT } from "@/lib/i18n/client";

export interface FeedbackItem {
  code: string;
  name: string;
  perSeat: { seatIndex: number; own: number | null; median: number; iqr: number; distribution: number[] }[] | null;
}

/** What one seat receives before the next round — anonymous group statistics only (docs/04 §7). */
export function FeedbackView({ seats, items }: { seats: number[]; items: FeedbackItem[] }) {
  const t = useT();
  const [seat, setSeat] = useState(seats[0] ?? 1);
  return (
    <div className="flex flex-col gap-3">
      <Field className="w-auto">
        <FieldLabel htmlFor="fb-seat">{t("delphiSim.feedback.seat")}</FieldLabel>
        <NativeSelect id="fb-seat" value={String(seat)} onChange={(e) => setSeat(Number(e.target.value))}>
          {seats.map((s) => (
            <NativeSelectOption key={s} value={String(s)}>
              {t("delphiSim.feedback.seat")} {s}
            </NativeSelectOption>
          ))}
        </NativeSelect>
      </Field>
      <div className="overflow-x-auto rounded-2xl border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>{t("columns.indicator")}</TableHead>
              <TableHead>{t("delphiSim.feedback.own")}</TableHead>
              <TableHead>{t("columns.median")}</TableHead>
              <TableHead>{t("columns.iqr")}</TableHead>
              <TableHead>{t("delphiSim.feedback.distribution")}</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {items.map((item) => {
              const f = item.perSeat?.find((p) => p.seatIndex === seat);
              const max = f ? Math.max(1, ...f.distribution) : 1;
              return (
                <TableRow key={item.code}>
                  <TableCell>
                    <span className="font-mono text-xs">{item.code}</span> <span className="text-xs text-muted-foreground">{item.name}</span>
                  </TableCell>
                  {f ? (
                    <>
                      <TableCell className="tabular-nums">{f.own ?? "—"}</TableCell>
                      <TableCell className="tabular-nums">{formatNumber(f.median, t.locale, 1)}</TableCell>
                      <TableCell className="tabular-nums">{formatNumber(f.iqr, t.locale, 2)}</TableCell>
                      <TableCell>
                        <div className="flex items-end gap-1" role="img" aria-label={f.distribution.map((n, i) => `${i + 1}: ${n}`).join(", ")}>
                          {f.distribution.map((n, i) => (
                            <div key={i} className="flex w-6 flex-col items-center gap-0.5">
                              <span className="text-[10px] tabular-nums text-muted-foreground">{n}</span>
                              <div
                                className={i + 1 === f.own ? "w-4 rounded-t-sm bg-primary" : "w-4 rounded-t-sm bg-primary/35"}
                                style={{ height: `${Math.max(2, (n / max) * 28)}px` }}
                              />
                              <span className="text-[10px] tabular-nums">{i + 1}</span>
                            </div>
                          ))}
                        </div>
                      </TableCell>
                    </>
                  ) : (
                    <TableCell colSpan={4} className="text-muted-foreground">
                      {t("delphiSim.feedback.incomplete")}
                    </TableCell>
                  )}
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
