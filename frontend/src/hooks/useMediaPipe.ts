import { FaceLandmarker, FilesetResolver } from "@mediapipe/tasks-vision";
import { useCallback, useEffect, useRef, useState } from "react";
import { confidenceFromFrame, frameMetricsFromLandmarks } from "../lib/mediapipe-metrics";

const WASM = "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.21/wasm";
const MODEL =
  "https://storage.googleapis.com/mediapipe-models/face_landmarker/face_landmarker/float16/latest/face_landmarker.task";

export function useMediaPipe(video: HTMLVideoElement | null, running: boolean) {
  const landmarkerRef = useRef<FaceLandmarker | null>(null);
  const rafRef = useRef<number>(0);
  const [confidence, setConfidence] = useState(65);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const vision = await FilesetResolver.forVisionTasks(WASM);
        if (cancelled) return;
        const lm = await FaceLandmarker.createFromOptions(vision, {
          baseOptions: { modelAssetPath: MODEL, delegate: "CPU" },
          runningMode: "VIDEO",
          numFaces: 1,
        });
        landmarkerRef.current = lm;
      } catch (e) {
        setError(e instanceof Error ? e.message : "MediaPipe init failed");
      }
    })();
    return () => {
      cancelled = true;
      landmarkerRef.current?.close();
      landmarkerRef.current = null;
    };
  }, []);

  const tick = useCallback(() => {
    const lm = landmarkerRef.current;
    if (!video || !lm || !running || video.readyState < 2) {
      rafRef.current = requestAnimationFrame(tick);
      return;
    }
    const res = lm.detectForVideo(video, performance.now());
    const face = res.faceLandmarks?.[0];
    if (face) {
      const fm = frameMetricsFromLandmarks(face);
      setConfidence(confidenceFromFrame(fm));
    }
    rafRef.current = requestAnimationFrame(tick);
  }, [video, running]);

  useEffect(() => {
    if (!running) return;
    rafRef.current = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(rafRef.current);
  }, [running, tick]);

  return { confidence, error };
}
