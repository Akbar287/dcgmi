import {
  Alert02Icon,
  Cancel01Icon,
  CheckmarkCircle02Icon,
  Clock01Icon,
  MinusSignIcon,
} from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";

import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

export type StatusTone = "success" | "warning" | "danger" | "info" | "neutral";

const TONE_BY_VALUE: Record<string, StatusTone> = {
  PASSED: "success",
  APPROVED: "success",
  COMPLETED: "success",
  ACTIVE: "success",
  CONTENT_LOCKED: "success",
  PERTAHANKAN: "success",
  TERIMA: "success",
  ACCEPTED: "success",
  CONFIGURED: "success",
  PENDING: "warning",
  REVIEWED: "warning",
  HOLD: "warning",
  DRY_RUN: "warning",
  PAUSED: "warning",
  REOPENED: "warning",
  PROVISIONAL: "warning",
  TERIMA_DENGAN_REVISI: "warning",
  REVISI: "warning",
  REVISI_NILAI_ULANG: "warning",
  PERTAHANKAN_SEMENTARA: "warning",
  TIDAK_SEPAKAT: "warning",
  MISSING_ADMINISTRATIF: "warning",
  RETURNED: "warning",
  NOT_CONFIGURED: "warning",
  FAILED: "danger",
  TOLAK: "danger",
  HAPUS_DARI_INTI: "danger",
  PEMBAHASAN_KHUSUS: "danger",
  CANCELLED: "danger",
  TIDAK_SELESAI: "danger",
  RUNNING: "info",
  QUEUED: "info",
  DRAFT: "info",
  BARU: "info",
};

// Status is never conveyed by color alone (docs/06 §5): every tone has an icon.
const TONE_ICON = {
  success: CheckmarkCircle02Icon,
  warning: Alert02Icon,
  danger: Cancel01Icon,
  info: Clock01Icon,
  neutral: MinusSignIcon,
} as const;

export const TONE_CLASS: Record<StatusTone, string> = {
  success: "border-success/30 bg-success/10 text-success",
  warning: "border-warning/40 bg-warning/10 text-warning",
  danger: "border-destructive/30 bg-destructive/10 text-destructive",
  info: "border-info/30 bg-info/10 text-info",
  neutral: "border-border bg-muted text-muted-foreground",
};

export function toneFor(value: string): StatusTone {
  return TONE_BY_VALUE[value] ?? "neutral";
}

export function StatusBadge({
  value,
  label,
  tone,
  className,
}: {
  value: string;
  label: string;
  tone?: StatusTone;
  className?: string;
}) {
  const resolved = tone ?? toneFor(value);
  return (
    <Badge variant="outline" data-status={value} className={cn(TONE_CLASS[resolved], className)}>
      <HugeiconsIcon icon={TONE_ICON[resolved]} strokeWidth={2} aria-hidden="true" data-icon="inline-start" />
      {label}
    </Badge>
  );
}
