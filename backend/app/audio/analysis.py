"""Offline practice-recording analysis (pure numpy).

Pipeline: WAV decode → mono 16 kHz float → frame RMS + YIN pitch → note segmentation →
song identification (transposition-invariant local alignment) → accuracy / rhythm / hesitation
metrics → recurring-mistake mining → progress comparison.

All judgements carry a `reliable` flag: if the signal is too quiet, too noisy or not pitched
enough, we report "could not hear clearly" instead of inventing mistakes.
"""
from __future__ import annotations

import io
import wave
from collections import Counter
from dataclasses import dataclass

import numpy as np

from ..curriculum import SONGS

TARGET_SR = 16_000
FRAME = 1024
HOP = 256
FMIN, FMAX = 65.0, 1600.0
YIN_THRESHOLD = 0.15
NOTE_NAMES = ["C", "C#", "D", "D#", "E", "F", "F#", "G", "G#", "A", "A#", "B"]


class AudioError(ValueError):
    pass


def midi_name(m: int) -> str:
    return f"{NOTE_NAMES[m % 12]}{m // 12 - 1}"


# --- decoding --------------------------------------------------------------------------------
def decode_wav(data: bytes) -> tuple[np.ndarray, int]:
    """Decode PCM WAV (8/16/24/32-bit int) into mono float32 in [-1, 1]."""
    try:
        with wave.open(io.BytesIO(data), "rb") as w:
            ch, width, sr, n = w.getnchannels(), w.getsampwidth(), w.getframerate(), w.getnframes()
            raw = w.readframes(n)
    except (wave.Error, EOFError) as exc:
        raise AudioError("Please upload a PCM WAV file (the in-app recorder produces this automatically).") from exc
    if ch < 1 or ch > 8 or sr < 8000 or sr > 192_000:
        raise AudioError("Unsupported WAV format")
    if width == 1:
        x = (np.frombuffer(raw, dtype=np.uint8).astype(np.float32) - 128.0) / 128.0
    elif width == 2:
        x = np.frombuffer(raw, dtype="<i2").astype(np.float32) / 32768.0
    elif width == 3:
        b = np.frombuffer(raw, dtype=np.uint8).reshape(-1, 3).astype(np.int32)
        v = b[:, 0] | (b[:, 1] << 8) | (b[:, 2] << 16)
        v = np.where(v & 0x800000, v - 0x1000000, v)
        x = v.astype(np.float32) / 8388608.0
    elif width == 4:
        x = np.frombuffer(raw, dtype="<i4").astype(np.float32) / 2147483648.0
    else:
        raise AudioError("Unsupported WAV sample width")
    if ch > 1:
        x = x[: len(x) - len(x) % ch].reshape(-1, ch).mean(axis=1)
    return x, sr


def resample(x: np.ndarray, sr: int, target: int = TARGET_SR) -> np.ndarray:
    if sr == target or len(x) == 0:
        return x.astype(np.float32)
    # Anti-alias with a moving-average low-pass before linear interpolation when downsampling.
    if sr > target:
        k = int(np.ceil(sr / target))
        if k > 1:
            x = np.convolve(x, np.ones(k, dtype=np.float32) / k, mode="same")
    n_out = int(round(len(x) * target / sr))
    t_out = np.linspace(0, len(x) - 1, n_out)
    return np.interp(t_out, np.arange(len(x)), x).astype(np.float32)


# --- features --------------------------------------------------------------------------------
def frame_signal(x: np.ndarray) -> np.ndarray:
    if len(x) < FRAME:
        x = np.pad(x, (0, FRAME - len(x)))
    n = 1 + (len(x) - FRAME) // HOP
    idx = np.arange(FRAME)[None, :] + HOP * np.arange(n)[:, None]
    return x[idx]


