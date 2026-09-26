"use client";

import { ArrowRight01Icon } from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";
import { Fragment, useState } from "react";

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { useT } from "@/lib/i18n/client";

import { StageDetail } from "./stage-detail";
import { StageNode } from "./stage-node";
import type { StageView } from "./types";

export function ProcessFlow({ stages }: { stages: StageView[] }) {
  const t = useT();
  const current = Math.max(0, stages.findIndex((s) => s.status === "CURRENT"));
  const [selected, setSelected] = useState(current);
  const following = stages[selected + 1];

  return (
    <Card>
      <CardHeader>
        <CardTitle>{t("process.title")}</CardTitle>
        <CardDescription>{t("process.description")}</CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-5">
        {/* The flow scrolls inside its own container on narrow screens (docs/06 §5). */}
        <ol aria-label={t("process.flowLabel")} className="flex items-stretch overflow-x-auto pb-2">
          {stages.map((s, i) => (
            <Fragment key={s.key}>
              <li className="flex flex-1">
                <StageNode stage={s} index={i} selected={i === selected} isNext={i === current + 1} onSelect={() => setSelected(i)} />
              </li>
              {i < stages.length - 1 ? (
                <li aria-hidden="true" className="flex shrink-0 flex-col items-center justify-center px-1 text-muted-foreground">
                  <span className="font-mono text-[10px]">{s.gateLabel}</span>
                  <HugeiconsIcon icon={ArrowRight01Icon} strokeWidth={2} className="size-4" />
                </li>
              ) : null}
            </Fragment>
          ))}
        </ol>
        <div className="grid gap-4 xl:grid-cols-2">
          <StageDetail stage={stages[selected]} label={selected === current ? t("process.current") : t("process.selected")} />
          {following ? <StageDetail stage={following} label={t("process.next")} /> : null}
        </div>
      </CardContent>
    </Card>
  );
}
