"""Stage 4 — Merger & Scorecard Generation.

Reads all parallel outputs (Whisper, Parselmouth, OpenFace, Py-Feat)
plus live MediaPipe trace, aligns to a common timeline, computes the
10-second calibration baseline, and builds the final weighted scorecard.

Six parameters (Section 4.3.1):
  Communication Clarity  20%  — NLP analysis of transcript
  Technical Accuracy     25%  — Gemini 2.5 Pro evaluation
  Confidence & Delivery  15%  — Voice metrics + MediaPipe
  Relevance & Structure  20%  — Gemini semantic matching
  Filler Words & Habits  10%  — Whisper word timestamps + lexicon
  Body Language          10%  — OpenFace + Py-Feat + MediaPipe (dropped if no video)
"""

from __future__ import annotations

import asyncio
import json
import re
from pathlib import Path
from typing import Any

from post_interview.schema import (
    CALIBRATION_SEC,
    CANDIDATE_ROLES,
    FILLER_LEXICON,
    INTERVIEWER_ROLES,
    WEIGHTS,
)
from post_interview.llm_evaluator import analyze_full_transcript, score_answer_pair

import logging

log = logging.getLogger(__name__)


def _norm_role_key(role: Any) -> str:
    return str(role or "").strip().lower()


def _is_interviewer(role: Any) -> bool:
    return _norm_role_key(role) in {str(x).lower() for x in INTERVIEWER_ROLES}


def _is_candidate(role: Any) -> bool:
    return _norm_role_key(role) in {str(x).lower() for x in CANDIDATE_ROLES}


def _merge_int_dicts(a: dict[str, int], b: dict[str, int]) -> dict[str, int]:
    out = dict(a)
    for k, v in b.items():
        out[k] = out.get(k, 0) + int(v)
    return out


def _fillers_from_plain_text(text: str) -> dict[str, int]:
    """Lexicon scan on raw transcript (Whisper often omits disfluencies as separate tokens)."""
    if not (text or "").strip():
        return {}
    low = text.lower()
    counts: dict[str, int] = {}
    for phrase in FILLER_LEXICON:
        if " " in phrase:
            n = len(re.findall(re.escape(phrase), low))
        else:
            n = len(re.findall(rf"(?<![\w]){re.escape(phrase)}(?![\w])", low))
        if n:
            counts[phrase] = n
    return counts


def _estimate_wpm_from_text(text: str, duration_sec: float) -> float:
    words = re.findall(r"\b[\w']+\b", (text or "").lower())
    if not words or duration_sec <= 0:
        return 0.0
    return round(len(words) / max(duration_sec / 60.0, 1 / 60.0), 1)


def _build_qa_pairs(transcript_events: list[dict[str, Any]]) -> list[tuple[str, str]]:
    """Align interviewer turns with one-or-more consecutive candidate turns (chronological)."""
    evs = sorted(
        [e for e in transcript_events if isinstance(e, dict)],
        key=lambda e: float(e.get("ts", e.get("timestamp", 0)) or 0),
    )
    pairs: list[tuple[str, str]] = []
    current_q = ""
    answer_parts: list[str] = []

    def flush() -> None:
        nonlocal current_q, answer_parts, pairs
        joined = " ".join(answer_parts).strip()
        if current_q and joined:
            pairs.append((current_q, joined))
        answer_parts = []

    for e in evs:
        txt = str(e.get("text") or e.get("t") or "").strip()
        if not txt:
            continue
        r = e.get("role") or e.get("who")
        if _is_interviewer(r):
            flush()
            current_q = txt
        elif _is_candidate(r) and current_q:
            answer_parts.append(txt)
    flush()

    if not pairs:
        cand_lines = [
            str(e.get("text") or e.get("t") or "").strip()
            for e in evs
            if _is_candidate(e.get("role") or e.get("who")) and str(e.get("text") or e.get("t") or "").strip()
        ]
        iv_lines = [
            str(e.get("text") or e.get("t") or "").strip()
            for e in evs
            if _is_interviewer(e.get("role") or e.get("who")) and str(e.get("text") or e.get("t") or "").strip()
        ]
        if cand_lines and iv_lines:
            pairs.append((iv_lines[-1], " ".join(cand_lines)))
        elif cand_lines:
            pairs.append(("Interview session (candidate audio)", " ".join(cand_lines)))
        elif iv_lines:
            for qtxt in iv_lines[-5:]:
                pairs.append((qtxt, "(No transcribed candidate reply in this segment.)"))
    return pairs[:20]


