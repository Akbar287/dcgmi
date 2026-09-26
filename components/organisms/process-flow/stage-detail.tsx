"use client";

import { Alert02Icon, CheckmarkCircle02Icon, InformationCircleIcon } from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";
import Link from "next/link";

import { StatusBadge } from "@/components/atoms/status-badge";
import { cn } from "@/lib/utils";
import { useT } from "@/lib/i18n/client";

import type { StageCheck, StageView } from "./types";

const TONE = { DONE: "success", CURRENT: "info", UPCOMING: "neutral" } as const;

function Block({ title, items }: { title: string; items: string[] }) {
  return (
    <section className="flex flex-col gap-2">
      <h4 className="text-xs font-medium tracking-wide text-muted-foreground uppercase">{title}</h4>
      <ul className="flex list-disc flex-col gap-1.5 pl-4 text-sm">
        {items.map((i) => (
          <li key={i}>{i}</li>
        ))}
      </ul>
    </section>
  );
}

function Check({ check }: { check: StageCheck }) {
  const icon = check.ok === true ? CheckmarkCircle02Icon : check.ok === false ? Alert02Icon : InformationCircleIcon;
  return (
    <li className="flex items-start gap-2 text-sm">
      <HugeiconsIcon
        icon={icon}
        strokeWidth={2}
        aria-hidden="true"
        className={cn(
          "mt-0.5 size-4 shrink-0",
          check.ok === true && "text-success",
          check.ok === false && "text-warning",
          check.ok === null && "text-info",
        )}
      />
      <span className={cn(check.code && "font-mono text-xs break-all")}>{check.text}</span>
    </li>
  );
}

export function StageDetail({ stage, label }: { stage: StageView; label: string }) {
  const t = useT();
  return (
    <article className="flex flex-col gap-4 rounded-2xl border p-4" aria-label={`${label}: ${stage.title}`}>
      <header className="flex flex-wrap items-center gap-2">
        <span className="text-xs text-muted-foreground">{label}</span>
        <h3 className="font-heading text-base font-semibold">
          {stage.title} <span className="font-normal text-muted-foreground">· {stage.version}</span>
        </h3>
        <StatusBadge value={stage.status} tone={TONE[stage.status]} label={`${stage.gateLabel} · ${stage.gateStatusLabel}`} />
        {stage.href ? (
          <Link href={stage.href} className="ml-auto text-sm underline underline-offset-4">
            {t("process.open")}
          </Link>
        ) : null}
      </header>
      <div className="grid gap-4 md:grid-cols-3">
        <Block title={t("process.inputs")} items={stage.inputs} />
        <Block title={t("process.gate", { gate: stage.gateLabel })} items={stage.gateConditions} />
        <Block title={t("process.outputs")} items={stage.outputs} />
      </div>
      <section className="flex flex-col gap-2 rounded-xl bg-muted/40 p-3">
        <h4 className="text-xs font-medium tracking-wide text-muted-foreground uppercase">{t("process.missing")}</h4>
        {stage.passedNote ? (
          <p className="text-sm">{stage.passedNote}</p>
        ) : stage.missing.length === 0 ? (
          <p className="text-sm">{t("process.nothingMissing")}</p>
        ) : (
          <ul className="flex flex-col gap-1.5">
            {stage.missing.map((c) => (
              <Check key={c.text} check={c} />
            ))}
          </ul>
        )}
      </section>
    </article>
  );
}
