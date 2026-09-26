import Link from "next/link";

import { CodeText } from "@/components/atoms/code-text";
import { EmptyValue } from "@/components/atoms/empty-value";
import { StatusBadge } from "@/components/atoms/status-badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import type { ActionResult } from "@/lib/action-result";
import { getTranslator } from "@/lib/i18n/server";

import { ExpertDialog, type ExpertValues } from "./expert-dialog";

type Action = (state: ActionResult<unknown> | null, formData: FormData) => Promise<ActionResult<unknown> | null>;

export async function ExpertTable({
  experts,
  action,
}: {
  experts: (ExpertValues & { id: string; personaStatus: string | null; seats: number })[];
  action: Action;
}) {
  const t = await getTranslator();
  return (
    <div className="flex flex-col gap-3">
      <div>
        <ExpertDialog action={action} />
      </div>
      {experts.length === 0 ? (
        <p className="text-sm text-muted-foreground">{t("panelAdmin.experts.none")}</p>
      ) : (
        <div className="overflow-x-auto rounded-2xl border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>{t("panelAdmin.experts.panelCode")}</TableHead>
                <TableHead>{t("panelAdmin.experts.field")}</TableHead>
                <TableHead>{t("panelAdmin.experts.participation")}</TableHead>
                <TableHead>{t("columns.coi")}</TableHead>
                <TableHead>{t("panelAdmin.experts.persona")}</TableHead>
                <TableHead>{t("panelAdmin.experts.seats")}</TableHead>
                <TableHead className="text-right">
                  <span className="sr-only">{t("columns.action")}</span>
                </TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {experts.map((e) => (
                <TableRow key={e.id}>
                  <TableCell>
                    <CodeText>{e.panelCode}</CodeText>
                    {e.displayName ? <span className="ml-2 text-xs text-muted-foreground">{e.displayName}</span> : null}
                  </TableCell>
                  <TableCell>{t(`enums.${e.field}`)}</TableCell>
                  <TableCell className="text-sm">
                    {[e.inFgd && "FGD", e.inDelphi && "Delphi", e.inAhp && "AHP"].filter(Boolean).join(", ") || <EmptyValue srLabel={t("common.none")} />}
                  </TableCell>
                  <TableCell>{e.coiDeclared ? t("common.yes") : t("common.no")}</TableCell>
                  <TableCell>
                    {e.personaStatus ? (
                      <StatusBadge value={e.personaStatus} label={t.maybe(`enums.${e.personaStatus}`) ?? e.personaStatus} />
                    ) : (
                      <EmptyValue srLabel={t("panelAdmin.persona.noPersona")} />
                    )}
                  </TableCell>
                  <TableCell className="tabular-nums">{e.seats}</TableCell>
                  <TableCell className="text-right whitespace-nowrap">
                    <ExpertDialog expert={e} action={action} />
                    <Link href={`/experts/persona/${e.id}`} className="ml-2 text-sm underline underline-offset-4">
                      {t("panelAdmin.experts.openPersona")}
                    </Link>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}
    </div>
  );
}
