"use client";

import { NativeSelect, NativeSelectOption } from "@/components/ui/native-select";

export interface VersionOption {
  id: string;
  label: string;
  statusLabel: string;
}

// Submits on change so the server action can set the cookie and re-render.
// Keyed by the active id because React 19 resets the form after the action.
export function VersionSelect({
  versions,
  activeId,
  label,
  emptyLabel,
  action,
}: {
  versions: VersionOption[];
  activeId: string | null;
  label: string;
  emptyLabel: string;
  action: (formData: FormData) => Promise<void>;
}) {
  return (
    <form key={activeId ?? "none"} action={action} className="flex items-center">
      <label htmlFor="active-version" className="sr-only">
        {label}
      </label>
      <NativeSelect
        id="active-version"
        name="versionId"
        size="sm"
        defaultValue={activeId ?? ""}
        disabled={versions.length === 0}
        onChange={(event) => event.currentTarget.form?.requestSubmit()}
        className="min-w-40"
      >
        {versions.length === 0 ? <NativeSelectOption value="">{emptyLabel}</NativeSelectOption> : null}
        {versions.map((v) => (
          <NativeSelectOption key={v.id} value={v.id}>
            {v.label} · {v.statusLabel}
          </NativeSelectOption>
        ))}
      </NativeSelect>
    </form>
  );
}
