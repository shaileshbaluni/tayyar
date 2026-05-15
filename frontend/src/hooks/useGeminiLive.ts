/**
 * useGeminiLive — React hook for real-time interview via Gemini Live API.
 *
 * Manages: WebSocket connection to backend proxy, mic capture via AudioWorklet,
 * video frame capture, audio playback, metrics state, and transcript.
 */

import { useState, useRef, useCallback, useEffect } from "react";
import { FaceLandmarker, FilesetResolver } from "@mediapipe/tasks-vision";
import {
  createAudioPipeline,
  feedPlayback,
  clearPlayback,
  type AudioPipeline,
} from "../lib/audioContext";

export interface InterviewMetrics {
  eye_contact_pct: number;
  posture: string;
  expression: string;
  smile_count_last_min: number;
  fidget_level: string;
  self_touch_events_last_min: number;
  speaking_pace_wpm: number;
  filler_count_last_min: number;
  filler_total: number;
  coaching_tip: string | null;
  multiple_faces_visible?: boolean;
  non_candidate_speech_heard?: boolean;
  timestamp: number;
}

const FILLER_WORDS = [
  "um", "uh", "umm", "uhh", "like", "actually", "basically", "you know",
  "matlab", "yaani", "right", "so", "well", "literally", "kinda", "sorta",
];

export interface TranscriptEntry {
  role: "model" | "user";
  text: string;
  ts: number;
}

export type GeminiLiveStatus =
  | "idle"
  | "connecting"
  | "calibrating"
  | "active"
  | "error"
  | "ended";

export interface GeminiLiveState {
  status: GeminiLiveStatus;
  isInterviewerSpeaking: boolean;
  metrics: InterviewMetrics | null;
  metricsHistory: InterviewMetrics[];
  transcript: TranscriptEntry[];
  error: string | null;
  confidenceScore: number;
  /** Preview / capture issue while mic may still work */
  cameraError: string | null;
  /** Session integrity: extra face on camera or background voice (client + model signals) */
  integrityNote: string | null;
  /** Confirmed by backend after Gemini Live setup (authoritative for this session). */
  liveGeminiVoice: string | null;
  /** Backend GEMINI_LIVE_MODEL echoed when the Live upstream connects. */
  liveModel: string | null;
  /** True when steps 1–6 briefing was loaded into Gemini systemInstruction. */
  contextApplied: boolean;
  briefingChars: number;
  hasResumeText: boolean;
}

/** Optional hardware selection from setup (deviceIds from enumerateDevices). */
export interface InterviewMediaOptions {
  audioDeviceId?: string;
  videoDeviceId?: string;
}

/**
 * Acquire mic and camera in separate getUserMedia calls. Combined A+V constraints
 * often fail or ignore USB webcams (e.g. Logitech) on Windows/Chrome.
 */
async function openMediaStream(
  enableVideo: boolean,
  media?: InterviewMediaOptions,
): Promise<{
  stream: MediaStream;
  cameraMissing: boolean;
  cameraDetail?: string;
}> {
  const audioConstraints: MediaTrackConstraints = media?.audioDeviceId
    ? {
        deviceId: { exact: media.audioDeviceId },
        echoCancellation: true,
        noiseSuppression: true,
        autoGainControl: true,
      }
    : {
        echoCancellation: true,
        noiseSuppression: true,
        autoGainControl: true,
      };

  let audioStream: MediaStream;
  try {
    audioStream = await navigator.mediaDevices.getUserMedia({
      audio: audioConstraints,
    });
  } catch {
    audioStream = await navigator.mediaDevices.getUserMedia({ audio: true });
  }

  if (!enableVideo) {
    return { stream: audioStream, cameraMissing: false };
  }

  const vid = media?.videoDeviceId;
  const attempts: MediaStreamConstraints[] = [];
  if (vid) {
    attempts.push({
      video: {
        deviceId: { exact: vid },
        width: { ideal: 1280 },
        height: { ideal: 720 },
        frameRate: { ideal: 30 },
      },
    });
    attempts.push({ video: { deviceId: { exact: vid } } });
    attempts.push({
      video: {
        deviceId: { exact: vid },
        width: { ideal: 640 },
        height: { ideal: 480 },
      },
    });
  }
  attempts.push({
    video: { width: { ideal: 640 }, height: { ideal: 480 }, frameRate: { ideal: 30 } },
  });
  attempts.push({ video: true });

  let cameraDetail: string | undefined;
  for (const c of attempts) {
    try {
      const vs = await navigator.mediaDevices.getUserMedia(c);
      const merged = new MediaStream([
        ...audioStream.getAudioTracks(),
        ...vs.getVideoTracks(),
      ]);
      return { stream: merged, cameraMissing: false };
    } catch (e: unknown) {
      cameraDetail = e instanceof Error ? e.message : String(e);
    }
  }

  return {
    stream: audioStream,
    cameraMissing: true,
    cameraDetail,
  };
}

