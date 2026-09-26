import { cookies } from "next/headers";
import { cache } from "react";

import { findVersionId } from "@/lib/db/repository/artifact";

export const VERSION_COOKIE = "ddc_version";

// Cached per request so layout, topbar, and page resolve the same version.
export const getActiveVersionId = cache(async (): Promise<string | null> => {
  const preferred = (await cookies()).get(VERSION_COOKIE)?.value ?? null;
  return findVersionId(preferred);
});
