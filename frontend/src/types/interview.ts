export type TranscriptRole = "candidate" | "interviewer";

export interface TranscriptLine {
  id: string;
  role: TranscriptRole;
  text: string;
  ts: number;
}

export interface SessionCreateResponse {
  session_id: string;
  daily_room_url: string | null;
  daily_token: string | null;
  persona_id: string;
  pipecat_mode: "live" | "stub";
  system_prompt_preview: string;
}

export interface MetricsSummary {
  timestamp: number;
  eye_contact_avg?: number;
  posture_avg?: number;
  smile_count?: number;
  nod_count?: number;
  fidget_avg?: number;
  gesture_count?: number;
}
