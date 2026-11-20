"""Common Voice sentences: validated clips only, streamed once, kept on this computer (never re-shared)."""
import io
import tarfile
import urllib.error

import pytest

from app.config import get_settings
from app.lang import commonvoice as cv, native_audio as na

HEAD = "client_id\tpath\tsentence_id\tsentence\tsentence_domain\tup_votes\tdown_votes\tage\tgender\taccents\tvariant\tlocale\tsegment\n"
ROWS = [
    # client, clip, sentence, up, down, gender
    ("aaaaaaaaaaaaZZZ", "c1.mp3", "El agua está fría", 2, 0, "female_feminine"),  # Melo's phrase s_water
    ("bbbbbbbbbbbbZZZ", "c2.mp3", "El agua está fría", 3, 0, "male_masculine"),  # a second voice
    ("cccccccccccc", "c3.mp3", "El agua está fría", 1, 0, "male_masculine"),  # only one up vote: not validated enough
    ("dddddddddddd", "c4.mp3", "Mi perro come una manzana roja", 4, 0, "female_feminine"),
    ("eeeeeeeeeeee", "c5.mp3", "El gato es azul y muy bonito", 2, 1, "male_masculine"),  # a down vote: left out
    ("ffffffffffff", "c6.mp3", "Mi casa es grande y bonita", 2, 0, ""),
]


def _tar(clips_first: bool, rows=ROWS) -> bytes:
    tsv = (HEAD + "".join(f"{c}\t{p}\t1\t{s}\t\t{u}\t{d}\t\t{g}\t\t\tes\t\n" for c, p, s, u, d, g in rows)).encode()
    buf = io.BytesIO()
    with tarfile.open(fileobj=buf, mode="w:gz") as tf:
        def add(name, data):
            info = tarfile.TarInfo(name)
            info.size = len(data)
            tf.addfile(info, io.BytesIO(data))
        clips = [(f"cv/es/clips/{p}", b"ID3" + p.encode() * 50) for _, p, *_ in rows]
        lists = [("cv/es/validated.tsv", tsv), ("cv/es/other.tsv", (HEAD + "x\tc9.mp3\t1\tNo validado aún\t\t9\t0\t\t\t\t\tes\t\n").encode())]
        for name, data in (clips + lists if clips_first else lists + clips):
            add(name, data)
        add("cv/es/clips/c9.mp3", b"ID3 unvalidated")
    return buf.getvalue()


DS = {"id": "dsES", "name": "Common Voice Scripted Speech 27.0 - Spanish", "sizeBytes": 1000}


@pytest.fixture()
def fake_cv(monkeypatch):
    monkeypatch.setattr(cv, "api_key", lambda: "test-key")
    monkeypatch.setattr(cv, "datasets_for", lambda lang: [DS])
    monkeypatch.setattr(cv, "_download_url", lambda ds: "https://example.invalid/x.tar.gz")
    monkeypatch.setattr(cv, "_to_reference", lambda raw: (raw, "mp3"))
    d = get_settings().data_dir
    yield d, monkeypatch
    na._save_manifest(d, {}, merge=False)


@pytest.mark.parametrize("clips_first", [False, True])
def test_validated_clips_are_kept_once_and_never_shared(fake_cv, clips_first):
    d, mp = fake_cv
    blob = _tar(clips_first)
    mp.setattr(cv, "_open_stream", lambda url: io.BytesIO(blob))
    st = cv.download(d, ["es"])["es"]
    m = na.manifest(d)["es"]
    water = m["s_water"]
    assert [r["gender"] for r in water] == ["male", "female"] or [r["gender"] for r in water] == ["female", "male"]
    assert {r["speaker"] for r in water} == {"aaaaaaaaaa", "bbbbbbbbbb"}  # only a short anonymous id
    texts = {rs[0]["text"] for k, rs in m.items() if k.startswith("v_")}
    assert "Mi perro come una manzana roja" in texts and "Mi casa es grande y bonita" in texts
    assert "El gato es azul y muy bonito" not in texts and "No validado aún" not in texts  # down vote / not validated
    for rs in m.values():
        for r in rs:
            assert r["origin"] == "commonvoice" and r["noshare"] is True and r["license"] == "CC0 1.0"
            assert na.file_path(d, r["file"]) is not None
    assert st["exact"] >= 1 and st["pool"] == 2
    assert not (na.audio_dir(d) / ".cv_spool").exists() or not any((na.audio_dir(d) / ".cv_spool").rglob("*.mp3"))  # spool removed
    # unvalidated or unchosen clips were never written
    assert not any(p.name.startswith("v_c9") or p.name.startswith("v_c3") or p.name.startswith("v_c5") for p in (na.audio_dir(d) / "es").iterdir())


