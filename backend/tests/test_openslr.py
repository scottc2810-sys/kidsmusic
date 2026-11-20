"""Sentences read by native speakers from Google's OpenSLR sets: only the needed clips are downloaded."""
import http.server
import io
import threading
import zipfile

import numpy as np
import pytest

from app.config import get_settings
from app.db import session_factory
from app.lang import growth, native_audio as na, openslr
from app.models import Child
from tests.conftest import make_child, register
from tests.test_growth import _master


def _voice(seconds=1.2, f0=200.0, rate=48000) -> bytes:
    t = np.arange(int(seconds * rate)) / rate
    x = 0.4 * np.sin(2 * np.pi * f0 * t) * np.hanning(len(t))
    pad = np.zeros(int(0.3 * rate))
    return na.encode_wav(np.concatenate([pad, x, pad]).astype(np.float32), rate)


LINES = {
    "esf_00001_0001": "El gato es azul",  # 4 known words: usable offline
    "esm_00002_0002": "El gato es azul",  # the same sentence by a man: a second voice
    "esf_00003_0003": "La factura del banco vence hoy",  # adult content: needs the AI teacher's check
    "esm_00004_0004": "Llegamos a las 10 de la noche",  # has a number: never kept
    "esf_00005_0005": "Hola",  # too short
    "esm_00006_0006": "El agua está fría",  # exactly Melo's phrase s_water
    "esf_00007_0007": "Mi perro come una manzana roja",
    "esm_00008_0008": "El perro es pequeño",  # known words too
}


def _zip(lines: dict, csv: bool = False) -> bytes:
    buf = io.BytesIO()
    with zipfile.ZipFile(buf, "w", zipfile.ZIP_DEFLATED) as z:
        if csv:
            z.writestr("line_index.csv", "".join(f"EN{i:04d}, {k}, {v}\n" for i, (k, v) in enumerate(lines.items())))
        else:
            z.writestr("line_index.tsv", "".join(f"{k}\t{v}\n" for k, v in lines.items()))
        z.writestr("LICENSE", "CC BY-SA 4.0")
        for i, k in enumerate(lines):
            z.writestr(f"{k}.wav", _voice(f0=180 + 20 * i))
    return buf.getvalue()


@pytest.fixture()
def fake_sets(monkeypatch):
    blob = _zip(LINES)
    monkeypatch.setattr(openslr, "SETS", {"es": [(71, "Crowdsourced Chilean Spanish speech", ["es_cl.zip"])]})
    monkeypatch.setattr(openslr, "_open_zip", lambda url: zipfile.ZipFile(io.BytesIO(blob)))
    d = get_settings().data_dir
    yield d
    na._save_manifest(d, {}, merge=False)


def test_index_formats_and_speakers():
    assert openslr.parse_index("knf_00557_0109\tಒಂದು ವಾಕ್ಯ\n\nbad line\n") == {"knf_00557_0109": "ಒಂದು ವಾಕ್ಯ"}
    assert openslr.parse_index("EN1223, wef_12484_0148, The sun provides energy\n") == {"wef_12484_0148": "The sun provides energy"}
    assert openslr.speaker_of("knm_03271_01629528503") == ("knm_03271", "male")
    assert openslr.speaker_of("wef_12484_0148") == ("wef_12484", "female")
    assert openslr.speaker_of("bin_1010_4358822175") == ("bin_1010", "unknown")  # the Bengali set does not say
    assert openslr.suitable("El gato es azul", "es") and not openslr.suitable("Llegamos a las 10", "es")
    assert not openslr.suitable("ಒಂದು Hello ವಾಕ್ಯ", "kn") and not openslr.suitable("Hola", "es")


def test_gender_comes_from_the_zip_name_when_the_file_id_does_not_say(monkeypatch):
    blob = _zip({"mrt_01523_0001": "हे माझे घर आहे"})
    monkeypatch.setattr(openslr, "SETS", {"mr": [(64, "Marathi", ["mr_in_female.zip"])]})
    monkeypatch.setattr(openslr, "_open_zip", lambda url: zipfile.ZipFile(io.BytesIO(blob)))
    (row,) = openslr.rows_for("mr")
    assert row["gender"] == "female" and row["speaker"] == "mrt_01523" and row["url"].endswith("/64/mr_in_female.zip")


def test_pool_and_exact_matches_are_downloaded_with_credit(fake_sets):
    st = openslr.download(fake_sets, ["es"])["es"]
    m = na.manifest(fake_sets)["es"]
    # Melo's own phrase "El agua está fría" now has the native recording
    assert st["exact"] >= 1 and m["s_water"][0]["origin"] == "openslr"
    pool = {k: v for k, v in m.items() if k.startswith("o_")}
    texts = {v[0]["text"] for v in pool.values()}
    assert "El gato es azul" in texts and "Mi perro come una manzana roja" in texts
    assert not any(t.startswith(("Llegamos", "Hola")) for t in texts)  # numbers and one-word lines left out
    cat = next(v for v in pool.values() if v[0]["text"] == "El gato es azul")
    assert {r["gender"] for r in cat} == {"female", "male"} and len({r["speaker"] for r in cat}) == 2
    for refs in pool.values():
        for r in refs:
            assert r["license"] == "CC BY-SA 4.0" and r["noncommercial"] is False and "SLR71" in r["attribution"]
            p = na.file_path(fake_sets, r["file"])
            assert p is not None and p.suffix == ".wav"
            x, rate = na.decode_wav(p.read_bytes())
            assert rate == na.RATE and len(x) < na.RATE * 1.6  # 16 kHz, silence trimmed
            assert na.load_reference(fake_sets, r) is not None  # WAV: the child's voice can be compared with it
    # a second run downloads nothing new
    assert openslr.download(fake_sets, ["es"])["es"]["new_files"] == 0


