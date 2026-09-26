import { readFileSync } from "node:fs";
import { createContext, runInContext } from "node:vm";

import { buildSignature } from "./hash";
import type { BuilderConfig, PlanItem, PreReviewSnapshot, SourceData, SourceFiles } from "./types";
import { validateSource } from "./validate-source";

export const BUILDER_SCRIPT_PATH = "docs/R1-V2.1.2B-form-builder.gs";

interface ScriptExports {
  CONFIG: BuilderConfig;
  DATA: SourceData;
  DATA_SHA256: string;
  SOURCE: SourceFiles;
  plan_: (mode: string) => PlanItem[];
  description_: (mode: string) => string;
  title_: (mode: string) => string;
  configureForm_: (form: unknown, mode: string) => void;
}

/** Records the chained Google Form setters that configureForm_() calls. */
function recordingForm(): { form: unknown; calls: Record<string, unknown> } {
  const calls: Record<string, unknown> = {};
  const form: unknown = new Proxy(
    {},
    {
      get(_target, prop: string) {
        if (prop === "supportsAdvancedResponderPermissions") return () => false;
        return (value: unknown) => {
          calls[prop] = value;
          return form;
        };
      },
    },
  );
  return { form, calls };
}

/**
 * Runs the researcher's own Apps Script in an isolated VM so the app uses the
 * exact plan_(), description_() and confirmation text Google Forms received,
 * instead of a re-typed copy. The script's top level only declares constants
 * and functions; Google services are touched only inside functions we never call.
 */
export function loadBuilderScript(path = BUILDER_SCRIPT_PATH): PreReviewSnapshot {
  const code = readFileSync(path, "utf8");
  const context = createContext({});
  const exported = runInContext(
    `${code}\n;({ CONFIG, DATA, DATA_SHA256, SOURCE, plan_, description_, title_, configureForm_ });`,
    context,
    { filename: path, timeout: 5_000 },
  ) as ScriptExports;

  // Round-trip through JSON so nothing from the VM realm leaks into the app.
  const data = JSON.parse(JSON.stringify(exported.DATA)) as SourceData;
  const issues = validateSource(data, exported.DATA_SHA256);
  if (issues.length > 0) throw new Error(`Sumber R1–V2.1.2B tidak valid:\n- ${issues.join("\n- ")}`);

  const mode = "PRODUCTION";
  const plan = JSON.parse(JSON.stringify(exported.plan_(mode))) as PlanItem[];
  const description = exported.description_(mode);
  const recorder = recordingForm();
  exported.configureForm_(recorder.form, mode);
  const confirmationMessage = recorder.calls.setConfirmationMessage;
  if (typeof confirmationMessage !== "string") throw new Error("Pesan konfirmasi tidak ditemukan di configureForm_().");

  return {
    kind: "PRE_REVIEW",
    builderVersion: "R1-V2.1.2B",
    mode,
    title: exported.title_(mode),
    description,
    confirmationMessage,
    config: JSON.parse(JSON.stringify(exported.CONFIG)) as BuilderConfig,
    source: JSON.parse(JSON.stringify(exported.SOURCE)) as SourceFiles,
    dataSha256: exported.DATA_SHA256,
    data,
    plan,
    signature: buildSignature(plan, description, exported.DATA_SHA256),
  };
}
