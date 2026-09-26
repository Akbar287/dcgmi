"use client";

import { useRouter } from "next/navigation";
import { useCallback, useMemo, useRef, useState } from "react";

import { AutosaveIndicator } from "@/components/molecules/autosave-indicator";
import { Notice } from "@/components/molecules/notice";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { formatDateTime } from "@/lib/format";
import {
  CONSENT_KEY,
  CONSENT_NO,
  CONSENT_YES,
  EXPERT_KEY,
  validatePage,
  type AnswerIssue,
} from "@/lib/instruments/pre-review/answers";
import { toPages } from "@/lib/instruments/pre-review/pages";
import type { Answers } from "@/lib/instruments/pre-review/types";
import { useT } from "@/lib/i18n/client";

import { RunnerPage } from "./runner-page";
import { fieldDomId, type RunnerActions, type RunnerDefinition } from "./types";
import { useAutosave } from "./use-autosave";

type Phase = "filling" | "submitting" | "declined";

export function FormRunner({
  definition,
  initialAnswers,
  initialPage,
  actions,
}: {
  definition: RunnerDefinition;
  initialAnswers: Answers;
  initialPage: number;
  actions: RunnerActions;
}) {
  const t = useT();
  const router = useRouter();
  const pages = useMemo(() => toPages(definition.plan), [definition.plan]);
  const pageOfKey = useMemo(() => {
    const map = new Map<string, number>();
    pages.forEach((p, i) => p.fields.forEach((f) => map.set(f.key, i)));
    return map;
  }, [pages]);

  const [answers, setAnswers] = useState<Answers>({ ...initialAnswers, [EXPERT_KEY]: definition.expertCode });
  // Latest answers without waiting for a re-render, so back-to-back changes never overwrite each other.
  const latest = useRef(answers);
  const [pageIndex, setPageIndex] = useState(Math.min(Math.max(initialPage, 0), pages.length - 1));
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [phase, setPhase] = useState<Phase>("filling");
  const [submitError, setSubmitError] = useState<string | null>(null);

  const consented = answers[CONSENT_KEY] === CONSENT_YES;
  const save = useCallback(
    async (a: Answers, page: number) => {
      const r = await actions.saveDraft(definition.slug, a, page);
      return r.ok ? { ok: true, savedAt: r.data.savedAt } : { ok: false };
    },
    [actions, definition.slug],
  );
  // Nothing is stored before consent is given (R1–V2.1.2B consent text).
  const autosave = useAutosave(save, consented);

  const showIssues = (issues: AnswerIssue[]) => {
    const next: Record<string, string> = {};
    for (const i of issues) next[i.key] ??= t.maybe(`runner.issues.${i.code}`) ?? i.code;
    setErrors(next);
    const first = issues[0];
    if (!first) return;
    const target = pageOfKey.get(first.key);
    if (target !== undefined && target !== pageIndex) setPageIndex(target);
    requestAnimationFrame(() => document.getElementById(fieldDomId(first.key))?.scrollIntoView({ block: "start" }));
  };

  const onChange = (key: string, value: string) => {
    const next = { ...latest.current, [key]: value };
    latest.current = next;
    setAnswers(next);
    if (errors[key]) {
      setErrors((current) => {
        const rest = { ...current };
        delete rest[key];
        return rest;
      });
    }
    if (next[CONSENT_KEY] === CONSENT_YES) autosave.schedule(next, pageIndex);
  };

  const goTo = async (index: number) => {
    if (index > pageIndex) {
      const issues = validatePage(definition.plan, pageIndex, answers, definition.options);
      if (issues.length > 0) return showIssues(issues);
    }
    setErrors({});
    if (consented) {
      autosave.schedule(answers, index);
      await autosave.flush();
    }
    setPageIndex(index);
    window.scrollTo({ top: 0 });
  };

  const submit = async () => {
    const issues = validatePage(definition.plan, pageIndex, answers, definition.options);
    if (issues.length > 0) return showIssues(issues);
    setPhase("submitting");
    setSubmitError(null);
    autosave.cancel();
    const result = await actions.submit(definition.slug, answers);
    if (result.ok) return router.refresh();
    setPhase("filling");
    const serverIssues = result.error.details;
    if (result.error.code === "VALIDATION_ERROR" && Array.isArray(serverIssues)) showIssues(serverIssues as AnswerIssue[]);
    else setSubmitError(t.maybe(`errors.${result.error.code}`) ?? t("runner.submitFailed"));
  };

  const decline = async () => {
    setPhase("submitting");
    autosave.cancel();
    const result = await actions.decline(definition.slug);
    if (result.ok) setPhase("declined");
    else {
      setPhase("filling");
      setSubmitError(t.maybe(`errors.${result.error.code}`) ?? t("runner.submitFailed"));
    }
  };

  if (phase === "declined") {
    return (
      <Notice title={t("runner.declinedTitle")}>
        {t("runner.declinedBody")}
      </Notice>
    );
  }

  const last = pageIndex === pages.length - 1;
  const declining = pageIndex === 0 && answers[CONSENT_KEY] === CONSENT_NO;
  const errorCount = Object.keys(errors).length;
  const busy = phase === "submitting";

  return (
    <div className="flex flex-col gap-6">
      <div className="sticky top-0 z-10 -mx-4 flex flex-col gap-2 border-b bg-background/95 px-4 py-3 backdrop-blur md:-mx-8 md:px-8">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h1 className="font-heading text-base font-semibold md:text-lg">{definition.title}</h1>
          <AutosaveIndicator
            state={autosave.state}
            labels={{
              saving: t("runner.saving"),
              saved: autosave.state.kind === "saved" ? t("runner.saved", { time: formatDateTime(autosave.state.at, t.locale) }) : "",
              failed: t("runner.saveFailed"),
            }}
          />
        </div>
        <Progress value={(pageIndex / (pages.length - 1)) * 100} aria-label={t("runner.progress", { current: pageIndex + 1, total: pages.length })} />
        <p className="text-xs text-muted-foreground tabular-nums">{t("runner.progress", { current: pageIndex + 1, total: pages.length })}</p>
      </div>

      {errorCount > 0 ? <Notice tone="warning">{t("runner.errorsTitle", { n: errorCount })}</Notice> : null}

      <RunnerPage page={pages[pageIndex]} definition={definition} answers={answers} errors={errors} onChange={onChange} />

      {submitError ? <Notice tone="warning">{submitError}</Notice> : null}

      <nav className="flex items-center justify-between gap-3 border-t pt-4" aria-label={t("runner.progress", { current: pageIndex + 1, total: pages.length })}>
        <Button variant="outline" disabled={pageIndex === 0 || busy} onClick={() => void goTo(pageIndex - 1)}>
          {t("runner.back")}
        </Button>
        {declining ? (
          <Button variant="secondary" disabled={busy} onClick={() => void decline()}>
            {busy ? t("runner.submitting") : t("runner.declineSubmit")}
          </Button>
        ) : last ? (
          <Button disabled={busy} onClick={() => void submit()}>
            {busy ? t("runner.submitting") : t("runner.submit")}
          </Button>
        ) : (
          <Button disabled={busy} onClick={() => void goTo(pageIndex + 1)}>
            {t("runner.next")}
          </Button>
        )}
      </nav>
    </div>
  );
}
