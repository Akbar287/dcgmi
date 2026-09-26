import { EmptyValue } from "@/components/atoms/empty-value";
import { RoleBadge } from "@/components/atoms/role-badge";
import { StatusBadge } from "@/components/atoms/status-badge";
import { UserRowActions, type UserRowActionHandlers } from "@/components/molecules/user-row-actions";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import type { Role } from "@/lib/auth/roles";
import { formatDateTime } from "@/lib/format";
import { getTranslator } from "@/lib/i18n/server";

export interface ManagedUser {
  id: string;
  email: string;
  name: string | null;
  role: Role;
  active: boolean;
  hasPassword: boolean;
  panelCode: string | null;
  lastLoginAt: string | null;
}

export async function UserTable({
  users,
  currentUserId,
  passwordMin,
  googleEnabled,
  panelCodes,
  actions,
}: {
  users: ManagedUser[];
  currentUserId: string;
  passwordMin: number;
  googleEnabled: boolean;
  panelCodes: string[];
  actions: UserRowActionHandlers;
}) {
  const t = await getTranslator();
  return (
    <div className="overflow-x-auto rounded-2xl border">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>{t("columns.email")}</TableHead>
            <TableHead>{t("columns.role")}</TableHead>
            <TableHead>{t("users.panelCode")}</TableHead>
            <TableHead>{t("columns.status")}</TableHead>
            <TableHead>{t("users.signIn")}</TableHead>
            <TableHead>{t("users.lastLogin")}</TableHead>
            <TableHead className="text-right">
              <span className="sr-only">{t("columns.action")}</span>
            </TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {users.map((u) => (
            <TableRow key={u.id}>
              <TableCell>
                <div className="flex flex-col">
                  <span className="font-medium">
                    {u.email}
                    {u.id === currentUserId ? <span className="ml-2 text-xs text-muted-foreground">({t("users.you")})</span> : null}
                  </span>
                  {u.name ? <span className="text-xs text-muted-foreground">{u.name}</span> : null}
                </div>
              </TableCell>
              <TableCell>
                <RoleBadge role={u.role} label={t(`roles.${u.role}`)} />
              </TableCell>
              <TableCell className="font-mono text-sm">
                {u.panelCode ?? <EmptyValue srLabel={t("users.noPanelCode")} />}
              </TableCell>
              <TableCell>
                <StatusBadge
                  value={u.active ? "ACTIVE" : "CLOSED"}
                  tone={u.active ? "success" : "neutral"}
                  label={u.active ? t("users.active") : t("users.inactive")}
                />
              </TableCell>
              <TableCell className="space-x-1">
                {googleEnabled ? <Badge variant="secondary">{t("users.methodGoogle")}</Badge> : null}
                {u.hasPassword ? <Badge variant="secondary">{t("users.methodPassword")}</Badge> : null}
                {!googleEnabled && !u.hasPassword ? <EmptyValue srLabel={t("common.none")} /> : null}
              </TableCell>
              <TableCell className="whitespace-nowrap text-muted-foreground tabular-nums">
                {u.lastLoginAt ? formatDateTime(u.lastLoginAt, t.locale) : t("common.none")}
              </TableCell>
              <TableCell className="text-right">
                <UserRowActions
                  userId={u.id}
                  email={u.email}
                  role={u.role}
                  active={u.active}
                  isSelf={u.id === currentUserId}
                  passwordMin={passwordMin}
                  panelCode={u.panelCode}
                  panelCodes={panelCodes}
                  actions={actions}
                />
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}
