import io
import wave

import numpy as np
import pytest

from app.audio.analysis import AudioError, analyze_recording, decode_wav, synth_wav
from app.curriculum import SONGS


def test_identifies_song_and_scores_clean_take():
    a = analyze_recording(synth_wav([tuple(n) for n in SONGS["twinkle"]["notes"]], bpm=100, noise=0.003))
    assert a["reliable"]
    assert a["song_match"]["song_id"] == "twinkle"
    assert a["note_accuracy"] >= 0.95
    assert a["rhythm_stability"] >= 0.8
    assert a["instrument_guess"]["label"] == "keyboard"


def test_transposed_take_still_matches():
    notes = [(m + 5, b) for m, b in SONGS["mary_lamb"]["notes"]]
    a = analyze_recording(synth_wav(notes, bpm=110))
    assert a["song_match"]["song_id"] == "mary_lamb" and a["note_accuracy"] >= 0.9


def test_recurring_mistake_detected():
    notes = [(m if m != 65 else 64, b) for m, b in SONGS["twinkle"]["notes"]]  # F played as E
    a = analyze_recording(synth_wav(notes, bpm=100))
    assert a["song_match"]["song_id"] == "twinkle"
    assert any(m["expected_name"] == "F" for m in a["recurring_mistakes"])
    assert a["note_accuracy"] < 0.9


def test_noise_only_is_not_reliable():
    rng = np.random.default_rng(1)
    pcm = (rng.standard_normal(16000 * 3) * 0.05 * 32767).astype("<i2")
    buf = io.BytesIO()
    with wave.open(buf, "wb") as w:
        w.setnchannels(1); w.setsampwidth(2); w.setframerate(16000); w.writeframes(pcm.tobytes())
    a = analyze_recording(buf.getvalue())
    assert a["reliable"] is False


def test_stereo_44k_decodes():
    mono = np.sin(2 * np.pi * 440 * np.arange(44100) / 44100) * 0.4
    st = np.stack([mono, mono], axis=1).reshape(-1)
    buf = io.BytesIO()
    with wave.open(buf, "wb") as w:
        w.setnchannels(2); w.setsampwidth(2); w.setframerate(44100); w.writeframes((st * 32767).astype("<i2").tobytes())
    x, sr = decode_wav(buf.getvalue())
    assert sr == 44100 and len(x) == 44100


def test_rejects_non_wav():
    with pytest.raises(AudioError):
        decode_wav(b"not a wav file at all")
