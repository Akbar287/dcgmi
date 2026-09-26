import type { ModuleKey } from "@/lib/navigation";

import { ahpSections } from "./ahp";
import { artefakSections } from "./artefak";
import { auditSections } from "./audit";
import { delphiSections } from "./delphi";
import { expertsSections } from "./experts";
import { fgdSections } from "./fgd";
import { formsSections } from "./forms";
import { panelSections } from "./panel";
import { runsSections } from "./runs";
import { scoringSections } from "./scoring";
import { settingsSections } from "./settings";
import type { ModuleSections } from "./types";

// Typed per module so every slug in lib/navigation.ts must have a definition.
export const SECTIONS: { [M in ModuleKey]: ModuleSections<M> } = {
  artefak: artefakSections,
  forms: formsSections,
  experts: expertsSections,
  panel: panelSections,
  fgd: fgdSections,
  delphi: delphiSections,
  ahp: ahpSections,
  scoring: scoringSections,
  runs: runsSections,
  audit: auditSections,
  settings: settingsSections,
};
