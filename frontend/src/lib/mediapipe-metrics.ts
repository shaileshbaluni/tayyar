/**
 * Derive lightweight scores from MediaPipe FaceLandmarker result (blendshapes + landmarks).
 * Indices follow MediaPipe Face Mesh conventions where noted.
 */

import type { NormalizedLandmark } from "@mediapipe/tasks-vision";

export interface FrameMetrics {
  eye_contact_score: number;
  posture_proxy: number;
  smile_detected: boolean;
  brow_furrow_proxy: number;
}

function dist(a: NormalizedLandmark, b: NormalizedLandmark): number {
  const dx = a.x - b.x;
  const dy = a.y - b.y;
  const dz = (a.z || 0) - (b.z || 0);
  return Math.sqrt(dx * dx + dy * dy + dz * dz);
}

/** Approximate eye openness / gaze proxy using eye aperture height vs inter-eye distance. */
export function scoreEyeContact(landmarks: NormalizedLandmark[]): number {
  if (!landmarks.length) return 50;
  const leftO = landmarks[159];
  const leftI = landmarks[145];
  const rightO = landmarks[386];
  const rightI = landmarks[374];
  const nose = landmarks[1];
  if (!leftO || !leftI || !rightO || !rightI || !nose) return 55;
  const leftOpen = dist(leftO, leftI);
  const rightOpen = dist(rightO, rightI);
  const eyeSep = dist(landmarks[33], landmarks[263]);
  if (eyeSep < 1e-6) return 50;
  const ratio = ((leftOpen + rightOpen) / 2 / eyeSep) * 8;
  const centered = 1 - Math.min(1, Math.abs(nose.x - 0.5) * 3);
  return Math.max(0, Math.min(100, Math.round(ratio * 40 + centered * 60)));
}

export function detectSmile(landmarks: NormalizedLandmark[]): boolean {
  const upper = landmarks[13];
  const lower = landmarks[14];
  const l = landmarks[61];
  const r = landmarks[291];
  if (!upper || !lower || !l || !r) return false;
  const mouthH = dist(upper, lower);
  const mouthW = dist(l, r);
  if (mouthH < 1e-6) return false;
  return mouthW / mouthH > 2.8;
}

export function browFurrowProxy(landmarks: NormalizedLandmark[]): number {
  const a = landmarks[55];
  const b = landmarks[285];
  if (!a || !b) return 0;
  const d = dist(a, b);
  return Math.max(0, Math.min(100, Math.round((0.08 - d) * 800)));
}

export function frameMetricsFromLandmarks(landmarks: NormalizedLandmark[]): FrameMetrics {
  return {
    eye_contact_score: scoreEyeContact(landmarks),
    posture_proxy: 70,
    smile_detected: detectSmile(landmarks),
    brow_furrow_proxy: browFurrowProxy(landmarks),
  };
}

export function confidenceFromFrame(m: FrameMetrics): number {
  const smile = m.smile_detected ? 8 : 0;
  const browPen = Math.max(0, 20 - m.brow_furrow_proxy / 5);
  return Math.round(
    m.eye_contact_score * 0.45 + m.posture_proxy * 0.25 + smile + browPen + (m.smile_detected ? 5 : 0)
  );
}