def yin_pitch(frames: np.ndarray, sr: int = TARGET_SR) -> tuple[np.ndarray, np.ndarray]:
    """Vectorised YIN. Returns (f0 Hz or 0, aperiodicity 0..1) per frame."""
    tau_min = int(sr / FMAX)
    tau_max = min(int(sr / FMIN), FRAME // 2)
    W = FRAME - tau_max
    f0 = np.zeros(len(frames), dtype=np.float32)
    ap = np.ones(len(frames), dtype=np.float32)
    nfft = 1 << int(np.ceil(np.log2(FRAME + W)))
    for start in range(0, len(frames), 2048):  # batch to bound memory on 10-minute files
        fr = frames[start:start + 2048].astype(np.float64)
        # difference function d(tau) = r(0) terms - 2 * cross-correlation, via FFT
        win = fr[:, :W]
        F = np.fft.rfft(fr, nfft)
        Fw = np.fft.rfft(win, nfft)
        cross = np.fft.irfft(F * np.conj(Fw), nfft)[:, : tau_max + 1]
        sq = np.cumsum(np.pad(fr ** 2, ((0, 0), (1, 0))), axis=1)
        energy_w = sq[:, W] - sq[:, 0]
        taus = np.arange(tau_max + 1)
        energy_shift = sq[:, taus + W] - sq[:, taus]
        d = energy_w[:, None] + energy_shift - 2 * cross
        d[:, 0] = 0
        cum = np.cumsum(d[:, 1:], axis=1)
        cmnd = np.ones_like(d)
        cmnd[:, 1:] = d[:, 1:] * taus[1:][None, :] / np.maximum(cum, 1e-12)
        seg = cmnd[:, tau_min:tau_max]
        below = seg < YIN_THRESHOLD
        has = below.any(axis=1)
        first = np.where(has, below.argmax(axis=1), seg.argmin(axis=1))
        # walk to the local minimum after the first threshold crossing
        rows = np.arange(len(seg))
        for _ in range(8):
            nxt = np.minimum(first + 1, seg.shape[1] - 1)
            better = seg[rows, nxt] < seg[rows, first]
            first = np.where(better, nxt, first)
        tau = first + tau_min
        # parabolic interpolation
        t0 = np.clip(tau - 1, 1, tau_max)
        t2 = np.clip(tau + 1, 1, tau_max)
        a, b, c = cmnd[rows, t0], cmnd[rows, tau], cmnd[rows, t2]
        denom = a - 2 * b + c
        shift = np.where(np.abs(denom) > 1e-9, 0.5 * (a - c) / denom, 0.0)
        tau_f = tau + np.clip(shift, -1, 1)
        f0[start:start + len(fr)] = np.where(tau_f > 0, sr / tau_f, 0)
        ap[start:start + len(fr)] = np.clip(b, 0, 1)
    return f0, ap


@dataclass
class Note:
    midi: int
    start: float
    end: float
    conf: float

    @property
    def dur(self) -> float:
        return self.end - self.start


def segment_notes(f0: np.ndarray, ap: np.ndarray, rms: np.ndarray, sr: int = TARGET_SR) -> tuple[list[Note], float, float]:
    hop_s = HOP / sr
    noise = float(np.percentile(rms, 10)) if len(rms) else 0.0
    peak = float(np.percentile(rms, 98)) if len(rms) else 0.0
    gate = max(noise * 3.0, peak * 0.08, 1e-3)
    voiced = (f0 > 0) & (ap < 0.3) & (rms > gate)
    midi = np.where(voiced, np.round(69 + 12 * np.log2(np.maximum(f0, 1e-6) / 440.0)), -1).astype(int)
    # median-smooth MIDI over 5 frames to remove octave blips
    if len(midi) >= 5:
        pad = np.pad(midi, 2, mode="edge")
        stack = np.stack([pad[i:i + len(midi)] for i in range(5)])
        midi = np.median(stack, axis=0).astype(int)
    # onset strength: positive RMS flux, used to split repeated same-pitch notes
    flux = np.maximum(0, np.diff(rms, prepend=rms[:1] if len(rms) else 0))
    onset_thr = max(float(np.percentile(flux, 95)) if len(flux) else 0, gate * 0.5)
    notes: list[Note] = []
    cur_m, cur_s, confs = -1, 0, []
    for i, m in enumerate(midi):
        is_onset = flux[i] > onset_thr and i - cur_s > 3
        if m != cur_m or (m >= 0 and is_onset):
            if cur_m >= 0 and (i - cur_s) * hop_s >= 0.06:
                notes.append(Note(int(cur_m), cur_s * hop_s, i * hop_s, float(1 - np.mean(confs))))
            cur_m, cur_s, confs = m, i, []
        if m >= 0:
            confs.append(float(ap[i]))
    if cur_m >= 0 and (len(midi) - cur_s) * hop_s >= 0.06:
        notes.append(Note(int(cur_m), cur_s * hop_s, len(midi) * hop_s, float(1 - np.mean(confs))))
    notes = [n for n in notes if 21 <= n.midi <= 108]
    snr_db = 20 * np.log10(max(peak, 1e-6) / max(noise, 1e-6))
    voiced_ratio = float(voiced.mean()) if len(voiced) else 0.0
    return notes, voiced_ratio, float(snr_db)


# --- musical comparison ----------------------------------------------------------------------
def _intervals(seq: list[int]) -> list[int]:
    return [b - a for a, b in zip(seq, seq[1:])]


def _smith_waterman(T: list[int], P: list[int]) -> tuple[int, list[tuple[int | None, int | None]]]:
    match, mismatch, gap = 2, -1, -1
    n, m = len(T), len(P)
    H = np.zeros((n + 1, m + 1), dtype=np.int32)
    for i in range(1, n + 1):
        ti = T[i - 1]
        prev, cur = H[i - 1], H[i]
        for j in range(1, m + 1):
            v = prev[j - 1] + (match if ti == P[j - 1] else mismatch)
            up = prev[j] + gap
            left = cur[j - 1] + gap
            cur[j] = max(0, v, up, left)
    i, j = np.unravel_index(int(np.argmax(H)), H.shape)
    best = int(H[i, j])
    path: list[tuple[int | None, int | None]] = []
    while i > 0 and j > 0 and H[i, j] > 0:
        if H[i, j] == H[i - 1, j - 1] + (match if T[i - 1] == P[j - 1] else mismatch):
            path.append((i - 1, j - 1)); i -= 1; j -= 1
        elif H[i, j] == H[i - 1, j] + gap:
            path.append((i - 1, None)); i -= 1
        else:
            path.append((None, j - 1)); j -= 1
    path.reverse()
    return best, path


MAX_ALIGN_NOTES = 400  # bound CPU on long recordings; the best take is usually early or repeated


def local_align(target: list[int], played: list[int]) -> tuple[int, float, list[tuple[int | None, int | None]]]:
    """Transposition-invariant local alignment on pitch classes.

    Returns (raw score, coverage 0..1 of the target, path). The transposition is searched over
    the 4 most plausible shifts (by pitch-class overlap) rather than assumed.
    """
    if not target or not played:
        return 0, 0.0, []
    played = played[:MAX_ALIGN_NOTES]
    T = [t % 12 for t in target]
    tset = set(T)
    shifts = sorted(range(12), key=lambda s: -sum(((p + s) % 12) in tset for p in played))[:4]
    if 0 not in shifts:
        shifts.append(0)
    best = (-1, 0.0, [])
    for sh in shifts:
        raw, path = _smith_waterman(T, [(p + sh) % 12 for p in played])
        if raw > best[0]:
            best = (raw, raw / (2 * len(T)), path)
    return best


def identify_song(played: list[int], hint: str | None = None) -> dict:
    """Pick the song with the highest *raw* alignment score (longer true matches win over a
    short song matching a fragment); confidence is the fraction of that song covered."""
    results = []
    for sid, song in SONGS.items():
        target = [n for n, _ in song["notes"]]
        raw, cov, path = local_align(target, played)
        results.append((raw * (1.1 if sid == hint else 1.0), sid, cov, path))
    results.sort(key=lambda r: r[0], reverse=True)
    _, sid, cov, path = results[0]
    return {"song_id": sid, "title": SONGS[sid]["title"], "confidence": round(min(1.0, cov), 3), "_path": path}


def rhythm_stability(notes: list[Note]) -> float | None:
    """1.0 = perfectly even inter-onset intervals relative to the nearest musical subdivision."""
    if len(notes) < 4:
        return None
    onsets = np.array([n.start for n in notes])
    ioi = np.diff(onsets)
    ioi = ioi[(ioi > 0.08) & (ioi < 3.0)]
    if len(ioi) < 3:
        return None
    beat = float(np.median(ioi))
    ratios = ioi / beat
    # quantise to musically plausible ratios (half, one, one-and-a-half, double)
    grid = np.array([0.5, 1.0, 1.5, 2.0, 3.0, 4.0])
    nearest = grid[np.abs(ratios[:, None] - grid[None, :]).argmin(axis=1)]
    dev = np.abs(ratios - nearest) / nearest
    return round(float(np.clip(1.0 - 2.0 * np.median(dev), 0, 1)), 3)


def analyze_recording(data: bytes, song_hint: str | None = None, max_seconds: int = 600) -> dict:
    x, sr = decode_wav(data)
    duration = len(x) / sr
    if duration < 1.0:
        raise AudioError("Recording is shorter than 1 second")
    if duration > max_seconds + 1:
        raise AudioError(f"Recording is longer than {max_seconds // 60} minutes")
    x = resample(x, sr)
    x = x - float(np.mean(x))
    frames = frame_signal(x)
    rms = np.sqrt(np.mean(frames.astype(np.float64) ** 2, axis=1))
    f0, ap = yin_pitch(frames)
    notes, voiced_ratio, snr_db = segment_notes(f0, ap, rms)

    reliable = len(notes) >= 4 and snr_db >= 12 and voiced_ratio >= 0.05
    out: dict = {
        "duration_seconds": round(duration, 1),
        "notes_detected": len(notes),
        "voiced_ratio": round(voiced_ratio, 3),
        "snr_db": round(snr_db, 1),
        "reliable": bool(reliable),
        "notes": [{"midi": n.midi, "start": round(n.start, 2), "dur": round(n.dur, 2)} for n in notes[:600]],
    }
    if not notes:
        out.update({"instrument_guess": {"label": "unknown", "confidence": 0.0}, "song_match": None, "note_accuracy": None,
                    "rhythm_stability": None, "tempo_bpm": None, "recurring_mistakes": [], "hesitations": 0, "reliable": False})
        return out

    out["instrument_guess"] = _instrument_guess(notes, rms)
    played = [n.midi for n in notes]
    match = identify_song(played, song_hint)
    path = match.pop("_path")
    out["song_match"] = match if match["confidence"] >= 0.35 else {"song_id": None, "title": None, "confidence": match["confidence"]}

    if out["song_match"].get("song_id"):
        target = [n for n, _ in SONGS[match["song_id"]]["notes"]]
        aligned = [(ti, pj) for ti, pj in path if ti is not None]
        correct = sum(1 for ti, pj in aligned if pj is not None and (played[pj] - target[ti]) % 12 == _mode_offset(path, played, target))
        out["note_accuracy"] = round(correct / max(1, len(aligned)), 3)
        out["recurring_mistakes"] = _recurring_mistakes(path, played, target)
    else:
        out["note_accuracy"] = None
        out["recurring_mistakes"] = []

    out["rhythm_stability"] = rhythm_stability(notes)
    iois = np.diff([n.start for n in notes])
    iois = iois[(iois > 0.15) & (iois < 2.0)]
    out["tempo_bpm"] = round(60.0 / float(np.median(iois)), 0) if len(iois) >= 3 else None
    med = float(np.median(iois)) if len(iois) else 0.5
    out["hesitations"] = int(sum(1 for a, b in zip(notes, notes[1:]) if b.start - a.end > max(1.0, 2.5 * med)))
    return out


def _mode_offset(path, played, target) -> int:
    offs = Counter((played[pj] - target[ti]) % 12 for ti, pj in path if ti is not None and pj is not None)
    return offs.most_common(1)[0][0] if offs else 0


def _recurring_mistakes(path, played, target) -> list[dict]:
    off = _mode_offset(path, played, target)
    subs: Counter = Counter()
    missed: Counter = Counter()
    for ti, pj in path:
        if ti is None:
            continue
        expected = target[ti]
        if pj is None:
            missed[expected] += 1
        elif (played[pj] - expected) % 12 != off:
            subs[(expected, (played[pj] - off) % 12)] += 1
    out = []
    for (exp, got_pc), c in subs.most_common(3):
        if c >= 2:
            out.append({"kind": "substitution", "count": c, "expected_name": NOTE_NAMES[exp % 12],
                        "description": f"{NOTE_NAMES[exp % 12]} was often played as {NOTE_NAMES[got_pc]} ({c} times)."})
    for exp, c in missed.most_common(2):
        if c >= 2:
            out.append({"kind": "skipped", "count": c, "expected_name": NOTE_NAMES[exp % 12],
                        "description": f"The note {NOTE_NAMES[exp % 12]} was sometimes skipped ({c} times)."})
    return out


def _instrument_guess(notes: list[Note], rms: np.ndarray) -> dict:
    """Coarse, honest family guess from envelope shape: decaying (keyboard/guitar) vs sustained."""
    hop_s = HOP / TARGET_SR
    decays = []
    for n in notes[:200]:
        a, b = int(n.start / hop_s), int(n.end / hop_s)
        seg = rms[a:b]
        if len(seg) >= 6:
            head = float(np.max(seg[: max(2, len(seg) // 4)]))
            tail = float(np.mean(seg[-max(2, len(seg) // 4):]))
            decays.append(tail / max(head, 1e-9))
    if not decays:
        return {"label": "unknown", "confidence": 0.0}
    r = float(np.median(decays))
    if r < 0.55:
        return {"label": "keyboard", "confidence": round(min(0.9, 0.5 + (0.55 - r)), 2)}
    return {"label": "sustained (voice / violin / flute)", "confidence": round(min(0.8, 0.4 + (r - 0.55)), 2)}


def synth_wav(notes: list[tuple[int, float]], bpm: float = 100, sr: int = TARGET_SR, noise: float = 0.0, seed: int = 0) -> bytes:
    """Render a simple decaying-tone melody as WAV bytes (used by tests and the demo)."""
    rng = np.random.default_rng(seed)
    beat = 60.0 / bpm
    chunks = []
    for midi, beats in notes:
        dur = beats * beat
        t = np.arange(int(dur * sr)) / sr
        f = 440.0 * 2 ** ((midi - 69) / 12)
        env = np.exp(-3.0 * t) * np.minimum(1, t / 0.005)
        tone = 0.5 * env * (np.sin(2 * np.pi * f * t) + 0.3 * np.sin(4 * np.pi * f * t))
        gap = int(0.03 * sr)
        tone[-gap:] = 0
        chunks.append(tone)
    y = np.concatenate(chunks) if chunks else np.zeros(sr)
    if noise:
        y = y + noise * rng.standard_normal(len(y))
    pcm = (np.clip(y, -1, 1) * 32767).astype("<i2")
    buf = io.BytesIO()
    with wave.open(buf, "wb") as w:
        w.setnchannels(1); w.setsampwidth(2); w.setframerate(sr); w.writeframes(pcm.tobytes())
    return buf.getvalue()
