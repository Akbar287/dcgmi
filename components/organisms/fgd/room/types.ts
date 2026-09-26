export interface RoomItem {
  id: string;
  title: string;
  status: string;
  decision: string | null;
}

export interface RoomStage {
  key: string;
  title: string;
  status: string;
  items: RoomItem[];
}

export interface RoomSeat {
  seatIndex: number;
  label: string;
  field: string;
  panelCode: string | null;
  model: string;
}

export interface RoomSelected {
  id: string;
  title: string;
  stageTitle: string;
  status: string;
  error: string | null;
  utterances: { id: string; kind: string; speaker: string; seatIndex: number | null; content: string; modelId: string | null; tokensIn: number | null; tokensOut: number | null; latencyMs: number | null }[];
  positions: { seatIndex: number; position: string; reason: string; proposedAction: string | null }[];
  suggestions: { id: string; seatIndex: number; action: string; quote: string; rationale: string }[];
  decision: { decision: string; ruleFired: string; tally: Record<string, number>; note: string | null } | null;
}

export interface RoomView {
  sessionId: string;
  status: string;
  mode: "STEP" | "AUTO";
  seed: number;
  versionLabel: string;
  calls: number;
  tokensIn: number;
  tokensOut: number;
  stages: RoomStage[];
  seats: RoomSeat[];
  selected: RoomSelected | null;
}
