import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // The reproduction package (SPECIFICATION §4.10, §3.14) ships the prompt
  // templates and the independent recompute script as files.
  outputFileTracingIncludes: {
    "/api/export/reproduction": ["./lib/ai/prompts/**/*", "./lib/persona/prompt.ts", "./lib/method/constants.ts", "./scripts/recompute.py", "./docs/05-METHOD-RULES.md"],
    // Chart text in the report PDF/Word is rendered with the bundled DejaVu font (lib/export/chart-png.ts).
    "/api/report/[jobId]/docx": ["./node_modules/dejavu-fonts-ttf/ttf/DejaVuSans.ttf", "./node_modules/dejavu-fonts-ttf/ttf/DejaVuSans-Bold.ttf"],
    "/api/report/[jobId]/part/[key]": ["./node_modules/dejavu-fonts-ttf/ttf/DejaVuSans.ttf", "./node_modules/dejavu-fonts-ttf/ttf/DejaVuSans-Bold.ttf"],
    "/api/report/[jobId]/parts": ["./node_modules/dejavu-fonts-ttf/ttf/DejaVuSans.ttf", "./node_modules/dejavu-fonts-ttf/ttf/DejaVuSans-Bold.ttf"],
    "/audit/laporan/[jobId]": ["./node_modules/dejavu-fonts-ttf/ttf/DejaVuSans.ttf", "./node_modules/dejavu-fonts-ttf/ttf/DejaVuSans-Bold.ttf"],
  },
  // Native rasteriser for report charts; loaded at runtime, not bundled.
  serverExternalPackages: ["@resvg/resvg-js"],
  experimental: {
    serverActions: {
      // Google Form response exports (.xlsx) are uploaded through a Server Action;
      // app/(app)/forms/gform-actions.ts enforces the same 5 MB cap.
      bodySizeLimit: "5mb",
    },
  },
};

export default nextConfig;
