"use client";

import { useRouter } from "next/navigation";
import { useMemo, useState, useTransition } from "react";

import { AutosaveIndicator } from "@/components/molecules/autosave-indicator";
import { Notice } from "@/components/molecules/notice";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { useAutosave } from "@/components/organisms/form-runner/use-autosave";
import type { ActionResult } from "@/lib/action-result";
import { nextTarget } from "@/lib/forms/branching";
import type { Answers, FormDef } from "@/lib/forms/types";
import { validateSection, type AnswerIssue } from "@/lib/forms/validate";
import { formatDateTime } from "@/lib/format";
import { useT } from "@/lib/i18n/client";

import { FieldRenderer, fieldDomId, type ItemFeedback } from "./field-renderer";

export interface RunnerActions {
  save: (answers: Answers, sectionOrder: number) => Promise<ActionResult<{ savedAt: string }>>;
  submit: (answers: Answers) => Promise<ActionResult<{ issues: AnswerIssue[] } | null>>;
}

/**
 * Generic runner (SPECIFICATION §4.2): one section per page, branching via
 * lib/forms, per-page validation, autosave. `actions` absent = preview (no
 * writes). Back returns along the path actually taken.
 */
export function GenericRunner({
  form,
  initialAnswers,
  mode,
  actions,
  feedback,
  banner,
}: {
  form: FormDef;
  initialAnswers: Answers;
  mode: "PREVIEW" | "DRY_RUN" | "LIVE";
  actions?: RunnerActions;
  feedback?: Record<string, ItemFeedback>;
  banner?: string;
}) {
  const t = useT();
  const router = useRouter();
  const sections = useMemo(() => [...form.sections].sort((a, b) => a.order - b.order), [form.sections]);
  const [answers, setAnswers] = useState<Answers>(initialAnswers);
  const [trail, setTrail] = useState<number[]>([sections[0]?.order ?? 0]);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [message, setMessage] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const current = sections.find((s) => s.order === trail.at(-1)) ?? sections[0];
  const saveFn = useMemo(() => async (a: Answers, order: number) => {
    if (!actions) return { ok: true, savedAt: new Date().toISOString() };
    const r = await actions.save(a, order);
    return r.ok ? { ok: true, savedAt: r.data.savedAt } : { ok: false };
  }, [actions]);
  const autosave = useAutosave(saveFn, Boolean(actions));

  const set = (key: string, value: string) => {
    setAnswers((prev) => {
      const next = { ...prev, [key]: value };
      autosave.schedule(next, current.order);
      return next;
    });
    setErrors((e) => {
      if (!e[key]) return e;
      const { [key]: _drop, ...rest } = e;
      void _drop;
      return rest;
    });
  };

  const showIssues = (issues: AnswerIssue[]) => {
    const map = Object.fromEntries(issues.map((i) => [i.key, t.maybe(`runner.issues.${i.code}`) ?? i.code]));
    setErrors(map);
    const first = issues[0];
    if (first) document.getElementById(fieldDomId(first.key.split(":")[0]))?.scrollIntoView({ behavior: "smooth", block: "center" });
  };

  const target = nextTarget(form, current, answers);
  const isLast = target === "SUBMIT";

  const goNext = async () => {
    const issues = validateSection(current, answers);
    if (issues.length) return showIssues(issues);
    setErrors({});
    await autosave.flush();
    if (target !== "SUBMIT") {
      setTrail((tr) => [...tr, target]);
      window.scrollTo({ top: 0 });
    }
  };

  const submit = () =>
    start(async () => {
      const issues = validateSection(current, answers);
      if (issues.length) return showIssues(issues);
      if (!actions) {
        setMessage(t("builder.previewDone"));
        return;
      }
      await autosave.flush();
      const r = await actions.submit(answers);
      if (!r.ok) setMessage(r.error.message);
      else if (r.data?.issues.length) showIssues(r.data.issues);
      else router.refresh();
    });

  const step = trail.length;
  return (
    <div className="mx-auto flex w-full max-w-3xl flex-col gap-5">
      {banner ? <Notice tone="warning">{banner}</Notice> : null}
      <div className="sticky top-0 z-10 flex flex-col gap-2 bg-background/95 py-2 backdrop-blur">
        <div className="flex items-center justify-between gap-3 text-xs text-muted-foreground">
          <span>{t("builder.sectionOf", { current: step, total: sections.length })}</span>
          {actions ? <AutosaveIndicator state={autosave.state} labels={{ saving: t("runner.saving"), saved: autosave.state.kind === "saved" ? t("runner.saved", { time: formatDateTime(autosave.state.at, t.locale) }) : "", failed: t("runner.saveFailed") }} /> : <span>{t(`builder.modes.${mode}`)}</span>}
        </div>
        <Progress value={Math.round((step / Math.max(1, sections.length)) * 100)} aria-label={t("builder.sectionOf", { current: step, total: sections.length })} />
      </div>
      <header className="flex flex-col gap-1">
        <h1 className="text-xl font-semibold">{current.title}</h1>
        {current.description ? <p className="text-sm whitespace-pre-line text-muted-foreground">{current.description}</p> : null}
      </header>
      {Object.keys(errors).length ? <Notice tone="warning">{t("runner.errorsTitle", { n: Object.keys(errors).length })}</Notice> : null}
      <div className="flex flex-col gap-6">
        {current.fields.map((f) => (
          <FieldRenderer key={f.id} field={f} answers={answers} set={set} errors={errors} feedback={feedback?.[f.key]} />
        ))}
      </div>
      {message ? <Notice>{message}</Notice> : null}
      <div className="flex justify-between gap-3">
        <Button variant="outline" disabled={trail.length <= 1 || pending} onClick={() => setTrail((tr) => tr.slice(0, -1))}>
          {t("runner.back")}
        </Button>
        {isLast ? (
          <Button onClick={submit} disabled={pending}>
            {pending ? t("runner.submitting") : t("runner.submit")}
          </Button>
        ) : (
          <Button onClick={() => void goNext()}>{t("runner.next")}</Button>
        )}
      </div>
    </div>
  );
}
