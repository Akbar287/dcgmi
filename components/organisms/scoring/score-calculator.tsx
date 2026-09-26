"use client";

import { useMemo, useState } from "react";

import { Notice } from "@/components/molecules/notice";
import { Button } from "@/components/ui/button";
import { NativeSelect, NativeSelectOption } from "@/components/ui/native-select";
import { useT } from "@/lib/i18n/client";
import { computeIndex, uniformLocalWeights } from "@/lib/method/scoring";
import type { DomainScoreInput } from "@/lib/method/types";

import { DomainProfile } from "./domain-profile";

export interface CalcDomain {
  code: string;
  name: string;
  aspects: { code: string; name: string; indicators: { code: string; name: string }[] }[];
}

type Choice = "1" | "2" | "3" | "4" | "5" | "NK" | "MA";
const CHOICES: Choice[] = ["1", "2", "3", "4", "5", "NK", "MA"];

/**
 * What-if calculator (SPECIFICATION §4.8): the same lib/method computeIndex
 * the assessments use, in the browser. Nothing is stored. NK = TIDAK_ADA_KAPABILITAS
 * at level 1; MA = MISSING_ADMINISTRATIF (holds the aspect, domain, composite).
 */
export function ScoreCalculator({
  domains,
  weights,
}: {
  domains: CalcDomain[];
  weights: { sessionLabel: string; domain: Record<string, number>; aspect: Record<string, Record<string, number>> } | null;
}) {
  const t = useT();
  const all = domains.flatMap((d) => d.aspects.flatMap((a) => a.indicators.map((i) => i.code)));
  const [choice, setChoice] = useState<Record<string, Choice>>({});
  const get = (code: string): Choice => choice[code] ?? "3";

  const { result, error } = useMemo(() => {
    const uniformDomain = uniformLocalWeights(domains.length);
    const input: DomainScoreInput[] = domains.map((d, di) => {
      const uniformAspect = uniformLocalWeights(d.aspects.length);
      return {
        domainCode: d.code,
        weight: weights ? (weights.domain[d.code] ?? NaN) : uniformDomain[di],
        aspects: d.aspects.map((a, ai) => ({
          aspectCode: a.code,
          localWeight: d.aspects.length === 1 ? 1 : weights ? (weights.aspect[d.code]?.[a.code] ?? NaN) : uniformAspect[ai],
          indicators: a.indicators.map((i) => {
            const c = choice[i.code] ?? "3";
            return c === "MA"
              ? { indicatorCode: i.code, level: null, missingKind: "MISSING_ADMINISTRATIF" as const }
              : c === "NK"
                ? { indicatorCode: i.code, level: 1, missingKind: "TIDAK_ADA_KAPABILITAS" as const }
                : { indicatorCode: i.code, level: Number(c), missingKind: "NONE" as const };
          }),
        })),
      };
    });
    try {
      return { result: computeIndex(input), error: null };
    } catch (e) {
      return { result: null, error: e instanceof Error ? e.message : String(e) };
    }
  }, [choice, domains, weights]);

  const label = (c: Choice) => (c === "NK" ? "1 · TIDAK_ADA_KAPABILITAS" : c === "MA" ? "MISSING_ADMINISTRATIF" : c);

  return (
    <div className="flex flex-col gap-4">
      <Notice tone={weights ? "info" : "warning"}>{weights ? t("scoringSim.weightsG5", { session: weights.sessionLabel }) : t("scoringSim.weightsUniform")}</Notice>
      <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
        <div className="flex flex-col gap-3">
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-sm">{t("scoringSim.allLevel")}</span>
            {CHOICES.slice(0, 5).map((c) => (
              <Button key={c} size="sm" variant="outline" onClick={() => setChoice(Object.fromEntries(all.map((code) => [code, c])))}>
                {c}
              </Button>
            ))}
            <Button size="sm" variant="ghost" onClick={() => setChoice({})}>
              {t("scoringSim.reset")}
            </Button>
          </div>
          {domains.map((d) => (
            <fieldset key={d.code} className="rounded-xl border p-3">
              <legend className="px-1 text-sm font-medium">
                {d.code} {d.name}
              </legend>
              {d.aspects.map((a) => (
                <div key={a.code} className="mt-2">
                  <p className="text-xs text-muted-foreground">
                    {a.code} {a.name}
                  </p>
                  <div className="mt-1 grid gap-1.5 sm:grid-cols-2">
                    {a.indicators.map((i) => (
                      <label key={i.code} className="flex items-center justify-between gap-2 text-xs">
                        <span className="truncate" title={i.name}>
                          <span className="font-mono">{i.code}</span> {i.name}
                        </span>
                        <NativeSelect size="sm" value={get(i.code)} onChange={(e) => setChoice((x) => ({ ...x, [i.code]: e.target.value as Choice }))} aria-label={`${i.code} level`}>
                          {CHOICES.map((c) => (
                            <NativeSelectOption key={c} value={c}>
                              {label(c)}
                            </NativeSelectOption>
                          ))}
                        </NativeSelect>
                      </label>
                    ))}
                  </div>
                </div>
              ))}
            </fieldset>
          ))}
        </div>
        <div className="xl:sticky xl:top-20 xl:self-start">
          {result ? <DomainProfile result={result} domains={domains} /> : <Notice tone="warning">{error}</Notice>}
        </div>
      </div>
    </div>
  );
}
