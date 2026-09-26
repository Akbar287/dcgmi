import { GoogleFormImportPanel } from "@/components/organisms/google-form-import/import-panel";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { listPreReviewForms } from "@/lib/db/repository/pre-review";

import { commitGoogleImportAction, previewGoogleImportAction } from "../forms/gform-actions";
import type { SectionContext } from "./types";

export async function GoogleFormImportView({ t }: SectionContext) {
  const forms = (await listPreReviewForms()).map((f) => ({ id: f.id, title: f.title, slug: f.slug }));
  return (
    <Card>
      <CardHeader>
        <CardTitle>{t("gformImport.title")}</CardTitle>
        <CardDescription>{t("gformImport.description")}</CardDescription>
      </CardHeader>
      <CardContent>
        <GoogleFormImportPanel forms={forms} previewAction={previewGoogleImportAction} commitAction={commitGoogleImportAction} />
      </CardContent>
    </Card>
  );
}