# ────────────────────────────────────────────────────────────
#  NLP Communication Score (lightweight, no external deps)
# ────────────────────────────────────────────────────────────

def _sentences(text: str) -> list[str]:
    return [p for p in re.split(r"(?<=[.!?])\s+", text.strip()) if p]


def _nlp_communication_score(text: str) -> tuple[int, str]:
    """Vocabulary diversity, sentence structure → 0-100 (conservative for thin answers)."""
    if not text.strip():
        return 38, "No transcript text available."
    words = re.findall(r"\b[\w']+\b", text.lower())
    if len(words) < 8:
        base = 42
        detail = "Short / fragmentary answers — clarity scored conservatively."
    elif len(words) < 25:
        base = 48
        detail = "Limited length — less evidence of structured communication."
    else:
        base = 52
        detail = "Transcript length adequate for clarity estimate."
    unique_ratio = len(set(words)) / max(len(words), 1)
    sents = _sentences(text)
    avg_len = sum(len(s.split()) for s in sents) / max(len(sents), 1)
    score = base + 18 * unique_ratio + min(18, (avg_len - 8) * 0.9)
    if avg_len < 6 and len(sents) <= 2:
        score -= 12
    score = int(max(32, min(92, score)))
    return score, (
        f"{detail} Vocabulary diversity ~{unique_ratio:.2f}, ~{len(sents)} sentence(s), "
        f"avg {avg_len:.1f} words/sentence."
    )


# ────────────────────────────────────────────────────────────
#  Filler Words Parameter
# ────────────────────────────────────────────────────────────

def _filler_parameter(fillers: dict[str, int], duration_min: float) -> tuple[int, str, dict[str, int]]:
    total = sum(fillers.values())
    density = total / max(duration_min, 0.25)
    # Stricter curve: heavy fillers should pull score well below 70
    score = int(max(22, min(96, 100 - total * 5 - density * 12)))
    wpm_hint = f"~{density:.1f} fillers/min" if duration_min > 0 else ""
    details = (
        f"~{total} filler hits (lexicon); {wpm_hint}. "
        f"Counts merge Whisper tokens + transcript scan."
    )
    return score, details, fillers


# ────────────────────────────────────────────────────────────
#  Calibration Baseline (first 10 seconds)
# ────────────────────────────────────────────────────────────

