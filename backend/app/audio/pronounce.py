"""Compare a child's spoken word with native-speaker recordings of it.

Features: MFCCs (25 ms frames, 10 ms hop, 26 mel bands, coefficients 1-12, cepstral mean normalisation)
plus their deltas. Alignment: dynamic time warping, so speaking slowly or quickly is not a mistake.

A child's voice is far higher than an adult's, so the raw distance to a native recording means little on its
own. The score is relative instead: is the child's word closer to the native recordings of THIS word than to
native recordings of OTHER words (distractors)? 100 = clearly the target word, 50 = no better than another
word, 0 = closer to the others. It is an estimate of how close the pronunciation is, kept next to the speech
recogniser's result, and shown with that caveat; room noise and microphones affect it.
"""
from __future__ import annotations

import numpy as np

RATE = 16000
N_FFT, HOP, WIN = 512, 160, 400
N_MELS, N_CEPS = 26, 12


def _mel_filters(rate: int = RATE, n_fft: int = N_FFT, n_mels: int = N_MELS) -> np.ndarray:
    mel = lambda f: 2595 * np.log10(1 + f / 700)  # noqa: E731
    inv = lambda m: 700 * (10 ** (m / 2595) - 1)  # noqa: E731
    pts = inv(np.linspace(mel(60), mel(rate / 2 * 0.9), n_mels + 2))
    bins = np.floor((n_fft + 1) * pts / rate).astype(int)
    fb = np.zeros((n_mels, n_fft // 2 + 1))
    for i in range(1, n_mels + 1):
        a, b, c = bins[i - 1], bins[i], bins[i + 1]
        if b > a:
            fb[i - 1, a:b] = (np.arange(a, b) - a) / (b - a)
        if c > b:
            fb[i - 1, b:c] = (c - np.arange(b, c)) / (c - b)
    return fb


_FB = _mel_filters()
_DCT = np.cos(np.pi / N_MELS * (np.arange(N_MELS)[None, :] + 0.5) * np.arange(N_CEPS + 1)[:, None])


def features(x: np.ndarray) -> np.ndarray:
    """(frames, 24) MFCC + delta features of speech frames (silence dropped)."""
    x = np.asarray(x, dtype=np.float32)
    if len(x) < WIN:
        x = np.pad(x, (0, WIN - len(x)))
    x = np.append(x[0], x[1:] - 0.97 * x[:-1])  # pre-emphasis
    n = 1 + (len(x) - WIN) // HOP
    idx = np.arange(WIN)[None, :] + HOP * np.arange(n)[:, None]
    frames = x[idx] * np.hamming(WIN)
    power = np.abs(np.fft.rfft(frames, N_FFT)) ** 2 / N_FFT
    energy = power.sum(axis=1)
    keep = energy > max(energy.max() * 1e-3, 1e-10) if energy.size else np.array([], bool)
    if keep.sum() >= 5:
        power = power[keep]
    logmel = np.log(np.maximum(power @ _FB.T, 1e-10))
    ceps = (logmel @ _DCT.T)[:, 1:N_CEPS + 1]
    ceps -= ceps.mean(axis=0)  # cepstral mean normalisation: removes microphone and room colouring
    delta = np.gradient(ceps, axis=0) if len(ceps) > 1 else np.zeros_like(ceps)
    return np.hstack([ceps, delta])


def dtw(a: np.ndarray, b: np.ndarray) -> float:
    """Average frame distance along the best alignment (lower = more alike)."""
    if len(a) == 0 or len(b) == 0:
        return float("inf")
    # cosine-like distance on standardised features keeps loud and quiet voices comparable
    sa = a / (np.linalg.norm(a, axis=1, keepdims=True) + 1e-9)
    sb = b / (np.linalg.norm(b, axis=1, keepdims=True) + 1e-9)
    cost = 1 - sa @ sb.T
    n, m = cost.shape
    band = max(abs(n - m) + 2, int(0.4 * max(n, m)))  # Sakoe-Chiba band: no absurd stretching
    acc = np.full((n + 1, m + 1), np.inf)
    acc[0, 0] = 0
    for i in range(1, n + 1):
        lo, hi = max(1, i - band), min(m, i + band)
        for j in range(lo, hi + 1):
            acc[i, j] = cost[i - 1, j - 1] + min(acc[i - 1, j], acc[i, j - 1], acc[i - 1, j - 1])
    return float(acc[n, m] / (n + m))


def score(child: np.ndarray, targets: list[np.ndarray], distractors: list[np.ndarray]) -> dict:
    """0-100 closeness of the child's word to the native recordings of the target word.
    `targets`: native recordings of the word; `distractors`: native recordings of other words."""
    fc = features(child)
    if len(fc) < 5 or not targets:
        return {"score": None, "reason": "too short or no reference"}
    dt = min(dtw(fc, features(t)) for t in targets)
    dd = min(dtw(fc, features(d)) for d in distractors) if distractors else dt * 1.35  # the nearest other word
    if not np.isfinite(dt) or not np.isfinite(dd) or dd <= 0:
        return {"score": None, "reason": "could not compare"}
    rel = (dd - dt) / dd  # > 0: closer to the target word than to other words
    s = float(np.clip(50 + 250 * rel, 0, 100))
    return {"score": round(s, 1), "target_distance": round(dt, 4), "other_distance": round(dd, 4), "method": "MFCC + DTW vs native speakers"}
