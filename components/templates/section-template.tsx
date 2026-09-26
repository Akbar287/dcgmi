import type { ReactNode } from "react";

import { PageHeading } from "@/components/molecules/page-heading";

export function SectionTemplate({
  eyebrow,
  title,
  description,
  actions,
  notices,
  children,
}: {
  eyebrow?: string;
  title: string;
  description?: string;
  actions?: ReactNode;
  notices?: ReactNode;
  children: ReactNode;
}) {
  return (
    <>
      <PageHeading eyebrow={eyebrow} title={title} description={description} actions={actions} />
      {notices ? <div className="flex flex-col gap-3">{notices}</div> : null}
      <div className="flex min-w-0 flex-col gap-6">{children}</div>
    </>
  );
}
