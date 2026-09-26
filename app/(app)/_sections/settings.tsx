import { DatabaseIcon } from "@hugeicons/core-free-icons";

import { EmptyState } from "@/components/molecules/empty-state";
import { ThresholdTable } from "@/components/organisms/threshold-table";
import { UserCreateForm } from "@/components/organisms/user-create-form";
import { UserTable } from "@/components/organisms/user-table";
import { googleEnabled } from "@/auth";
import { listProviders } from "@/lib/db/repository/panel";
import { listKnownExpertCodes } from "@/lib/db/repository/pre-review";
import { listManagedUsers } from "@/lib/db/repository/users";
import { tryQuery } from "@/lib/db/result";
import { PASSWORD_MIN_LENGTH } from "@/lib/validation/auth";

import {
  createUserAction,
  setUserActiveAction,
  setUserPanelCodeAction,
  setUserPasswordAction,
  updateUserRoleAction,
} from "../settings/user-actions";
import { col, type ModuleSections, type SectionContext } from "./types";

async function UserManagement({ t, user }: SectionContext) {
  const users = await tryQuery(() => Promise.all([listManagedUsers(), listKnownExpertCodes()]));
  if (!users.ok) {
    return <EmptyState icon={DatabaseIcon} title={t("db.unavailableTitle")} description={t("db.unavailableBody")} />;
  }
  return (
    <>
      <UserCreateForm action={createUserAction} passwordMin={PASSWORD_MIN_LENGTH} />
      <UserTable
        users={users.data[0]}
        panelCodes={users.data[1]}
        currentUserId={user.id}
        passwordMin={PASSWORD_MIN_LENGTH}
        googleEnabled={googleEnabled}
        actions={{
          updateRole: updateUserRoleAction,
          setActive: setUserActiveAction,
          setPassword: setUserPasswordAction,
          setPanelCode: setUserPanelCodeAction,
        }}
      />
    </>
  );
}

export const settingsSections: ModuleSections<"settings"> = {
  umum: { view: { kind: "pending", milestone: "M8" } },
  pengguna: {
    permission: "users:manage",
    notices: [{ key: "users.rolesHelp" }],
    view: { kind: "custom", render: (ctx) => <UserManagement {...ctx} /> },
  },
  "kunci-api": {
    notices: [{ key: "notices.apiKeysServerOnly" }],
    view: {
      kind: "table",
      scope: "global",
      load: () => listProviders(),
      columns: (t) => [col(t, "name"), col(t, "envKey", "code"), col(t, "envStatus", "status")],
    },
  },
  ambang: {
    notices: [{ tone: "locked", key: "notices.thresholdsLocked" }],
    view: { kind: "custom", render: () => <ThresholdTable /> },
  },
  anggaran: { view: { kind: "pending", milestone: "M8" } },
  retensi: { view: { kind: "pending", milestone: "M8" } },
  "basis-data": { view: { kind: "pending", milestone: "M8" } },
};
