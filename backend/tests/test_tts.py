"""Synthetic voices: a word without any native recording is never silent, Sanskrit is spelt for a Hindi voice,
parents' own phrases never go to an online voice, and synthetic clips never become pronunciation references."""
from pathlib import Path

import pytest

from app.config import get_settings
from app.lang import native_audio as na
from app.lang import tts
from app.routers.native import public_refs

from .conftest import register


def test_sanskrit_visarga_is_spoken_with_its_echo_vowel():
    f = tts.sanskrit_for_hindi_voice
    assert f("मार्जारः") == "मार्जारह"  # maarjaarah
    assert f("शुभरात्रिः") == "शुभरात्रिहि"  # i echoes i
    assert f("शनैः") == "शनैहि"  # ai echoes i
    assert f("गुरुः") == "गुरुहु"
    assert f("दुःखम्") == "दुह्खम्"  # inside a word: only h
    assert f("नमस्ते") == "नमस्ते"  # nothing to change


def test_custom_ids_are_not_words_that_start_with_c():
    assert tts.is_custom("c0123456789ab") and na._custom("c0123456789ab")
    assert not tts.is_custom("cat") and not na._custom("cat")


def test_every_language_has_a_voice_for_each_gender_where_one_exists():
    from app.lang.content import TARGETS

    for code in TARGETS:
        genders = {v.gender for v in tts.VOICES[code]}
        assert "female" in genders, code
    assert tts.VOICES["sa"][0].engine == "parler"  # the only model that speaks Sanskrit natively comes first
    assert any(v.sanskrit for v in tts.VOICES["sa"])


@pytest.fixture()
def fake_engine(monkeypatch):
    """An online voice without the network: writes a small fake MP3."""
    calls = []

    def say(text, v, out: Path):
        calls.append((text, v.name))
        out.write_bytes(b"ID3" + b"\0" * 2000)

    monkeypatch.setattr(tts, "engine_ready", lambda e: e in ("edge", "gtts"))
    monkeypatch.setattr(tts, "_say_edge", say)
    monkeypatch.setattr(tts, "_say_gtts", say)
    return calls


def test_word_without_native_recording_gets_neural_voices(client, fake_engine):
    refs = public_refs("mr", "p_name_q")
    assert {r["gender"] for r in refs} == {"female", "male"}
    assert all(r["origin"] == "tts" and r["url"].startswith("/api/learn/tts/mr/p_name_q/") for r in refs)
    register(client)
    r = client.get(refs[0]["url"])
    assert r.status_code == 200 and r.content.startswith(b"ID3")
    # recorded once, then served from the cache as a plain file
    assert len(fake_engine) == 1
    assert any(x["url"].startswith("/api/learn/native-file/d/mr/") for x in public_refs("mr", "p_name_q"))
    # never a pronunciation reference
    assert na.references(get_settings().data_dir, "mr", "p_name_q") == []


def test_sanskrit_sent_to_hindi_voice_with_fixes(client, fake_engine):
    tts.ensure(get_settings().data_dir, "sa", "p_name_q", "female")
    text, voice = fake_engine[-1]
    assert voice.startswith("hi-IN") and "ः" not in text
    assert public_refs("sa", "p_name_q")[0]["approx"] == "Hindi voice reading Sanskrit"


def test_parents_phrases_never_go_online(client, fake_engine):
    with pytest.raises(tts.Unavailable):
        tts.ensure(get_settings().data_dir, "en", "c0123456789ab", "female")
    assert fake_engine == []
    register(client)
    assert client.get("/api/learn/tts/en/c0123456789ab/female").status_code == 404


def test_offline_means_no_voice_not_an_error(client, monkeypatch):
    monkeypatch.setattr(tts, "engine_ready", lambda e: False)
    assert public_refs("kn", "p_bye") == []  # the page then uses the device voice, then Melo's own voice
    register(client)
    assert client.get("/api/learn/tts/kn/p_bye/female").status_code == 503


# --- Piper: openly licensed offline voices -------------------------------------------------------------
NON_COMMERCIAL = ("NC", "non-commercial", "Non-commercial", "unknown", "Unknown", "See URL", "AGPL")


def test_piper_voices_are_only_openly_licensed_ones():
    for lang, voices in tts.PIPER.items():
        for v in voices:
            assert v.engine == "piper" and v.licence, (lang, v)
            assert not any(bad in v.licence for bad in NON_COMMERCIAL), (lang, v)
            assert any(ok in v.licence for ok in ("CC0", "CC BY", "public domain", "Unlicense", "Apache")), (lang, v)
            assert tts.piper_model_path(v.name) is None or tts.piper_model_path(v.name).suffix == ".onnx"
    # excluded on purpose (non-commercial or unclear data licences)
    names = {v.name for vs in tts.PIPER.values() for v in vs}
    assert not names & {"hi_IN-pratham-medium", "hi_IN-priyamvada-medium", "en_US-ryan-medium", "en_US-amy-medium", "tr_TR-dfki-medium"}


def test_piper_comes_first_and_takes_turns_between_speakers():
    order = tts.voice_order("en", "female", "p_hello")
    assert order[0].engine == "piper" and order[-1].engine == "edge"
    firsts = {tts.voice_order("en", "male", f"w{i}")[0].name for i in range(40)}
    assert len(firsts) >= 3  # different words are read by different people
    assert tts.voice_order("en", "male", "w1")[0] == tts.voice_order("en", "male", "w1")[0]  # but always the same one per word
    assert tts.voice_order("hi", "female", "x")[0].engine == "edge"  # no licensed Piper voice for Hindi yet


def test_piper_credit_names_the_voice_and_its_licence():
    v = tts.PIPER["fr"][2]
    assert tts.credit(v) == "Piper voice Upmc 2 (synthetic; voice data CC BY-SA 4.0 (UPMC))"
    assert tts.credit(tts.VOICES["hi"][0]).startswith("Microsoft")


def test_piper_model_names_are_checked_before_any_download():
    assert tts.piper_model_path("../../etc/passwd", download=True) is None
    assert tts.piper_model_path("en_US-kathleen-medium") is None  # not downloaded in the test data folder


def test_live_lessons_skip_piper_voices_that_are_not_downloaded(monkeypatch):
    monkeypatch.setattr(tts, "engine_ready", lambda e: e in ("edge", "piper"))
    assert all(v.engine == "edge" for v in tts._live_voices("en", "female", "p_hello"))
