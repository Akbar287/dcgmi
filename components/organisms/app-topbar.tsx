import { GateChip } from "@/components/molecules/gate-chip";
import { LanguageSwitch } from "@/components/molecules/language-switch";
import { UserMenu } from "@/components/molecules/user-menu";
import { VersionSelect, type VersionOption } from "@/components/molecules/version-select";
import { Separator } from "@/components/ui/separator";
import { SidebarTrigger } from "@/components/ui/sidebar";
import type { CurrentUser } from "@/lib/auth/session";
import { LOCALES } from "@/lib/i18n";
import { getTranslator } from "@/lib/i18n/server";
import { GATE_ORDER, type GateKey } from "@/lib/method/gates";

export interface GateState {
  gate: GateKey;
  status: string;
  /** Version on the process line that holds this gate's record. */
  versionLabel?: string;
}

export async function AppTopbar({
  versions,
  activeVersionId,
  gates,
  user,
  onVersionChange,
  onLocaleChange,
  onSignOut,
}: {
  versions: VersionOption[];
  activeVersionId: string | null;
  gates: GateState[];
  user: CurrentUser;
  onVersionChange: (formData: FormData) => Promise<void>;
  onLocaleChange: (formData: FormData) => Promise<void>;
  onSignOut: () => Promise<void>;
}) {
  const t = await getTranslator();
  const byGate = new Map(gates.map((g) => [g.gate, g]));

  return (
    <header className="sticky top-0 z-20 flex h-14 shrink-0 items-center gap-3 border-b bg-background/95 px-4 backdrop-blur">
      <SidebarTrigger aria-label={t("topbar.toggleSidebar")} />
      <Separator orientation="vertical" className="h-5" />
      <VersionSelect
        versions={versions}
        activeId={activeVersionId}
        label={t("topbar.activeVersion")}
        emptyLabel={t("topbar.noVersion")}
        action={onVersionChange}
      />
      <nav aria-label={t("topbar.gates")} className="hidden min-w-0 items-center gap-1 overflow-x-auto md:flex">
        {GATE_ORDER.map((gate, i) => {
          const status = byGate.get(gate)?.status ?? "PENDING";
          return (
            <GateChip
              key={gate}
              index={i + 1}
              label={t(`gates.${gate}`)}
              status={status}
              statusLabel={t.maybe(`enums.${status}`) ?? status}
              versionLabel={byGate.get(gate)?.versionLabel}
            />
          );
        })}
      </nav>
      <div className="ml-auto flex items-center gap-2">
        <LanguageSwitch locale={t.locale} locales={LOCALES} label={t("topbar.language")} action={onLocaleChange} />
        <UserMenu name={user.name} email={user.email} image={user.image} role={user.role} onSignOut={onSignOut} />
      </div>
    </header>
  );
}
