import { TestTube01Icon } from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";

import { getTranslator } from "@/lib/i18n/server";

// docs/07 P5: permanent strip under the topbar. There is deliberately no close
// control, prop, or setting that hides it while the context is SIMULATED.
export async function SimulationBanner() {
  const t = await getTranslator();
  return (
    <div
      role="note"
      data-slot="simulation-banner"
      className="flex flex-wrap items-center gap-x-3 gap-y-1 border-b border-simulated-foreground/20 bg-simulated px-4 py-2 text-sm text-simulated-foreground"
    >
      <HugeiconsIcon icon={TestTube01Icon} strokeWidth={2} aria-hidden="true" className="size-4 shrink-0" />
      <strong className="font-semibold">{t("banner.simulated")}</strong>
      <span className="text-xs opacity-90">{t("banner.simulatedDetail")}</span>
    </div>
  );
}
