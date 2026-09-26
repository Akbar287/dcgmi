import { CodeText } from "@/components/atoms/code-text";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { formatNumber } from "@/lib/format";
import { getTranslator } from "@/lib/i18n/server";
import { METHOD } from "@/lib/method/constants";

// Read-only mirror of lib/method/constants.ts; values are read, never restated.
const SHOWN = [
  "I_CVI_MIN",
  "I_CVI_REVISE_MIN",
  "S_CVI_AVE_MIN",
  "MEDIAN_MIN",
  "IQR_MAX",
  "MAX_ROUNDS",
  "DELPHI_PANEL_SIZE",
  "FGD_PANEL_SIZE",
  "FGD_REVISE_NON_ACCEPT_MIN",
  "FGD_SPECIAL_REJECT_MIN",
  "CR_MAX",
  "AGGREGATION",
  "LEVEL_MIN",
  "LEVEL_MAX",
  "BASELINE_DISTRIBUTION",
  "CONTROLLED_EXCEPTIONS",
] as const satisfies readonly (keyof typeof METHOD)[];

function display(value: unknown, locale: string): string {
  if (typeof value === "number") return formatNumber(value, locale);
  if (Array.isArray(value)) {
    return value.every((v) => typeof v === "number")
      ? value.map((v) => formatNumber(v, locale)).join("–")
      : value.join(", ");
  }
  return String(value);
}

export async function ThresholdTable() {
  const t = await getTranslator();
  return (
    <div className="overflow-x-auto rounded-2xl border">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>{t("thresholds.key")}</TableHead>
            <TableHead>{t("thresholds.value")}</TableHead>
            <TableHead>{t("thresholds.rationale")}</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {SHOWN.map((key) => (
            <TableRow key={key}>
              <TableCell>
                <CodeText>{key}</CodeText>
              </TableCell>
              <TableCell className="font-medium tabular-nums">{display(METHOD[key], t.locale)}</TableCell>
              <TableCell className="text-muted-foreground">{t(`thresholds.${key}`)}</TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}