def test_terms_size_and_key_are_reported(fake_cv, monkeypatch):
    d, mp = fake_cv

    def refused(ds):
        raise cv.TermsNeeded(f"https://mozilladatacollective.com/datasets/{ds['id']}")

    mp.setattr(cv, "_download_url", refused)
    st = cv.download(d, ["es"])["es"]
    assert st["terms_needed"] == ["https://mozilladatacollective.com/datasets/dsES"] and st["new_files"] == 0
    mp.setattr(cv, "datasets_for", lambda lang: [{**DS, "sizeBytes": 50_000_000_000}])
    assert "over KM_CV_MAX_MB" in cv.download(d, ["es"])["es"]["skipped"]
    mp.setattr(cv, "api_key", lambda: "")
    assert "KM_MDC_API_KEY" in cv.download(d, ["es"])["error"]
    assert "sa" not in cv.download.__globals__["LOCALES"]  # no Common Voice for Sanskrit


def test_terms_page_comes_from_a_403(monkeypatch):
    def api(path, params=None, post=False, auth=False):
        raise urllib.error.HTTPError("u", 403, "Terms must be accepted", {}, None)

    monkeypatch.setattr(cv, "_api", api)
    with pytest.raises(cv.TermsNeeded) as e:
        cv._download_url({"id": "abc"})
    assert e.value.page.endswith("/datasets/abc")


def test_gender_segments_are_preferred_to_the_full_release(monkeypatch):
    items = [
        {"id": "full", "name": "Common Voice Scripted Speech 27.0 - Arabic", "licenseAbbreviation": "CC0-1.0", "locale": "ar",
         "organization": {"name": "Mozilla Common Voice"}, "createdAt": "2026-09", "sizeBytes": 3_500_000_000},
        {"id": "f", "name": "Common Voice Scripted Speech 26.0 -  Arabic (Female)", "licenseAbbreviation": "CC0-1.0", "locale": "ar",
         "organization": {"name": "MDC Curators"}, "sizeBytes": 194_000_000},
        {"id": "m", "name": "Common Voice Scripted Speech 26.0 -  Arabic (Male)", "licenseAbbreviation": "CC0-1.0", "locale": "ar",
         "organization": {"name": "MDC Curators"}, "sizeBytes": 247_000_000},
        {"id": "paid", "name": "Common Voice Scripted Speech 27.0 - Arabic", "licenseAbbreviation": "CC0-1.0", "locale": "ar",
         "organization": {"name": "Mozilla Common Voice"}, "pricing": {"isPaid": True}},
    ]
    monkeypatch.setattr(cv, "_api", lambda path, params=None, **k: {"items": items})
    assert [d["id"] for d in cv.datasets_for("ar")] == ["f", "m"]
    monkeypatch.setattr(cv, "_api", lambda path, params=None, **k: {"items": items[:1] + items[3:]})
    assert [d["id"] for d in cv.datasets_for("ar")] == ["full"]
    assert cv.datasets_for("sa") == []


def test_common_voice_clips_stay_out_of_the_installer():
    spec = (get_settings().data_dir and __import__("pathlib").Path(__file__).resolve().parents[2] / "packaging" / "melo.spec").read_text(encoding="utf-8")
    assert 'not r.get("noshare")' in spec
