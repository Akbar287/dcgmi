import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // The reproduction package (SPECIFICATION §4.10, §3.14) ships the prompt
  // templates and the independent recompute script as files.
  outputFileTracingIncludes: {
    "/api/export/reproduction": ["./lib/ai/prompts/**/*", "./lib/persona/prompt.ts", "./lib/method/constants.ts", "./scripts/recompute.py", "./docs/05-METHOD-RULES.md"],
  },
  experimental: {
    serverActions: {
      // Google Form response exports (.xlsx) are uploaded through a Server Action;
      // app/(app)/forms/gform-actions.ts enforces the same 5 MB cap.
      bodySizeLimit: "5mb",
    },
  },
};

export default nextConfig;
