import { cookies } from "next/headers";

import { AppTopbar, type GateState } from "@/components/organisms/app-topbar";
import { AppShell } from "@/components/templates/app-shell";
import { requirePermission } from "@/lib/auth/session";
import { listLineageGates, listVersions } from "@/lib/db/repository/artifact";
import { tryQuery } from "@/lib/db/result";
import { getTranslator } from "@/lib/i18n/server";
import { GATE_ORDER, type GateKey } from "@/lib/method/gates";

import { signOutAction } from "../_actions/session";
import { getActiveVersionId } from "./_lib/active-version";
import { setActiveVersion, setLocale } from "./actions";

function isGateKey(value: string): value is GateKey {
  return (GATE_ORDER as string[]).includes(value);
}

export default async function AppLayout({ children }: LayoutProps<"/">) {
  // Pages repeat this check: layouts are not re-rendered on every navigation.
  const user = await requirePermission("console:read");
  const t = await getTranslator();
  const sidebarOpen = (await cookies()).get("sidebar_state")?.value !== "false";

  const shell = await tryQuery(async () => {
    const [versions, activeVersionId] = await Promise.all([listVersions(), getActiveVersionId()]);
    const gates = activeVersionId ? await listLineageGates(activeVersionId) : [];
    return { versions, activeVersionId, gates };
  });

  const versions = shell.ok
    ? shell.data.versions.map((v) => ({
        id: v.id,
        label: String(v.label),
        statusLabel: t.maybe(`enums.${String(v.status)}`) ?? String(v.status),
      }))
    : [];
  const gates: GateState[] = shell.ok
    ? shell.data.gates.filter((g) => isGateKey(g.gate)).map((g) => ({ gate: g.gate as GateKey, status: g.status, versionLabel: g.versionLabel }))
    : [];

  return (
    <AppShell
      sidebarOpen={sidebarOpen}
      topbar={
        <AppTopbar
          versions={versions}
          activeVersionId={shell.ok ? shell.data.activeVersionId : null}
          gates={gates}
          user={user}
          onVersionChange={setActiveVersion}
          onLocaleChange={setLocale}
          onSignOut={signOutAction}
        />
      }
    >
      {children}
    </AppShell>
  );
}
