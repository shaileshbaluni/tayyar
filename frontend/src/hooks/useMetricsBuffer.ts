import { useCallback, useEffect, useRef } from "react";
import type { MetricsSummary } from "../types/interview";

const INTERVAL_MS = 30_000;

export function useMetricsBuffer(sessionId: string | null) {
  const buf = useRef<MetricsSummary[]>([]);

  const flush = useCallback(async () => {
    if (!sessionId || buf.current.length === 0) return;
    const payload = aggregate(buf.current);
    buf.current = [];
    try {
      await fetch(`/api/v1/sessions/${sessionId}/metrics-batch`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
    } catch {
      /* offline */
    }
  }, [sessionId]);

  useEffect(() => {
    if (!sessionId) return;
    const id = window.setInterval(() => {
      void flush();
    }, INTERVAL_MS);
    return () => window.clearInterval(id);
  }, [sessionId, flush]);

  const push = useCallback((m: MetricsSummary) => {
    buf.current.push(m);
  }, []);

  return { push, flush };
}

function aggregate(rows: MetricsSummary[]): MetricsSummary {
  if (!rows.length) return { timestamp: Date.now() };
  const avg = (key: keyof MetricsSummary) => {
    const nums = rows.map((r) => r[key]).filter((v): v is number => typeof v === "number");
    if (!nums.length) return 0;
    return Math.round(nums.reduce((a, b) => a + b, 0) / nums.length);
  };
  const sum = (key: keyof MetricsSummary) =>
    rows.reduce((a, r) => a + (typeof r[key] === "number" ? (r[key] as number) : 0), 0);
  return {
    timestamp: Date.now(),
    eye_contact_avg: avg("eye_contact_avg"),
    posture_avg: avg("posture_avg"),
    smile_count: sum("smile_count"),
    nod_count: sum("nod_count"),
    fidget_avg: avg("fidget_avg"),
    gesture_count: sum("gesture_count"),
  };
}
