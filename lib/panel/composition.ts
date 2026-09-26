import { EXPERT_FIELDS, PANEL_PRESETS, type ExpertField } from "./presets";

export interface SeatForCheck {
  seatIndex: number;
  label: string;
  field: ExpertField;
  isNewMember: boolean;
  contextScope: string;
  expert: { id: string; panelCode: string; field: ExpertField; personaStatus: string | null } | null;
  model: { id: string; label: string; providerKey: string; providerApproved: boolean; providerEnabled: boolean };
}

export type PanelIssueCode =
  | "SEAT_COUNT"
  | "FIELD_COMPOSITION"
  | "NEW_MEMBER_COMPOSITION"
  | "NEW_MEMBER_CONTEXT"
  | "EXPERT_MISSING"
  | "EXPERT_FIELD_MISMATCH"
  | "DUPLICATE_EXPERT"
  | "PERSONA_NOT_APPROVED"
  | "PROVIDER_NOT_APPROVED";

export interface PanelFinding {
  code: PanelIssueCode | "SAME_MODEL" | "UNKNOWN_PRESET";
  detail: string;
  seats: number[];
}

export interface PanelValidation {
  ready: boolean;
  issues: PanelFinding[];
  warnings: PanelFinding[];
}

/**
 * docs/03 validatePanelComposition: preset field mix, new-member isolation,
 * expert/seat field match, approved personas, approved providers. Same-model
 * seats only warn (docs/04 §2): correlation lowers stress-test value, it does
 * not make the panel invalid.
 */
export function validatePanel(preset: string, seats: SeatForCheck[]): PanelValidation {
  const issues: PanelFinding[] = [];
  const warnings: PanelFinding[] = [];
  const spec = PANEL_PRESETS[preset];
  if (!spec) return { ready: false, issues: [], warnings: [{ code: "UNKNOWN_PRESET", detail: preset, seats: [] }] };

  if (seats.length !== spec.size) issues.push({ code: "SEAT_COUNT", detail: `${seats.length}/${spec.size}`, seats: [] });

  for (const field of EXPERT_FIELDS) {
    const all = seats.filter((s) => s.field === field);
    if (all.length !== spec.composition[field]) {
      issues.push({ code: "FIELD_COMPOSITION", detail: `${field} ${all.length}/${spec.composition[field]}`, seats: all.map((s) => s.seatIndex) });
    }
    const fresh = all.filter((s) => s.isNewMember);
    if (fresh.length !== (spec.newMembers[field] ?? 0)) {
      issues.push({ code: "NEW_MEMBER_COMPOSITION", detail: `${field} ${fresh.length}/${spec.newMembers[field] ?? 0}`, seats: fresh.map((s) => s.seatIndex) });
    }
  }

  for (const s of seats) {
    // §3.8.1: new members must not receive FGD context in round 1.
    if (s.isNewMember && s.contextScope !== "ARTIFACT_ONLY") issues.push({ code: "NEW_MEMBER_CONTEXT", detail: s.contextScope, seats: [s.seatIndex] });
    if (!s.expert) issues.push({ code: "EXPERT_MISSING", detail: s.label, seats: [s.seatIndex] });
    else {
      if (s.expert.field !== s.field) issues.push({ code: "EXPERT_FIELD_MISMATCH", detail: `${s.expert.panelCode}: ${s.expert.field} ≠ ${s.field}`, seats: [s.seatIndex] });
      if (s.expert.personaStatus !== "APPROVED") issues.push({ code: "PERSONA_NOT_APPROVED", detail: s.expert.panelCode, seats: [s.seatIndex] });
    }
    if (!s.model.providerApproved || !s.model.providerEnabled) issues.push({ code: "PROVIDER_NOT_APPROVED", detail: s.model.providerKey, seats: [s.seatIndex] });
  }

  const byExpert = new Map<string, number[]>();
  const byModel = new Map<string, number[]>();
  for (const s of seats) {
    if (s.expert) byExpert.set(s.expert.id, [...(byExpert.get(s.expert.id) ?? []), s.seatIndex]);
    byModel.set(s.model.id, [...(byModel.get(s.model.id) ?? []), s.seatIndex]);
  }
  for (const [id, idx] of byExpert) {
    if (idx.length > 1) issues.push({ code: "DUPLICATE_EXPERT", detail: seats.find((s) => s.expert?.id === id)!.expert!.panelCode, seats: idx });
  }
  for (const [id, idx] of byModel) {
    if (idx.length > 1) warnings.push({ code: "SAME_MODEL", detail: seats.find((s) => s.model.id === id)!.model.label, seats: idx });
  }
  return { ready: issues.length === 0, issues, warnings };
}
