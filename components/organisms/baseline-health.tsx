import { Alert02Icon, CheckmarkCircle02Icon } from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";

import { StatCard } from "@/components/molecules/stat-card";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { getTranslator } from "@/lib/i18n/server";
import { METHOD } from "@/lib/method/constants";
import type { ArtifactSnapshot } from "@/lib/method/gates";
import { cn } from "@/lib/utils";

// Structure counts of the stored artifact. These are definitions, not results,
// so they may be shown without an origin label.
export async function BaselineHealth({ snapshot }: { snapshot: ArtifactSnapshot }) {
  const t = await getTranslator();
  const aspects = snapshot.domains.flatMap((d) => d.aspects);
  const indicatorCount = aspects.reduce((n, a) => n + a.indicators.length, 0);
  const distribution = snapshot.domains.map((d) => ({
    code: d.code,
    count: d.aspects.reduce((n, a) => n + a.indicators.length, 0),
  }));
  const expected = METHOD.BASELINE_DISTRIBUTION;
  const matches = distribution.map((d) => d.count).join(",") === expected.join(",");
  const max = Math.max(1, ...distribution.map((d) => d.count), ...expected);

  const counts = [
    { label: t("dashboard.domains"), value: snapshot.domains.length, baseline: METHOD.BASELINE_DOMAIN_COUNT },
    { label: t("dashboard.aspects"), value: aspects.length, baseline: METHOD.BASELINE_ASPECT_COUNT },
    { label: t("dashboard.indicators"), value: indicatorCount, baseline: METHOD.BASELINE_INDICATOR_COUNT },
  ];

  return (
    <section aria-labelledby="baseline-health" className="flex flex-col gap-4">
      <h2 id="baseline-health" className="font-heading text-lg font-medium">
        {t("dashboard.structure")}
      </h2>
      <div className="grid gap-4 sm:grid-cols-3">
        {counts.map((c) => (
          <StatCard
            key={c.label}
            label={c.label}
            value={c.value}
            hint={t("dashboard.baselineExpected", { n: c.baseline })}
            status={
              <HugeiconsIcon
                icon={c.value === c.baseline ? CheckmarkCircle02Icon : Alert02Icon}
                strokeWidth={2}
                aria-hidden="true"
                className={cn("size-4", c.value === c.baseline ? "text-success" : "text-warning")}
              />
            }
          />
        ))}
      </div>
      <Card>
        <CardHeader>
          <CardTitle>{t("dashboard.distribution")}</CardTitle>
          <CardDescription className="flex items-center gap-1.5">
            <HugeiconsIcon
              icon={matches ? CheckmarkCircle02Icon : Alert02Icon}
              strokeWidth={2}
              aria-hidden="true"
              className={cn("size-4", matches ? "text-success" : "text-warning")}
            />
            {matches ? t("dashboard.distributionMatch") : t("dashboard.distributionMismatch")} ·{" "}
            {t("dashboard.distributionExpected", { expected: expected.join("–") })}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <ul className="flex flex-col gap-2">
            {distribution.map((d, i) => {
              const target = expected[i];
              const off = target !== d.count;
              return (
                <li key={d.code} className="grid grid-cols-[4rem_1fr_5rem] items-center gap-3 text-sm">
                  <span className="font-mono text-xs">{d.code}</span>
                  <span className="relative h-2.5 rounded-full bg-muted" aria-hidden="true">
                    <span
                      className={cn("absolute inset-y-0 left-0 rounded-full", off ? "bg-warning" : "bg-primary")}
                      style={{ width: `${(d.count / max) * 100}%` }}
                    />
                    {target !== undefined ? (
                      <span
                        className="absolute inset-y-[-3px] w-0.5 rounded bg-foreground/60"
                        style={{ left: `${(target / max) * 100}%` }}
                      />
                    ) : null}
                  </span>
                  <span className={cn("text-right tabular-nums", off && "font-medium text-warning")}>
                    {d.count}
                    {target !== undefined ? <span className="text-muted-foreground"> / {target}</span> : null}
                    {off ? <span className="sr-only"> ({t("dashboard.distributionMismatch")})</span> : null}
                  </span>
                </li>
              );
            })}
          </ul>
        </CardContent>
      </Card>
    </section>
  );
}
