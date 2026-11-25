"""Alphabets: complete, in teaching order, voiced, comparable across languages, and progress per letter and skill."""
import unicodedata

from app.lang import alphabet as abc
from app.lang import tts
from app.lang.content import TARGETS
from app.routers.native import known

from tests.conftest import make_child, register

EXPECTED = {"en": 26, "es": 33, "de": 30, "ru": 33, "ar": 36, "ko": 40, "ja": 117, "tr": 29, "fr": 42}


def test_every_language_has_a_complete_alphabet():
    for code in TARGETS:
        letters = abc.alphabet(code)
        assert len(letters) >= 26, code
        assert [x.i for x in letters] == list(range(len(letters)))
        assert all(x.char and x.roman and x.say and x.sound in abc.SOUNDS for x in letters), code
        assert len({x.char for x in letters}) == len(letters), code  # no letter twice
    for code, n in EXPECTED.items():
        assert len(abc.alphabet(code)) == n, code


def test_indian_scripts_have_all_their_letters_and_line_up_by_sound():
    hi = "".join(x.char for x in abc.alphabet("hi"))
    for ch in "अआइईउऊऋएऐओऔकखगघङचछजझञटठडढणतथदधनपफबभमयरलवशषसह":
        assert ch in hi, ch
    # every letter is there, even rare ones: ॠ ऌ, अं अः, the dotted letters and the joined letters
    for ch in ("ॠ", "ऌ", "ऍ", "ऑ", "अं", "अः", "क़", "ज़", "फ़", "ड़", "ढ़", "क्ष", "त्र", "ज्ञ", "श्र", "ळ"):
        assert ch in [x.char for x in abc.alphabet("hi")], ch
    assert next(x for x in abc.alphabet("mr") if x.char == "ळ").group == "consonant"  # a main letter in Marathi
    assert next(x for x in abc.alphabet("hi") if x.char == "ळ").group == "extra"  # a rare one in Hindi
    ta = abc.alphabet("ta")
    assert sum(x.group == "vowel" for x in ta) == 12 and sum(x.group == "consonant" for x in ta) == 18
    assert {"ஜ", "ஷ", "ஸ", "ஹ", "ஃ"} <= {x.char for x in ta if x.group == "extra"}
    assert {"ৎ", "ড়", "য়"} <= {x.char for x in abc.alphabet("bn")} and {"ੰ"[0] if False else "ਅੰ", "ੱ"} <= {x.char for x in abc.alphabet("pa")}
    assert {"ㄲ", "ㅢ"} <= {x.char for x in abc.alphabet("ko")} and {"が", "ア", "ン"} <= {x.char for x in abc.alphabet("ja")}
    # the same Unicode row is the same sound in every Indian script
    for code in ("hi", "gu", "bn", "pa", "te", "kn", "ta"):
        k = next(x for x in abc.alphabet(code) if x.sound == "k")
        assert unicodedata.name(k.char).endswith("LETTER KA"), code


def test_comparison_puts_the_same_sound_in_one_row():
    rows = {r["sound"]: r for r in abc.compare(["hi", "ta", "ru", "ar", "ko", "ja", "en"])}
    k = rows["k"]["cells"]
    assert k["hi"][0]["char"] == "क" and k["ta"][0]["char"] == "க" and k["ru"][0]["char"] == "Кк" and k["ar"][0]["char"] == "ك"
    assert k["ja"][0]["char"] == "か" and any(c["char"] == "Kk" for c in k["en"])
    assert rows["sh"]["cells"]["ar"][0]["char"] == "ش" and rows["sh"]["cells"]["ru"][0]["char"] == "Шш"
    assert "silent" not in rows


def test_examples_come_from_melos_own_words_and_start_with_the_letter():
    for code in TARGETS:
        letters = abc.alphabet(code)
        assert sum(1 for x in letters if x.example) >= 10, code
    ka = next(x for x in abc.alphabet("hi") if x.char == "क")
    assert ka.example is None or ka.example["word"].startswith("क")


def test_letters_are_voiced_items():
    assert abc.is_item("hi", "abc00") and not abc.is_item("hi", "abc99") and not abc.is_item("xx", "abc00")
    assert known("hi", "abc11") and tts._text("hi", "abc11") == "क"
    assert tts._text("ko", abc.item_id(0)) == "가"  # a Korean consonant is said with a vowel
    assert tts._text("ar", "abc01") == "باء"  # Arabic letters are said by their names


def test_alphabet_api_and_progress(client):
    register(client)
    cid = make_child(client)["id"]
    a = client.get("/api/learn/alphabet/ta").json()
    assert a["locale"] == "ta-IN" and a["letters"][0]["item"] == "abc00"
    assert client.get("/api/learn/alphabet/xx").status_code == 404
    cmp = client.get("/api/learn/alphabet-compare?langs=hi,ta,en").json()
    assert [l["code"] for l in cmp["langs"]] == ["hi", "ta", "en"] and cmp["rows"]
    assert client.get("/api/learn/alphabet-compare?langs=hi,zz").status_code == 422
    url = f"/api/children/{cid}/alphabet/hi/round"
    r = client.post(url, json={"skill": "read", "results": [{"i": 0, "ok": True}, {"i": 1, "ok": False}]}).json()
    assert r["right"] == 1 and r["newly_learned"] == [] and r["of"] == len(abc.alphabet("hi"))
    r = client.post(url, json={"skill": "read", "results": [{"i": 0, "ok": True}]}).json()
    assert r["newly_learned"] == [0] and r["known"] == 1  # 2 right in a row = learned
    prog = client.get(f"/api/children/{cid}/alphabet/hi").json()["letters"]
    assert prog["0"]["read"] == {"tries": 2, "right": 2, "streak": 2} and prog["1"]["read"]["streak"] == 0
    assert client.post(url, json={"skill": "dance", "results": [{"i": 0, "ok": True}]}).status_code == 422
    assert client.post(url, json={"skill": "read", "results": [{"i": 90, "ok": True}]}).status_code == 422
    assert client.post(f"/api/children/{cid}/alphabet/ja/round", json={"skill": "read", "results": [{"i": 116, "ok": True}]}).status_code == 200
    assert "alphabet" in str(client.get(f"/api/children/{cid}/memory").json())
    # the letters' voices go through the same route as words
    assert client.get("/api/learn/native/hi/abc11").status_code == 200
    assert client.get("/api/learn/native/hi/abc99").status_code == 404
    assert client.get("/api/learn/native/ja/abc116").status_code == 200  # 3-digit letter ids (Japanese has 117)
