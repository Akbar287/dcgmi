import Link from "next/link";

import { StatusBadge } from "@/components/atoms/status-badge";
import { CreateFormForm } from "@/components/organisms/form-builder/form-meta-form";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { can } from "@/lib/auth/roles";
import { listBuilderForms } from "@/lib/db/repository/form-builder";
import { formatDateTime } from "@/lib/format";

import { createFormAction } from "../forms/builder-actions";
import type { SectionContext } from "./types";

async function FormList({ t, links }: Pick<SectionContext, "t"> & { links: "edit" | "preview" }) {
  const forms = await listBuilderForms();
  if (forms.length === 0) return <p className="text-sm text-muted-foreground">{t("builder.none")}</p>;
  return (
    <div className="overflow-x-auto rounded-2xl border">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>{t("builder.title")}</TableHead>
            <TableHead>{t("columns.status")}</TableHead>
            <TableHead>{t("builder.stageTag")}</TableHead>
            <TableHead className="text-right">{t("columns.responses")}</TableHead>
            <TableHead>{t("columns.createdAt")}</TableHead>
            <TableHead>
              <span className="sr-only">{t("builder.edit")}</span>
            </TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {forms.map((f) => (
            <TableRow key={f.id}>
              <TableCell>
                <span className="block">{f.title}</span>
                <span className="font-mono text-xs text-muted-foreground">
                  {f.slug} · {f.kind}
                </span>
              </TableCell>
              <TableCell>
                <StatusBadge value={f.status} label={t.maybe(`enums.${f.status}`) ?? f.status} />
              </TableCell>
              <TableCell className="text-xs">{f.stageTag ? (t.maybe(`process.stages.${f.stageTag}.title`) ?? f.stageTag) : "—"}</TableCell>
              <TableCell className="text-right text-xs tabular-nums">
                {f.real} REAL · {f.dryRun} SIM
              </TableCell>
              <TableCell className="text-xs tabular-nums">{formatDateTime(f.createdAt, t.locale)}</TableCell>
              <TableCell className="flex gap-3 text-sm">
                {links === "edit" ? (
                  <Link className="underline underline-offset-4" href={`/forms/sunting/${f.id}`}>
                    {t("builder.edit")}
                  </Link>
                ) : null}
                <Link className="underline underline-offset-4" href={`/forms/lihat/${f.id}`}>
                  {t("builder.preview")}
                </Link>
                {f.status === "DRY_RUN" ? (
                  <Link className="underline underline-offset-4" href={`/forms/uji/${f.id}`}>
                    {t("builder.tryOut")}
                  </Link>
                ) : null}
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}

export async function BuilderView({ t, user }: SectionContext) {
  return (
    <>
      {can(user.role, "artifact:write") ? (
        <Card>
          <CardHeader>
            <CardTitle>{t("builder.createTitle")}</CardTitle>
          </CardHeader>
          <CardContent>
            <CreateFormForm action={createFormAction} />
          </CardContent>
        </Card>
      ) : null}
      <Card>
        <CardHeader>
          <CardTitle>{t("builder.listTitle")}</CardTitle>
          <CardDescription>{t("builder.listHint")}</CardDescription>
        </CardHeader>
        <CardContent>
          <FormList t={t} links="edit" />
        </CardContent>
      </Card>
    </>
  );
}

export async function PreviewListView({ t }: SectionContext) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>{t("builder.previewTitle")}</CardTitle>
        <CardDescription>{t("builder.previewHint")}</CardDescription>
      </CardHeader>
      <CardContent>
        <FormList t={t} links="preview" />
      </CardContent>
    </Card>
  );
}