def test_challenge_pack_uses_the_pool_offline_only_with_known_words(client, fake_sets, monkeypatch):
    openslr.download(fake_sets, ["es"])
    monkeypatch.setattr(growth, "from_tatoeba", lambda *a, **k: [])  # Tatoeba unreachable
    register(client)
    cid = make_child(client, language="en")["id"]
    _master(cid)
    db = session_factory()()
    child = db.get(Child, cid)
    out = growth.grow(db, child, "es")
    db.commit()
    from app.lang.phrases import ITEMS

    assert out["made"] and out["from_openslr"] == 2 and out["with_native_voice"] == 2
    texts = {ITEMS["es"][i].text for i in growth.packs(cid, "es")[0]["items"]}
    assert texts == {"El gato es azul", "El perro es pequeño"}  # the bank sentence is never shown without the AI's check
    db.close()


def test_ai_teacher_vets_pool_sentences_and_their_voices_come_along(client, fake_sets, monkeypatch):
    import app.teacher.service as svc

    openslr.download(fake_sets, ["es"])
    monkeypatch.setattr(growth, "from_tatoeba", lambda *a, **k: [])
    seen = []

    def ask(self, ai, prompt, schema, *a, **k):
        if "Choose up to" in prompt:
            seen.append(prompt)
            keys = [k for k, v in na.manifest(fake_sets)["es"].items() if k.startswith("o_") and "gato" in v[0]["text"]]
            return {"ok": [{"sid": keys[0], "meaning": "The cat is blue", "roman": "", "emoji": "🐱"}]}
        return {"sentences": [{"text": "Mi gato duerme mucho", "roman": "", "meaning": "My cat sleeps a lot", "emoji": "😺"}]}

    monkeypatch.setattr(svc.TeacherService, "_ai_for", lambda self, c: object())
    monkeypatch.setattr(svc.TeacherService, "_ask", ask)
    monkeypatch.setattr(na, "find_sentence", lambda iso3, text: [])
    register(client)
    cid = make_child(client, language="en")["id"]
    _master(cid)
    db = session_factory()()
    out = growth.grow(db, db.get(Child, cid), "es")
    db.commit()
    assert out["made"] and out["from_openslr"] == 1 and out["with_native_voice"] == 1, out
    assert "El gato es azul" in seen[0]
    first = growth.packs(cid, "es")[0]["items"][0]
    refs = na.references(fake_sets, "es", first)
    assert len(refs) == 2 and refs[0]["origin"] == "openslr"
    db.close()


class _RangeHandler(http.server.BaseHTTPRequestHandler):
    blob = b""

    def log_message(self, *a):
        pass

    def do_HEAD(self):
        self.send_response(200)
        self.send_header("Content-Length", str(len(self.blob)))
        self.send_header("Accept-Ranges", "bytes")
        self.end_headers()

    def do_GET(self):
        a, b = self.headers["Range"].split("=")[1].split("-")
        part = self.blob[int(a):int(b) + 1]
        self.send_response(206)
        self.send_header("Content-Length", str(len(part)))
        self.send_header("Content-Range", f"bytes {a}-{b}/{len(self.blob)}")
        self.end_headers()
        self.wfile.write(part)


def test_range_file_reads_single_clips_without_the_whole_zip(monkeypatch):
    lines = {f"esf_{i:05d}_{i:04d}": f"Frase número {i} para leer" for i in range(40)}
    _RangeHandler.blob = _zip(lines, csv=True)
    srv = http.server.ThreadingHTTPServer(("127.0.0.1", 0), _RangeHandler)
    threading.Thread(target=srv.serve_forever, daemon=True).start()
    monkeypatch.setattr(openslr, "GAP", 0)
    monkeypatch.setattr(openslr, "MIN_BLOCK", 4096)
    try:
        f = openslr.RangeFile(f"http://127.0.0.1:{srv.server_address[1]}/x.zip")
        z = zipfile.ZipFile(f)
        assert openslr.parse_index(z.read("line_index.csv").decode())["esf_00003_0003"] == "Frase número 3 para leer"
        before = f.requests
        assert z.read("esf_00007_0007.wav")[:4] == b"RIFF"
        assert f.requests - before <= 4 and f.requests < 20  # a few small requests, not the whole file
    finally:
        srv.shutdown()


def test_indic_words_keep_their_vowel_signs():
    """Regression: splitting on \W cut "नमस्ते" into letters and matched ಹೌದು (yes) with ಹಿಂದೂ (Hindu)."""
    assert growth._words("नमस्ते, दोस्त!", "hi") == ["नमस्ते", "दोस्त"]
    assert growth._words("હોડી લો", "gu") == ["હોડી", "લો"]
    assert na._norm("ಹೌದು") != na._norm("ಹಿಂದೂ") and na._norm("ಶಾಲೆ") != na._norm("ಶಿಲೆ")
    assert na._norm("¡Hola, amigo!") == na._norm("hola amigo") and na._norm("मला भूक लागली आहे.") == na._norm("मला भूक लागली आहे")