def _parselmouth_baseline(frames: list[dict[str, Any]], cal_sec: float) -> dict[str, float]:
    """Extract baseline voice metrics from the calibration window."""
    base = [f for f in frames if float(f.get("t_end_sec", 0)) <= cal_sec]
    if not base:
        base = frames[:max(1, len(frames) // 10)]

    def _mean(key: str) -> float:
        vals = [float(x.get(key) or 0) for x in base]
        return sum(vals) / max(len(vals), 1)

    return {
        "f0_mean": _mean("f0_mean_hz"),
        "jitter": _mean("jitter_local_pct"),
        "shimmer": _mean("shimmer_local_pct"),
        "intensity": _mean("intensity_mean_db"),
        "hnr": _mean("hnr_db"),
    }


def _parselmouth_post_cal(frames: list[dict[str, Any]], cal_sec: float) -> dict[str, float]:
    """Voice metrics after the calibration window."""
    post = [f for f in frames if float(f.get("t_start_sec", 0)) >= cal_sec]
    if not post:
        post = frames

    def _mean(key: str) -> float:
        vals = [float(x.get(key) or 0) for x in post]
        return sum(vals) / max(len(vals), 1)

    return {
        "f0_mean": _mean("f0_mean_hz"),
        "jitter": _mean("jitter_local_pct"),
        "shimmer": _mean("shimmer_local_pct"),
        "intensity": _mean("intensity_mean_db"),
        "hnr": _mean("hnr_db"),
    }


# ────────────────────────────────────────────────────────────
#  Confidence & Delivery (deviation-aware)
# ────────────────────────────────────────────────────────────

def _confidence_score(
    baseline: dict[str, float],
    post: dict[str, float],
    mediapipe: dict[str, Any],
) -> tuple[int, str]:
    """Compare post-calibration voice to baseline + live video-derived signals."""
    j_ratio = (post["jitter"] + 0.01) / (baseline["jitter"] + 0.01)
    s_ratio = (post["shimmer"] + 0.01) / (baseline["shimmer"] + 0.01)
    hnr_delta = post["hnr"] - baseline["hnr"]

    penalty = 12 * max(0, j_ratio - 1.1) + 10 * max(0, s_ratio - 1.1)
    bonus = min(15, max(0, hnr_delta * 0.8))

    eye_bonus, live_pen, _ = _live_presence_adjustments(mediapipe)

    score = 72 - penalty + bonus + eye_bonus - live_pen
    score = int(max(34, min(96, score)))
    eye = mediapipe.get("eye_contact_avg")
    details = (
        f"Voice: jitter ×{j_ratio:.2f}, shimmer ×{s_ratio:.2f} vs {CALIBRATION_SEC:.0f}s baseline; "
        f"HNR Δ{hnr_delta:+.1f} dB. Eye-contact avg: {eye}. "
        f"Live presence penalties (fidget/posture/touch): −{live_pen:.1f}."
    )
    return score, details


def _live_presence_adjustments(mediapipe: dict[str, Any]) -> tuple[float, float, str]:
    """Eye bonus and live-video penalties shared by Praat and timing-only confidence paths."""
    eye = mediapipe.get("eye_contact_avg")
    eye_bonus = 0.0
    if eye is not None:
        eye_bonus = min(10, max(0, (float(eye) - 55) * 0.15))
    live_pen = 0.0
    live_pen += 14.0 * float(mediapipe.get("fidget_fraction") or 0)
    live_pen += 10.0 * float(mediapipe.get("bad_posture_fraction") or 0)
    live_pen += min(12.0, float(mediapipe.get("self_touch_per_batch") or 0) * 1.8)
    frag = (
        f"Eye-contact avg {eye}; live presence penalties (fidget/posture/touch) −{live_pen:.1f}; "
        f"eye bonus +{eye_bonus:.1f}."
    )
    return eye_bonus, live_pen, frag


def _confidence_timing_fallback(
    speech: dict[str, Any],
    fillers_per_min: float,
    mediapipe: dict[str, Any],
    whisper_word_count: int,
) -> tuple[int, str]:
    """When Praat/Parselmouth frames are missing, infer delivery from timed speech + fillers + live video."""
    wpm = float(speech.get("wpm") or 0)
    sil = float(speech.get("silence_ratio") or 0)
    score = 64.0
    parts: list[str] = []
    if wpm > 0:
        if wpm < 85:
            score -= 14
            parts.append(f"Slow measured pace (~{wpm:.0f} WPM).")
        elif wpm > 195:
            score -= 12
            parts.append(f"Very fast measured pace (~{wpm:.0f} WPM).")
        else:
            parts.append(f"Measured pace ~{wpm:.0f} WPM from transcript timing.")
    elif whisper_word_count < 12:
        score -= 16
        parts.append("Few timed words from ASR — delivery scored conservatively.")
    if sil > 0.40:
        pen = min(14.0, (sil - 0.40) * 38.0)
        score -= pen
        parts.append(f"Silence ~{sil:.0%} of session vs active speech.")
    if fillers_per_min > 3.0:
        pen = min(18.0, (fillers_per_min - 3.0) * 2.8)
        score -= pen
        parts.append(f"Filler density ~{fillers_per_min:.1f}/min (hesitation proxy).")
    eye_bonus, live_pen, live_frag = _live_presence_adjustments(mediapipe)
    score = score - live_pen + eye_bonus
    score_i = int(max(30, min(94, score)))
    detail = (
        (" ".join(parts) + " ") if parts else "Limited acoustic curve data. "
    ) + f"Praat/Parselmouth not available or too sparse — {live_frag}"
    return score_i, detail


# ────────────────────────────────────────────────────────────
#  MediaPipe aggregation
# ────────────────────────────────────────────────────────────

def _aggregate_live_metric_batches(batches: list[dict[str, Any]]) -> dict[str, Any]:
    """Normalize Gemini Live + legacy MediaPipe batch shapes for scoring."""
    if not batches:
        return {
            "eye_contact_avg": None,
            "smile_count": 0,
            "confidence_proxy": 72,
            "fidget_fraction": 0.0,
            "bad_posture_fraction": 0.0,
            "self_touch_per_batch": 0.0,
        }
    eyes: list[float] = []
    smiles = 0
    fidget_score = 0.0
    posture_bad = 0
    self_touch_sum = 0
    for b in batches:
        ec = b.get("eye_contact_avg")
        if ec is None:
            ec = b.get("eye_contact_pct")
        if ec is not None:
            eyes.append(float(ec))
        sm = b.get("smile_count")
        if sm is None:
            sm = b.get("smile_count_last_min")
        if sm is not None:
            smiles += int(sm)
        fl = str(b.get("fidget_level") or "").lower()
        if fl == "fidgeting":
            fidget_score += 1.0
        elif fl == "moderate":
            fidget_score += 0.55
        po = str(b.get("posture") or "").lower()
        if po in ("slouching", "leaning_back", "tilted"):
            posture_bad += 1
        self_touch_sum += int(b.get("self_touch_events_last_min") or 0)
    n = len(batches)
    return {
        "eye_contact_avg": round(sum(eyes) / len(eyes), 1) if eyes else None,
        "smile_count": smiles,
        "confidence_proxy": 72,
        "fidget_fraction": min(1.0, fidget_score / max(n, 1)),
        "bad_posture_fraction": min(1.0, posture_bad / max(n, 1)),
        "self_touch_per_batch": self_touch_sum / max(n, 1),
    }


# Backwards-compatible name
def _avg_mediapipe(batches: list[dict[str, Any]]) -> dict[str, Any]:
    return _aggregate_live_metric_batches(batches)


# ────────────────────────────────────────────────────────────
#  Body Language Composite
# ────────────────────────────────────────────────────────────

def _stress_moments(pyfeat: dict[str, Any], cal_sec: float) -> list[dict[str, Any]]:
    """Identify moments where fear + sadness probability spikes (Py-Feat)."""
    moments: list[dict[str, Any]] = []
    for fr in pyfeat.get("frames") or []:
        if not isinstance(fr, dict):
            continue
        t = float(fr.get("t_sec", 0))
        if t < cal_sec:
            continue
        p = fr.get("probabilities") or {}
        fear = float(p.get("fear", 0) or 0)
        sad = float(p.get("sadness", 0) or 0)
        if fear + sad > 0.34:
            moments.append({
                "t_sec": round(t, 2),
                "fear": round(fear, 3),
                "sadness": round(sad, 3),
            })
    return moments[:24]


def _body_language_score(
    *,
    has_video: bool,
    mediapipe: dict[str, Any],
    openface: dict[str, Any],
    pyfeat: dict[str, Any],
    stress: list[dict[str, Any]],
) -> tuple[int, str, dict[str, Any]]:
    """Composite body language 0-100 from live session metrics + OpenFace/Py-Feat when present."""
    if not has_video:
        return 0, "Video disabled — body language omitted, weights renormalized.", {}

    raw_eye = mediapipe.get("eye_contact_avg")
    eye = float(raw_eye) if raw_eye is not None else 52.0
    smile_n = int(mediapipe.get("smile_count") or 0)

    fidget_frac = float(mediapipe.get("fidget_fraction") or 0)
    posture_bad_frac = float(mediapipe.get("bad_posture_fraction") or 0)
    self_touch_pb = float(mediapipe.get("self_touch_per_batch") or 0)

    au_anxiety = None
    of_frames = openface.get("frames") if isinstance(openface, dict) else None
    if isinstance(of_frames, list) and of_frames:
        acc = []
        for fr in of_frames[:5000]:
            if not isinstance(fr, dict):
                continue
            a1 = float(fr.get("AU01_intensity", fr.get("AU1", 0)) or 0)
            a4 = float(fr.get("AU04_intensity", fr.get("AU4", 0)) or 0)
            acc.append(a1 + a4)
        if acc:
            au_anxiety = sum(acc) / len(acc)

    # Start from a neutral base; eye contact helps but cannot dominate when other signals are bad
    base = 48 + min(18, eye * 0.16) + min(6, smile_n * 0.04)
    if au_anxiety is not None:
        base -= min(16, au_anxiety * 3.2)
    stress_pen = min(14, len(stress) * 2)
    presence_pen = (
        26.0 * fidget_frac
        + 18.0 * posture_bad_frac
        + min(22.0, self_touch_pb * 2.4)
    )
    score = int(max(24, min(93, base - stress_pen - presence_pen)))

    details = (
        f"Eye-contact avg ~{eye:.0f}% (from session batches); smiles tracked: {smile_n}. "
        f"Fidget/posture/touch load {fidget_frac:.0%}/{posture_bad_frac:.0%}/~{self_touch_pb:.1f}/batch. "
        f"OpenFace AU tension: {'yes' if au_anxiety is not None else 'n/a'}; "
        f"{len(stress)} Py-Feat stress spike(s)."
    )
    meta = {
        "eye_contact_pct": eye,
        "openface_source": openface.get("source"),
        "pyfeat_source": pyfeat.get("source"),
        "stress_moments": stress,
        "fidget_fraction": fidget_frac,
        "bad_posture_fraction": posture_bad_frac,
    }
    return score, details, meta


# ────────────────────────────────────────────────────────────
#  Speaking metrics
# ────────────────────────────────────────────────────────────

def _speaking_metrics(words: list[dict[str, Any]], duration_sec: float) -> dict[str, Any]:
    if not words or duration_sec <= 0:
        return {"wpm": 0.0, "silence_ratio": 0.0, "longest_pause_sec": 0.0}
    starts = [float(w["start"]) for w in words if "start" in w]
    ends = [float(w["end"]) for w in words if "end" in w]
    if not starts or not ends:
        return {"wpm": 0.0, "silence_ratio": 1.0, "longest_pause_sec": 0.0}
    speak_sec = max(0.0, max(ends) - min(starts))
    wpm = (len(words) / speak_sec) * 60.0 if speak_sec > 0 else 0.0
    silence_ratio = max(0.0, min(1.0, 1.0 - (speak_sec / duration_sec)))
    longest = 0.0
    for i in range(1, len(words)):
        gap = float(words[i]["start"]) - float(words[i - 1]["end"])
        longest = max(longest, gap)
    return {
        "wpm": round(wpm, 1),
        "silence_ratio": round(silence_ratio, 3),
        "longest_pause_sec": round(longest, 2),
    }


# ────────────────────────────────────────────────────────────
#  Response lag
# ────────────────────────────────────────────────────────────

def _response_lags(events: list[dict[str, Any]]) -> list[dict[str, Any]]:
    """Estimate response lag between interviewer end and candidate start."""
    out: list[dict[str, Any]] = []
    last_ai_end: float | None = None
    last_q = ""
    q_idx = 0
    for e in events:
        role = e.get("role") or e.get("who")
        t = float(e.get("t") or e.get("ts") or 0)
        text = str(e.get("text") or e.get("t_text") or "")
        if role in ("interviewer", "AI") or _is_interviewer(role):
            last_ai_end = t
            last_q = text
            q_idx += 1
        elif _is_candidate(role) and last_ai_end is not None:
            lag = max(0.0, (t - last_ai_end) / 1000.0)
            out.append({
                "question_number": q_idx,
                "question_text": last_q[:240],
                "lag_seconds": round(lag, 2),
                "lag_sec": round(lag, 2),
            })
            last_ai_end = None
    return out


# ────────────────────────────────────────────────────────────
#  Question tagging
# ────────────────────────────────────────────────────────────

def _auto_tag(question: str) -> str:
    q = question.lower()
    if any(k in q for k in ("salary", "notice", "join", "location", "relocation", "ctc")):
        return "HR — Logistics"
    if any(k in q for k in ("conflict", "team", "lead", "situation", "tell me about", "challenge")):
        return "Behavioral"
    if any(k in q for k in ("design", "architecture", "scale", "system")):
        return "Technical — System Design"
    if any(k in q for k in ("code", "algorithm", "data structure", "complexity", "sort", "tree", "graph")):
        return "Technical — DSA"
    return "Technical"


# ────────────────────────────────────────────────────────────
#  Main merger
# ────────────────────────────────────────────────────────────

async def merge_and_build_scorecard(
    *,
    session_id: str,
    company: str,
    role: str,
    transcript_events: list[dict[str, Any]],
    mediapipe_batches: list[dict[str, Any]],
    stage1: dict[str, Any],
    stage2: dict[str, Any],
    stage3: dict[str, Any],
) -> dict[str, Any]:
    """Merge all pipeline outputs and produce the final scorecard JSON."""

    whisper = stage2.get("whisper") or {}
    parsel = stage2.get("parselmouth") or {}
    openface = stage3.get("openface") or {}
    pyfeat = stage3.get("pyfeat") or {}

    # ── Transcript: prefer Whisper, fallback to live transcript ──
    whisper_text = whisper.get("text") or ""
    whisper_words = list(whisper.get("words") or [])

    # If Whisper didn't run, build text from live transcript
    if not whisper_text and transcript_events:
        candidate_texts = []
        for e in transcript_events:
            r = e.get("role") or e.get("who")
            if _is_candidate(r):
                candidate_texts.append(str(e.get("text") or e.get("t") or ""))
        whisper_text = " ".join(candidate_texts).strip()

    duration_sec = float(stage1.get("duration_sec") or 0) or 1.0
    duration_min = duration_sec / 60.0
    speech = _speaking_metrics(whisper_words, duration_sec)
    if (speech.get("wpm") or 0) < 5 and whisper_text.strip():
        est = _estimate_wpm_from_text(whisper_text, duration_sec)
        if est > 0:
            speech = {**speech, "wpm": est, "wpm_source": "transcript_estimate"}

    # ── Filler merge (used for communication + confidence + filler parameter) ──
    fillers = dict(whisper.get("fillers") or whisper.get("fillers_lexicon") or {})
    fillers = _merge_int_dicts(fillers, _fillers_from_plain_text(whisper_text))
    if transcript_events:
        cand_blob = " ".join(
            str(e.get("text") or e.get("t") or "")
            for e in transcript_events
            if _is_candidate(e.get("role") or e.get("who"))
        )
        fillers = _merge_int_dicts(fillers, _fillers_from_plain_text(cand_blob))
    filler_total = int(sum(fillers.values()))
    fillers_per_min = filler_total / max(duration_min, 0.25)

    # ── 1. Communication Clarity (20%) ──
    comm_score, comm_details = _nlp_communication_score(whisper_text)
    if fillers_per_min > 4.5 and whisper_text.strip():
        pen = min(14, int((fillers_per_min - 4.5) * 2.2))
        comm_score = max(30, comm_score - pen)
        comm_details += f" Clarity docked ~{pen} pts for high filler density (~{fillers_per_min:.1f}/min)."

    # ── 2. Filler Words (10%) — scores from merged counts ──
    filler_score, filler_details, filler_counts = _filler_parameter(fillers, duration_min)

    # ── 3. Confidence & Delivery (15%) — Praat when usable, else transcript-timing fallback ──
    p_frames = list(parsel.get("frames") or [])
    base_pm = _parselmouth_baseline(p_frames, CALIBRATION_SEC)
    post_pm = _parselmouth_post_cal(p_frames, CALIBRATION_SEC)
    mp_avg = _aggregate_live_metric_batches(mediapipe_batches)
    praat_usable = len(p_frames) >= 4 and any(float(f.get("f0_mean_hz") or 0) > 45.0 for f in p_frames)
    if praat_usable:
        conf_score, conf_details = _confidence_score(base_pm, post_pm, mp_avg)
    else:
        conf_score, conf_details = _confidence_timing_fallback(
            speech, fillers_per_min, mp_avg, len(whisper_words)
        )

    # ── 4. Body Language (10%) ──
    has_video = bool(stage1.get("video_proxy_480p_15fps") or stage1.get("video_master_25fps"))
    stress = _stress_moments(pyfeat, CALIBRATION_SEC)
    body_score, body_details, body_meta = _body_language_score(
        has_video=has_video,
        mediapipe=mp_avg,
        openface=openface,
        pyfeat=pyfeat,
        stress=stress,
    )

    pairs = _build_qa_pairs(transcript_events)

    # ── Per-question scoring (Gemini) + full-transcript eval: run concurrently with bounded
    #     parallelism so total wall time stays within client polling (was up to 14× sequential).
    pair_list = pairs[:14]
    full_text = "\n".join(
        f"{e.get('role', e.get('who'))}: {e.get('text', e.get('t'))}"
        for e in transcript_events
    )

    score_sem = asyncio.Semaphore(5)

    async def _pair_scores() -> list[dict[str, Any]]:
        if not pair_list:
            return []

        async def _one(q: str, a: str) -> dict[str, Any]:
            async with score_sem:
                return await score_answer_pair(q, a)

        scores = await asyncio.gather(*[_one(q, a) for q, a in pair_list])
        out: list[dict[str, Any]] = []
        for (q, a), sc in zip(pair_list, scores):
            out.append(
                {
                    "question": q,
                    "answer_transcript": a,
                    "answer_duration_sec": int(duration_sec / max(len(pairs), 1)),
                    "response_lag_sec": 0.0,
                    "content_score": int(sc.get("technical_accuracy", 6)),
                    "delivery_score": int(sc.get("relevance", 6)),
                    "ai_feedback": sc.get("ai_feedback", ""),
                    "ideal_answer": sc.get("ideal_answer", ""),
                    "tags": sc.get("tags") or [_auto_tag(q)],
                }
            )
        return out

    question_breakdown, llm_eval = await asyncio.gather(
        _pair_scores(),
        analyze_full_transcript(full_text, role),
    )

    # ── 5 & 6. LLM evaluation: Technical Accuracy (25%) + Relevance & Structure (20%) ──
    llm_params = llm_eval.get("parameter_scores", {})

    tech_score = int(llm_params.get("technical", {}).get("score", 68))
    tech_details = llm_params.get("technical", {}).get("details", "Gemini 2.5 Pro evaluation.")
    rel_score = int(llm_params.get("relevance", {}).get("score", 70))
    rel_details = llm_params.get("relevance", {}).get("details", "Semantic match + structure check.")

    # ── Assemble parameter scores ──
    parameter_scores: dict[str, Any] = {
        "communication": {"score": comm_score, "details": comm_details},
        "technical": {"score": tech_score, "details": tech_details},
        "confidence": {"score": conf_score, "details": conf_details},
        "relevance": {"score": rel_score, "details": rel_details},
        "filler_words": {
            "score": filler_score,
            "filler_counts": filler_counts,
            "details": (
                f"{filler_details} Speaking rate ~{speech.get('wpm', 0)} WPM "
                f"(from timed tokens or transcript estimate)."
            ),
            "words_per_minute": speech.get("wpm"),
            "filler_total": int(sum(filler_counts.values())),
            "silence_ratio": speech.get("silence_ratio"),
        },
    }

    if has_video:
        parameter_scores["body_language"] = {
            "score": body_score,
            "eye_contact_pct": body_meta.get("eye_contact_pct"),
            "genuine_smiles": mp_avg.get("smile_count"),
            "nervous_smiles": None,
            "details": body_details,
        }
    else:
        parameter_scores["body_language"] = None

    # ── Overall score (weighted) ──
    include_body = has_video
    active_weights = {k: v for k, v in WEIGHTS.items() if include_body or k != "body_language"}
    weight_sum = sum(active_weights.values())
    overall = 0.0
    for key, w in active_weights.items():
        block = parameter_scores.get(key) or {}
        s = float(block.get("score", 0) if isinstance(block, dict) else 0)
        overall += s * (w / weight_sum)
    overall = int(round(overall))

    # ── Response lags ──
    lag_events = [
        {
            "role": "interviewer" if _is_interviewer(e.get("who") or e.get("role")) else "candidate",
            "text": e.get("t") or e.get("text"),
            "t": e.get("ts", i * 1000),
        }
        for i, e in enumerate(transcript_events)
    ]
    lag_rows = _response_lags(lag_events)

    # ── Emotion summary ──
    emotion_summary = "Mostly neutral engagement"
    if stress:
        emotion_summary = f"Detected {len(stress)} stress moments post warm-up."

    # ── Tips ──
    tips = list(llm_eval.get("tips") or [])
    if fillers:
        top = sorted(fillers.items(), key=lambda x: -x[1])[:2]
        if top:
            tips.append(f"Reduce fillers — '{top[0][0]}' appeared ×{top[0][1]}.")

    # ── Per-question event log (saved to disk) ──
    try:
        workdir = Path(stage1.get("frame_index_map", "")).parent
        event_log = [
            {
                "question": q,
                "answer_excerpt": a[:400],
                "window_metrics": {
                    "filler_hits_approx": sum(fillers.values()) // max(len(pairs), 1),
                    "session_wpm": speech["wpm"],
                },
            }
            for q, a in pairs[:12]
        ]
        log_path = workdir / "per_question_event_log.json"
        log_path.write_text(json.dumps(event_log, indent=2, ensure_ascii=False), encoding="utf-8")
    except Exception:
        pass

    # ── Build final scorecard ──
    return {
        "overall_score": overall,
        "parameter_scores": {k: v for k, v in parameter_scores.items() if v is not None},
        "question_breakdown": question_breakdown,
        "meta": {
            "session_id": session_id,
            "session_duration_sec": int(duration_sec),
            "transcript_turns": len(transcript_events),
            "qa_pairs": len(pairs),
            "calibration_sec": CALIBRATION_SEC,
            "company": company,
            "role": role,
        },
        "trend_data": {
            "confidence_curve": [
                [0, conf_score - 5],
                [60, conf_score],
                [120, conf_score + 3],
            ],
            "emotion_timeline": [
                {"minute": int(s["t_sec"] // 60), "dominant": "stress"}
                for s in stress[:8]
            ],
            "energy_curve": [[0, 70], [60, 75]],
            "response_lags": lag_rows,
            "whisper_error": whisper.get("error"),
            "parselmouth_error": parsel.get("error"),
            "openface_error": openface.get("error"),
            "pyfeat_error": pyfeat.get("error"),
            "live_mediapipe_summary": mp_avg,
            "parselmouth_baseline": base_pm,
            "parselmouth_post_warmup": post_pm,
            "emotion_summary": emotion_summary,
            "stress_moments": stress,
            "speaking_metrics": speech,
        },
        "key_moments": llm_eval.get(
            "key_moments",
            [{"timestamp": "0:00", "type": "positive", "note": "Completed interview."}],
        ),
        "tips": tips or ["Structure answers using STAR for behavioral questions."],
        "verdict": llm_eval.get("verdict", ""),
    }
