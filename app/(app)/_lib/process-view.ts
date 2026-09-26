import type { StageCheck, StageView } from "@/components/organisms/process-flow/types";
import type { FgdPrerequisites } from "@/lib/db/repository/process";
import { formatNumber } from "@/lib/format";
import type { Translator } from "@/lib/i18n";
import { METHOD } from "@/lib/method/constants";
import type { GateEvaluation, GateKey } from "@/lib/method/gates";
import { STAGES, stageStatuses } from "@/lib/process/stages";

const UNMET_SHOWN = 5;

// Thresholds are read from METHOD so the flowchart never restates them.
const vars = (locale: string) => ({
  domains: METHOD.BASELINE_DOMAIN_COUNT,
  aspects: METHOD.BASELINE_ASPECT_COUNT,
  indicators: METHOD.BASELINE_INDICATOR_COUNT,
  lmin: METHOD.LEVEL_MIN,
  lmax: METHOD.LEVEL_MAX,
  fgd: METHOD.FGD_PANEL_SIZE,
  delphi: METHOD.DELPHI_PANEL_SIZE,
  rmin: METHOD.RELEVANCE_MIN,
  rmax: METHOD.RELEVANCE_MAX,
  rounds: METHOD.MAX_ROUNDS,
  // Written as in R1–V1.7 (0,90 / 0,10), formatted for the active locale.
  sCvi: formatNumber(METHOD.S_CVI_AVE_MIN, locale, 2),
  cr: formatNumber(METHOD.CR_MAX, locale, 2),
  saatyMin: METHOD.SAATY_MIN,
  saatyMax: METHOD.SAATY_MAX,
});

function short(gate: GateKey): string {
  return gate.split("_")[0];
}

function fgdChecks(t: Translator, p: FgdPrerequisites): StageCheck[] {
  const n = METHOD.FGD_PANEL_SIZE;
  const checks: StageCheck[] = [
    { text: t("process.checks.fgdPanel", { seats: p.panelSeats ?? 0, n }), ok: p.panelSeats === n },
    { text: t("process.checks.fgdPersona", { approved: p.personasApproved, n }), ok: p.personasApproved === n },
    p.mockAi
      ? { text: t("process.checks.fgdMock"), ok: null }
      : { text: t("process.checks.fgdProviders", { ready: p.providersReady, n }), ok: p.providersReady === n },
  ];
  checks.push(
    p.preReview
      ? {
          text: t("process.checks.preReview", {
            submitted: p.preReview.submitted,
            total: p.preReview.total,
            status: t.maybe(`enums.${p.preReview.status}`) ?? p.preReview.status,
          }),
          // Informational: the pre-review is input to FGD, not a gate (SPECIFICATION §4.2).
          ok: null,
        }
      : { text: t("process.checks.preReviewMissing"), ok: null },
  );
  return checks;
}

export function buildProcessView(input: {
  t: Translator;
  gateStatus: Partial<Record<GateKey, string>>;
  evaluations: Partial<Record<GateKey, GateEvaluation>>;
  fgd: FgdPrerequisites;
}): StageView[] {
  const { t, gateStatus, evaluations, fgd } = input;
  const statuses = stageStatuses(gateStatus);
  const VARS = vars(t.locale);

  return STAGES.map((s, i) => {
    const text = (block: "inputs" | "outputs" | "gate", key: string) => t.maybe(`process.stages.${s.stage}.${block}.${key}`, VARS) ?? key;
    const status = statuses[i];
    const recorded = gateStatus[s.gate] ?? "PENDING";
    const missing: StageCheck[] = [];

    if (status === "UPCOMING") {
      missing.push({ text: t("process.waitingPrevious", { gate: short(STAGES[i - 1].gate) }), ok: false });
    } else if (status === "CURRENT") {
      const evaluation = evaluations[s.gate];
      if (!evaluation) missing.push({ text: t("process.notEvaluable"), ok: null });
      else if (evaluation.passed) missing.push({ text: t("process.waitingAdmin", { gate: short(s.gate) }), ok: false });
      else {
        evaluation.unmet.slice(0, UNMET_SHOWN).forEach((u) => missing.push({ text: u, ok: false, code: true }));
        if (evaluation.unmet.length > UNMET_SHOWN) {
          missing.push({ text: t("process.unmetMore", { n: evaluation.unmet.length - UNMET_SHOWN }), ok: false });
        }
      }
    }
    if (s.stage === "FGD" && status !== "DONE") missing.push(...fgdChecks(t, fgd));

    return {
      key: s.stage,
      gate: s.gate,
      gateLabel: short(s.gate),
      title: t(`process.stages.${s.stage}.title`),
      version: t(`process.stages.${s.stage}.version`),
      status,
      gateStatus: recorded,
      gateStatusLabel: t.maybe(`enums.${recorded}`) ?? recorded,
      inputs: s.items.inputs.map((k) => text("inputs", k)),
      outputs: s.items.outputs.map((k) => text("outputs", k)),
      gateConditions: s.items.gate.map((k) => text("gate", k)),
      missing,
      passedNote: status === "DONE" ? t("process.passed", { gate: short(s.gate) }) : null,
      href: s.href,
    };
  });
}
