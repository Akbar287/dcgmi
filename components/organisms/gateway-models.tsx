"use client";

import { useActionState, useState } from "react";

import { Notice } from "@/components/molecules/notice";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Field, FieldDescription, FieldError, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import type { ActionResult } from "@/lib/action-result";
import { useT } from "@/lib/i18n/client";

type Model = { id: string; name: string; family: string };

export function GatewayModels({
  keySet,
  conditionalFamilies,
  addAction,
  catalogAction,
}: {
  keySet: boolean;
  conditionalFamilies: string[];
  addAction: (state: ActionResult<unknown> | null, formData: FormData) => Promise<ActionResult<unknown> | null>;
  catalogAction: () => Promise<ActionResult<Model[]>>;
}) {
  const t = useT();
  const [state, formAction, pending] = useActionState(addAction, null);
  const [catalog, setCatalog] = useState<Model[] | null>(null);
  const [catalogError, setCatalogError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [modelId, setModelId] = useState("");
  const [label, setLabel] = useState("");

  const load = async () => {
    setLoading(true);
    setCatalogError(null);
    const r = await catalogAction();
    setLoading(false);
    if (r.ok) setCatalog(r.data);
    else setCatalogError(r.error.message);
  };

  return (
    <div className="flex flex-col gap-4">
      <Notice tone={keySet ? "info" : "warning"}>{keySet ? t("gateway.keySet") : t("gateway.keyMissing")}</Notice>
      <form key={state?.ok ? "done" : "form"} action={formAction} className="grid gap-4 md:grid-cols-[2fr_1fr_auto] md:items-end">
        <Field>
          <FieldLabel htmlFor="gw-model">{t("gateway.modelId")}</FieldLabel>
          <Input id="gw-model" name="modelId" value={modelId} onChange={(e) => setModelId(e.target.value)} required autoComplete="off" />
          <FieldDescription>{t("gateway.modelIdHint")}</FieldDescription>
        </Field>
        <Field>
          <FieldLabel htmlFor="gw-label">{t("gateway.label")}</FieldLabel>
          <Input id="gw-label" name="label" value={label} onChange={(e) => setLabel(e.target.value)} required autoComplete="off" />
        </Field>
        <Button type="submit" disabled={pending} className="md:mb-6">
          {t("gateway.add")}
        </Button>
      </form>
      {state && !state.ok ? <FieldError>{state.error.message}</FieldError> : null}
      <div className="flex flex-col gap-2">
        <Button variant="outline" size="sm" className="self-start" disabled={loading || !keySet} onClick={() => void load()}>
          {loading ? t("gateway.catalogLoading") : t("gateway.catalog")}
        </Button>
        <p className="text-xs text-muted-foreground">{t("gateway.catalogHint")}</p>
        {catalogError ? <FieldError>{catalogError}</FieldError> : null}
        {catalog ? (
          <ul className="grid max-h-72 gap-1 overflow-y-auto rounded-xl border p-2 text-sm sm:grid-cols-2">
            {catalog.map((m) => (
              <li key={m.id} className="flex items-center justify-between gap-2 rounded-lg px-2 py-1 hover:bg-muted/50">
                <span className="min-w-0 truncate">
                  <span className="font-mono text-xs">{m.id}</span>
                  {conditionalFamilies.includes(m.family) ? (
                    <Badge variant="outline" className="ml-2">
                      {t("gateway.conditional")}
                    </Badge>
                  ) : null}
                </span>
                <Button size="xs" variant="ghost" onClick={() => (setModelId(m.id), setLabel(m.name))}>
                  {t("gateway.use")}
                </Button>
              </li>
            ))}
          </ul>
        ) : null}
      </div>
    </div>
  );
}