function computeConfidence(m: InterviewMetrics): number {
  const eyeScore = Math.min(100, Math.max(0, m.eye_contact_pct));
  const postureScore =
    m.posture === "good" ? 90 : m.posture === "slouching" ? 40 : 55;
  const expressionScore =
    m.expression === "smiling"
      ? 95
      : m.expression === "neutral"
        ? 70
        : m.expression === "tense"
          ? 40
          : 30;
  const fidgetScore =
    m.fidget_level === "calm"
      ? 90
      : m.fidget_level === "moderate"
        ? 65
        : 30;
  const paceScore =
    m.speaking_pace_wpm >= 110 && m.speaking_pace_wpm <= 150
      ? 90
      : m.speaking_pace_wpm > 150 && m.speaking_pace_wpm <= 180
        ? 65
        : m.speaking_pace_wpm > 180
          ? 35
          : 55;
  const fillerScore =
    Math.max(0, 100 - m.filler_count_last_min * 15);

  return Math.round(
    eyeScore * 0.25 +
      postureScore * 0.15 +
      expressionScore * 0.15 +
      fidgetScore * 0.15 +
      paceScore * 0.15 +
      fillerScore * 0.15,
  );
}

export function useGeminiLive() {
  const [state, setState] = useState<GeminiLiveState>({
    status: "idle",
    isInterviewerSpeaking: false,
    metrics: null,
    metricsHistory: [],
    transcript: [],
    error: null,
    confidenceScore: 0,
    cameraError: null,
    integrityNote: null,
    liveGeminiVoice: null,
    liveModel: null,
    contextApplied: false,
    briefingChars: 0,
    hasResumeText: false,
  });

  const wsRef = useRef<WebSocket | null>(null);
  const mediaStreamRef = useRef<MediaStream | null>(null);
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const pipelineRef = useRef<AudioPipeline | null>(null);
  const frameIntervalRef = useRef<number | null>(null);
  const recognitionRef = useRef<any>(null);
  const calibrationTimerRef = useRef<number | null>(null);
  const connectGenerationRef = useRef(0);
  const sendAudioRef = useRef(false);
  const videoTrackCleanupRef = useRef<(() => void) | null>(null);
  const recorderRef = useRef<MediaRecorder | null>(null);
  const recordedBlobsRef = useRef<Blob[]>([]);

  // MediaPipe Ref
  const landmarkerRef = useRef<FaceLandmarker | null>(null);
  const fillerCountRef = useRef(0);
  const lastNoseRef = useRef<{ x: number; y: number } | null>(null);
  const movementEmaRef = useRef(0);
  const lastIntegrityFaceRef = useRef(0);
  /** Synced with playback worklet — used for client-side VAD without re-renders. */
  const interviewerSpeakingRef = useRef(false);
  const micMutedRef = useRef(false);
  const vadIntervalRef = useRef<number | null>(null);
  const vadSourceRef = useRef<MediaStreamAudioSourceNode | null>(null);
  const lastUserTurnSignalAtRef = useRef(0);

  const getRecordingBlobs = useCallback(() => {
    return recordedBlobsRef.current;
  }, []);

  /** Stop MediaRecorder and wait for final chunks before reading `getRecordingBlobs()`. */
  const flushRecording = useCallback((): Promise<void> => {
    return new Promise((resolve) => {
      const rec = recorderRef.current;
      if (!rec || rec.state === "inactive") {
        resolve();
        return;
      }
      rec.onstop = () => resolve();
      try {
        rec.stop();
      } catch {
        resolve();
      }
    });
  }, []);

  // Initialize MediaPipe
  useEffect(() => {
    const initLandmarker = async () => {
      const filesetResolver = await FilesetResolver.forVisionTasks(
        "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@latest/wasm",
      );
      const faceLandmarker = await FaceLandmarker.createFromOptions(filesetResolver, {
        baseOptions: {
          modelAssetPath: `https://storage.googleapis.com/mediapipe-models/face_landmarker/face_landmarker/float16/1/face_landmarker.task`,
          delegate: "GPU",
        },
        outputFaceBlendshapes: true,
        runningMode: "VIDEO",
        numFaces: 2,
      });
      landmarkerRef.current = faceLandmarker;
    };
    initLandmarker().catch(console.error);
  }, []);

  const setVideoElement = useCallback((el: HTMLVideoElement | null) => {
    videoRef.current = el;
  }, []);

  const connect = useCallback(
    async (
      sessionId: string,
      enableVideo: boolean = true,
      media?: InterviewMediaOptions,
    ) => {
      const myGen = (connectGenerationRef.current += 1);
      recordedBlobsRef.current = [];

      sendAudioRef.current = false;
      videoTrackCleanupRef.current?.();
      videoTrackCleanupRef.current = null;
      if (calibrationTimerRef.current) {
        clearTimeout(calibrationTimerRef.current);
        calibrationTimerRef.current = null;
      }
      if (frameIntervalRef.current) {
        clearInterval(frameIntervalRef.current);
        frameIntervalRef.current = null;
      }
      if (wsRef.current) {
        try {
          wsRef.current.close();
        } catch {
          /* ignore */
        }
        wsRef.current = null;
      }
      if (pipelineRef.current) {
        pipelineRef.current.close();
        pipelineRef.current = null;
      }
      if (mediaStreamRef.current) {
        mediaStreamRef.current.getTracks().forEach((t) => t.stop());
        mediaStreamRef.current = null;
      }
      if (videoRef.current) {
        videoRef.current.srcObject = null;
      }
      if (recognitionRef.current) {
        try {
          recognitionRef.current.stop();
        } catch (e) {
          /* ignore */
        }
        recognitionRef.current = null;
      }

      interviewerSpeakingRef.current = false;
      micMutedRef.current = false;
      lastUserTurnSignalAtRef.current = 0;
      if (vadIntervalRef.current) {
        clearInterval(vadIntervalRef.current);
        vadIntervalRef.current = null;
      }
      try {
        vadSourceRef.current?.disconnect();
      } catch {
        /* ignore */
      }
      vadSourceRef.current = null;

      setState((s) => ({
        ...s,
        status: "connecting",
        error: null,
        cameraError: null,
        integrityNote: null,
        transcript: [],
        metricsHistory: [],
        liveGeminiVoice: null,
        liveModel: null,
        contextApplied: false,
        briefingChars: 0,
        hasResumeText: false,
      }));

      try {
        // 1. Open WebSocket to backend
        const apiBase = import.meta.env.VITE_API_BASE || "";
        const wsHost = apiBase
          ? new URL(apiBase).host
          : window.location.host;
        const proto = window.location.protocol === "https:" ? "wss:" : "ws:";
        const wsUrl = `${proto}//${wsHost}/api/v1/interview/ws/${sessionId}`;
        const ws = new WebSocket(wsUrl);
        wsRef.current = ws;

        await new Promise<void>((resolve, reject) => {
          ws.onopen = () => resolve();
          ws.onerror = () => reject(new Error("WebSocket connection failed"));
          setTimeout(() => reject(new Error("WebSocket timeout")), 10000);
        });
        if (myGen !== connectGenerationRef.current) {
          ws.close();
          if (wsRef.current === ws) wsRef.current = null;
          return;
        }

        let liveGeminiVoice: string | null = null;
        let liveModel: string | null = null;
        let contextApplied = false;
        let briefingChars = 0;
        let hasResumeText = false;
        // Wait for "ready" from backend (Gemini upstream connected)
        await new Promise<void>((resolve, reject) => {
          const timeout = setTimeout(
            () => reject(new Error("Gemini setup timeout")),
            20000,
          );
          const handler = (ev: MessageEvent) => {
            const msg = JSON.parse(ev.data);
            if (msg.type === "ready") {
              if (typeof msg.geminiVoice === "string" && msg.geminiVoice.trim()) {
                liveGeminiVoice = msg.geminiVoice.trim();
              }
              if (typeof msg.liveModel === "string" && msg.liveModel.trim()) {
                liveModel = msg.liveModel.trim();
              }
              contextApplied = Boolean(msg.contextApplied);
              briefingChars = Number(msg.briefingChars) || 0;
              hasResumeText = Boolean(msg.hasResumeText);
              clearTimeout(timeout);
              ws.removeEventListener("message", handler);
              resolve();
            } else if (msg.type === "error") {
              clearTimeout(timeout);
              ws.removeEventListener("message", handler);
              reject(new Error(msg.message));
            }
          };
          ws.addEventListener("message", handler);
        });
        if (myGen !== connectGenerationRef.current) {
          ws.close();
          if (wsRef.current === ws) wsRef.current = null;
          return;
        }

        // 2. Mic + optional camera (split calls — reliable for USB webcams)
        const { stream, cameraMissing, cameraDetail } = await openMediaStream(
          enableVideo,
          media,
        );
        if (myGen !== connectGenerationRef.current) {
          stream.getTracks().forEach((t) => t.stop());
          ws.close();
          if (wsRef.current === ws) wsRef.current = null;
          return;
        }
        mediaStreamRef.current = stream;

        if (videoRef.current) {
          videoRef.current.srcObject = stream;
        }

        const cameraErrorMsg =
          enableVideo && cameraMissing
            ? cameraDetail ||
              "Could not open the selected camera. Try Default, another USB port, or close apps using the webcam."
            : null;

        // Start Recording immediately — try multiple codecs for browser compat
        try {
          const codecs = [
            "video/webm;codecs=vp9,opus",
            "video/webm;codecs=vp8,opus",
            "video/webm;codecs=vp8",
            "video/webm",
          ];
          let chosenMime = "";
          for (const mime of codecs) {
            if (MediaRecorder.isTypeSupported(mime)) {
              chosenMime = mime;
              break;
            }
          }
          const recorderOpts: MediaRecorderOptions = chosenMime
            ? { mimeType: chosenMime }
            : {};
          const recorder = new MediaRecorder(stream, recorderOpts);
          recorder.ondataavailable = (ev) => {
            if (ev.data && ev.data.size > 0) {
              recordedBlobsRef.current.push(ev.data);
            }
          };
          recorder.start(1000); // 1s chunks
          recorderRef.current = recorder;
          console.info("[Recording] Started with codec:", chosenMime || "browser default");
        } catch (e) {
          console.warn("MediaRecorder failed:", e);
        }

        // 3. Set up audio pipeline
        const audioStream = new MediaStream(stream.getAudioTracks());
        const pipeline = await createAudioPipeline(
          audioStream,
          (b64) => {
            if (
              myGen === connectGenerationRef.current &&
              sendAudioRef.current &&
              ws.readyState === WebSocket.OPEN
            ) {
              ws.send(JSON.stringify({ type: "audio", data: b64 }));
            }
          },
          (playing) => {
            if (myGen !== connectGenerationRef.current) return;
            interviewerSpeakingRef.current = playing;
            setState((s) => {
              if (s.isInterviewerSpeaking !== playing) {
                return { ...s, isInterviewerSpeaking: playing };
              }
              return s;
            });
          },
        );
        if (myGen !== connectGenerationRef.current) {
          pipeline.close();
          stream.getTracks().forEach((t) => t.stop());
          ws.close();
          if (wsRef.current === ws) wsRef.current = null;
          return;
        }
        pipelineRef.current = pipeline;

        // End-of-user-turn hints for Gemini Live (VAD silence → audioStreamEnd + turnComplete)
        try {
          const actx = pipeline.ctx;
          const vadSource = actx.createMediaStreamSource(stream);
          vadSourceRef.current = vadSource;
          const vadAnalyser = actx.createAnalyser();
          vadAnalyser.fftSize = 1024;
          vadAnalyser.smoothingTimeConstant = 0.35;
          vadSource.connect(vadAnalyser);

          const timeDomain = new Uint8Array(vadAnalyser.fftSize);
          let consecutiveSilentMs = 0;
          let hadSpeechThisUtterance = false;
          const VAD_TICK_MS = 120;
          const SILENCE_MS = 1400;
          const MIN_GAP_MS = 2200;
          const SPEECH_THRESHOLD = 4.2;

          vadIntervalRef.current = window.setInterval(() => {
            if (myGen !== connectGenerationRef.current) return;
            const w = wsRef.current;
            if (!w || w.readyState !== WebSocket.OPEN || !sendAudioRef.current) return;
            if (micMutedRef.current) {
              consecutiveSilentMs = 0;
              return;
            }
            if (interviewerSpeakingRef.current) {
              consecutiveSilentMs = 0;
              return;
            }

            vadAnalyser.getByteTimeDomainData(timeDomain);
            let sum = 0;
            for (let i = 0; i < timeDomain.length; i++) {
              sum += Math.abs(timeDomain[i] - 128);
            }
            const activity = sum / timeDomain.length;
            const isSpeech = activity > SPEECH_THRESHOLD;

            if (isSpeech) {
              consecutiveSilentMs = 0;
              hadSpeechThisUtterance = true;
              return;
            }

            consecutiveSilentMs += VAD_TICK_MS;

            if (
              hadSpeechThisUtterance &&
              consecutiveSilentMs >= SILENCE_MS &&
              Date.now() - lastUserTurnSignalAtRef.current > MIN_GAP_MS
            ) {
              try {
                w.send(JSON.stringify({ type: "audio_stream_end" }));
                w.send(JSON.stringify({ type: "turn_complete" }));
              } catch {
                /* ignore */
              }
              lastUserTurnSignalAtRef.current = Date.now();
              hadSpeechThisUtterance = false;
              consecutiveSilentMs = 0;
            }
          }, VAD_TICK_MS);
        } catch (vadErr) {
          console.warn("End-of-turn VAD not started:", vadErr);
        }

        // Local Speech-to-Text and Filler Counting
        if (typeof window !== "undefined") {
          const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
          if (SpeechRecognition) {
            const recognition = new SpeechRecognition();
            recognition.continuous = true;
            recognition.interimResults = false;
            
            recognition.onresult = (event: any) => {
              if (myGen !== connectGenerationRef.current) return;
              for (let i = event.resultIndex; i < event.results.length; i++) {
                if (event.results[i].isFinal) {
                  const t = event.results[i][0].transcript.trim();
                  if (t) {
                    const words = t.toLowerCase().split(/\s+/);
                    words.forEach((w: string) => {
                      const clean = w.replace(/^[^\w]+|[^\w]+$/g, "");
                      if (FILLER_WORDS.includes(clean)) {
                        fillerCountRef.current++;
                      }
                    });
                    setState((s) => {
                      const last = s.transcript[s.transcript.length - 1];
                      if (last && last.role === "user" && last.text === t) {
                        return s;
                      }
                      return {
                        ...s,
                        transcript: [...s.transcript, { role: "user", text: t, ts: Date.now() }],
                      };
                    });
                  }
                }
              }
            };
            
            recognition.onerror = () => { /* ignore */ };
            
            try {
              recognition.start();
              recognitionRef.current = recognition;
            } catch (e) {
              /* ignore */
            }
          }
        }

        // 4. Video tracking loop (Local MediaPipe + Upstream Gemini)
        if (enableVideo && stream.getVideoTracks().length > 0) {
          const canvas = document.createElement("canvas");
          canvas.width = 640;
          canvas.height = 480;
          canvasRef.current = canvas;

          frameIntervalRef.current = window.setInterval(() => {
            if (myGen !== connectGenerationRef.current) return;
            const video = videoRef.current;
            if (!video || video.readyState < 2) return;

            // MediaPipe Tracking
            if (landmarkerRef.current) {
              const results = landmarkerRef.current.detectForVideo(video, performance.now());
              if (results.faceLandmarks && results.faceLandmarks.length > 0) {
                const landmarks = results.faceLandmarks[0];
                const blendshapes = results.faceBlendshapes?.[0]?.categories || [];

                const nose = landmarks[1];
                let posture: InterviewMetrics["posture"] = "good";
                if (nose.y > 0.7) posture = "slouching";
                else if (Math.abs(nose.x - 0.5) > 0.2) posture = "tilted";

                const prevN = lastNoseRef.current;
                let move = 0;
                if (prevN) move = Math.hypot(nose.x - prevN.x, nose.y - prevN.y);
                lastNoseRef.current = { x: nose.x, y: nose.y };
                movementEmaRef.current = movementEmaRef.current * 0.82 + move * 0.18;
                let fidget: InterviewMetrics["fidget_level"] = "calm";
                if (movementEmaRef.current > 0.02) fidget = "fidgeting";
                else if (movementEmaRef.current > 0.011) fidget = "moderate";

                const lookLeft = blendshapes.find((c) => c.categoryName === "eyeLookInLeft")?.score || 0;
                const lookRight = blendshapes.find((c) => c.categoryName === "eyeLookOutLeft")?.score || 0;
                const eyeContact =
                  lookLeft < 0.32 && lookRight < 0.32
                    ? Math.round(Math.min(96, 72 + (0.32 - Math.max(lookLeft, lookRight)) * 120))
                    : 46;

                const smile = blendshapes.find((c) => c.categoryName === "jawOpen")?.score || 0;
                const browUp = blendshapes.find((c) => c.categoryName === "browInnerUp")?.score || 0;
                let expression: InterviewMetrics["expression"] = "neutral";
                if (smile > 0.42) expression = "smiling";
                else if (browUp > 0.38) expression = "tense";

                const nFaces = results.faceLandmarks.length;
                const now = Date.now();
                let integrityUpdate: string | null | undefined;
                if (nFaces > 1 && now - lastIntegrityFaceRef.current > 12000) {
                  lastIntegrityFaceRef.current = now;
                  integrityUpdate =
                    "More than one face is visible — please stay alone on camera for a fair interview.";
                }

                setState((s) => {
                  const prev = s.metrics;
                  const tick: InterviewMetrics = {
                    eye_contact_pct: prev?.eye_contact_pct ?? 70,
                    posture: prev?.posture ?? "good",
                    expression: prev?.expression ?? "neutral",
                    smile_count_last_min: prev?.smile_count_last_min ?? 0,
                    fidget_level: prev?.fidget_level ?? "calm",
                    self_touch_events_last_min: prev?.self_touch_events_last_min ?? 0,
                    speaking_pace_wpm: prev?.speaking_pace_wpm ?? 0,
                    filler_count_last_min: prev?.filler_count_last_min ?? 0,
                    filler_total: prev?.filler_total ?? 0,
                    coaching_tip: prev?.coaching_tip ?? null,
                    multiple_faces_visible: prev?.multiple_faces_visible,
                    non_candidate_speech_heard: prev?.non_candidate_speech_heard,
                    timestamp: now,
                  };
                  tick.eye_contact_pct = eyeContact;
                  tick.posture = posture;
                  tick.expression = expression;
                  tick.fidget_level = fidget;
                  tick.smile_count_last_min =
                    (prev?.smile_count_last_min || 0) + (expression === "smiling" ? 1 : 0);
                  tick.filler_count_last_min = fillerCountRef.current;
                  tick.filler_total = fillerCountRef.current;

                  return {
                    ...s,
                    integrityNote: integrityUpdate !== undefined ? integrityUpdate : s.integrityNote,
                    metrics: tick,
                    metricsHistory: [...s.metricsHistory, tick].slice(-60),
                    confidenceScore: computeConfidence(tick),
                  };
                });
              }
            }

            // Upstream Gemini Video
            if (ws.readyState === WebSocket.OPEN && sendAudioRef.current) {
              const ctx2d = canvas.getContext("2d");
              if (ctx2d) {
                ctx2d.drawImage(video, 0, 0, 640, 480);
                canvas.toBlob((blob) => {
                  if (myGen !== connectGenerationRef.current || !blob || ws.readyState !== WebSocket.OPEN) return;
                  const reader = new FileReader();
                  reader.onloadend = () => {
                    const result = reader.result as string;
                    const b64 = result.split(",")[1];
                    if (b64 && myGen === connectGenerationRef.current && ws.readyState === WebSocket.OPEN) {
                      ws.send(JSON.stringify({ type: "video", data: b64 }));
                    }
                  };
                  reader.readAsDataURL(blob);
                }, "image/jpeg", 0.6);
              }
            }
          }, 1000);
        }

        // 5. Set up message handler
        ws.onmessage = (ev) => {
          if (myGen !== connectGenerationRef.current) return;
          const msg = JSON.parse(ev.data);

          switch (msg.type) {
            case "audio":
              if (pipelineRef.current && myGen === connectGenerationRef.current) {
                feedPlayback(
                  pipelineRef.current.playbackNode,
                  msg.data,
                  typeof msg.mimeType === "string" ? msg.mimeType : undefined,
                );
              }
              break;

            case "playback_clear":
              if (pipelineRef.current && myGen === connectGenerationRef.current) {
                clearPlayback(pipelineRef.current.playbackNode);
              }
              interviewerSpeakingRef.current = false;
              setState((s) => ({ ...s, isInterviewerSpeaking: false }));
              break;

            case "turn_end":
              interviewerSpeakingRef.current = false;
              setState((s) => ({ ...s, isInterviewerSpeaking: false }));
              break;

            case "transcript":
              if (myGen !== connectGenerationRef.current) return;
              setState((s) => ({
                ...s,
                transcript: [
                  ...s.transcript,
                  {
                    role: msg.role as "model" | "user",
                    text: msg.text,
                    ts: Date.now(),
                  },
                ],
              }));
              break;

            case "metrics": {
              if (myGen !== connectGenerationRef.current) return;
              const remoteMetrics = msg.data as InterviewMetrics;
              setState((s) => {
                const merged = (s.metrics
                  ? { ...s.metrics, ...remoteMetrics }
                  : remoteMetrics) as InterviewMetrics;
                let note = s.integrityNote;
                if (remoteMetrics.multiple_faces_visible) {
                  note =
                    "The interviewer model detects more than one person on camera. Please stay alone in frame.";
                }
                if (remoteMetrics.non_candidate_speech_heard) {
                  note = note
                    ? `${note} Possible non-candidate speech was heard.`
                    : "Possible non-candidate speech was detected — keep the room quiet and speak for yourself only.";
                }
                return {
                  ...s,
                  metrics: merged,
                  integrityNote: note,
                  confidenceScore: computeConfidence(merged),
                };
              });
              break;
            }

            case "error":
              setState((s) => ({
                ...s,
                error: msg.message,
                status: "error",
              }));
              break;
          }
        };

        ws.onclose = () => {
          if (myGen !== connectGenerationRef.current) return;
          setState((s) => {
            if (s.status === "active" || s.status === "calibrating") {
              return { ...s, status: "ended" };
            }
            return s;
          });
        };

        // 6. Calibration period
        setState((s) => ({
          ...s,
          status: "calibrating",
          cameraError: cameraErrorMsg,
          liveGeminiVoice,
          liveModel,
          contextApplied,
          briefingChars,
          hasResumeText,
        }));
        calibrationTimerRef.current = window.setTimeout(() => {
          if (myGen !== connectGenerationRef.current) return;
          sendAudioRef.current = true;
          setState((s) => ({ ...s, status: "active" }));
          calibrationTimerRef.current = null;
        }, 2000) as unknown as number;
      } catch (err: any) {
        setState((s) => ({
          ...s,
          status: "error",
          error: err?.message || "Connection failed",
          cameraError: null,
        }));
      }
    },
    [],
  );

  const resumeAudio = useCallback(async () => {
    const p = pipelineRef.current;
    if (p?.ctx?.state === "suspended") {
      await p.ctx.resume().catch(() => {});
    }
  }, []);

  const setMicMuted = useCallback((muted: boolean) => {
    micMutedRef.current = muted;
    const p = pipelineRef.current;
    if (!p?.micStream) return;
    for (const t of p.micStream.getAudioTracks()) {
      t.enabled = !muted;
    }
  }, []);

  const signalUserTurnEnd = useCallback(() => {
    const w = wsRef.current;
    if (!w || w.readyState !== WebSocket.OPEN || !sendAudioRef.current) return;
    try {
      w.send(JSON.stringify({ type: "audio_stream_end" }));
      w.send(JSON.stringify({ type: "turn_complete" }));
    } catch {
      /* ignore */
    }
    lastUserTurnSignalAtRef.current = Date.now();
  }, []);

  const disconnect = useCallback(() => {
    connectGenerationRef.current += 1;
    sendAudioRef.current = false;
    videoTrackCleanupRef.current?.();
    videoTrackCleanupRef.current = null;
    if (calibrationTimerRef.current) {
      clearTimeout(calibrationTimerRef.current);
      calibrationTimerRef.current = null;
    }
    if (frameIntervalRef.current) {
      clearInterval(frameIntervalRef.current);
      frameIntervalRef.current = null;
    }
    if (vadIntervalRef.current) {
      clearInterval(vadIntervalRef.current);
      vadIntervalRef.current = null;
    }
    try {
      vadSourceRef.current?.disconnect();
    } catch {
      /* ignore */
    }
    vadSourceRef.current = null;
    const ws = wsRef.current;
    if (ws && ws.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify({ type: "end_session" }));
      ws.close();
    }
    wsRef.current = null;
    if (pipelineRef.current) {
      pipelineRef.current.close();
      pipelineRef.current = null;
    }
    if (mediaStreamRef.current) {
      mediaStreamRef.current.getTracks().forEach((t) => t.stop());
      mediaStreamRef.current = null;
    }
    if (videoRef.current) {
      videoRef.current.srcObject = null;
    }
    if (recorderRef.current && recorderRef.current.state !== "inactive") {
      try {
        recorderRef.current.stop();
      } catch {
        /* ignore */
      }
    }
    setState((s) => ({ ...s, status: "ended", cameraError: null, integrityNote: null }));
  }, []);

  const clearPlaybackBuffer = useCallback(() => {
    if (pipelineRef.current) {
      clearPlayback(pipelineRef.current.playbackNode);
    }
  }, []);

  const setCameraEnabled = useCallback((enabled: boolean) => {
    const t = mediaStreamRef.current?.getVideoTracks()[0];
    if (t) t.enabled = enabled;
  }, []);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      connectGenerationRef.current += 1;
      sendAudioRef.current = false;
      videoTrackCleanupRef.current?.();
      videoTrackCleanupRef.current = null;
      if (calibrationTimerRef.current) clearTimeout(calibrationTimerRef.current);
      if (frameIntervalRef.current) clearInterval(frameIntervalRef.current);
      if (vadIntervalRef.current) {
        clearInterval(vadIntervalRef.current);
        vadIntervalRef.current = null;
      }
      try {
        vadSourceRef.current?.disconnect();
      } catch {
        /* ignore */
      }
      vadSourceRef.current = null;
      if (pipelineRef.current) pipelineRef.current.close();
      if (mediaStreamRef.current) {
        mediaStreamRef.current.getTracks().forEach((t) => t.stop());
        mediaStreamRef.current = null;
      }
      if (recorderRef.current && recorderRef.current.state !== "inactive") {
        recorderRef.current.stop();
      }
      const ws = wsRef.current;
      if (ws && ws.readyState === WebSocket.OPEN) ws.close();
    };
  }, []);

  return {
    state,
    connect,
    disconnect,
    setVideoElement,
    clearPlaybackBuffer,
    resumeAudio,
    setMicMuted,
    getRecordingBlobs,
    flushRecording,
    signalUserTurnEnd,
    setCameraEnabled,
  };
}
