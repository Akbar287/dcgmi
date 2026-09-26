import { UserMenu } from "@/components/molecules/user-menu";
import { MinimalShell } from "@/components/templates/minimal-shell";
import { requirePermission } from "@/lib/auth/session";
import { getTranslator } from "@/lib/i18n/server";

import { signOutAction } from "../_actions/session";

// Human experts only. Nothing simulated (artifact console, panel output,
// personas) is reachable from here, so their judgement stays independent.
export default async function PakarLayout({ children }: LayoutProps<"/pakar">) {
  const user = await requirePermission("instrument:fill");
  const t = await getTranslator();
  return (
    <MinimalShell
      brand={<span className="font-semibold">{t("app.name")}</span>}
      actions={<UserMenu name={user.name} email={user.email} image={user.image} role={user.role} onSignOut={signOutAction} />}
    >
      {children}
    </MinimalShell>
  );
}
