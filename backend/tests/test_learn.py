"""Language learning: content, adaptive engine, judging answers, API."""
import random

from app.db import session_factory
from app.lang import engine
from app.lang.content import CONCEPTS, LETTERS, TARGETS, WORDS
from app.models import LangAttempt, LangItemState, LangSkillState
from tests.conftest import make_child, register


def skills(**difficulty):
    return {s: LangSkillState(child_id="c", lang="es", skill=s, mastery=0.0, difficulty=difficulty.get(s, 1), attempts=0, successes=0,
                              streak=0, fail_streak=0) for s in engine.SKILLS}


def known(lang, tier, strength=0.9):
    return {w.id: LangItemState(child_id="c", lang=lang, item=w.id, strength=strength, seen=3, correct=3) for w in WORDS[lang].values() if w.tier <= tier}


def test_every_language_has_the_full_word_set_and_letters():
    assert set(TARGETS) == {"en", "hi", "mr", "fr", "es", "ar", "zh", "yue", "ko", "ru", "tr", "sa", "gu", "bn", "pa", "ta", "te", "kn", "de", "ja"}
    assert len({c[1] for c in CONCEPTS}) == len(CONCEPTS)  # every picture is different, so choices are never ambiguous
    for code, t in TARGETS.items():
        words = WORDS[code]
        assert len(words) == len(CONCEPTS) and all(w.text for w in words.values())
        assert all((w.roman is None) == t.latin for w in words.values()), code  # reading aid for every non-Latin script
        assert len(set(LETTERS[code])) == len(LETTERS[code]) >= 16
        assert len({w.text for w in words.values()}) >= len(words) - 1


def test_word_pieces_for_writing():
    assert engine.clusters("बिल्ली") == ["बि", "ल्ली"] and engine.clusters("고양이") == ["고", "양", "이"]
    assert engine.clusters("árbol") == ["á", "r", "b", "o", "l"]
    assert "".join(engine.clusters("स्कूल")) == "स्कूल"


def test_child_who_knows_the_language_climbs_fast_and_a_struggling_child_steps_down():
    st = skills()["listen"]
    for _ in range(3):
        ev = engine.apply(st, None, engine.Result("success", 1.0), st.difficulty)
        assert ev == ["harder"]
    assert st.difficulty == 4
    engine.apply(st, None, engine.Result("miss", 0.0), 4)
    assert engine.apply(st, None, engine.Result("miss", 0.0), 4) == ["easier"] and st.difficulty == 3
    # "could not hear" never counts
    before = (st.attempts, st.mastery)
    assert engine.apply(st, None, engine.Result("uncertain", 0.0), 3) == [] and (st.attempts, st.mastery) == before


def test_word_memory_and_new_tiers_open_when_words_are_known():
    item = LangItemState(child_id="c", lang="es", item="cat", strength=0.0, seen=0, correct=0)
    st = skills()["listen"]
    engine.apply(st, item, engine.Result("success", 1.0), 1)
    assert 0.3 < item.strength < engine.KNOWN
    engine.apply(st, item, engine.Result("success", 1.0), 1)
    assert item.strength >= engine.KNOWN
    engine.apply(st, item, engine.Result("miss", 0.0), 1)
    assert item.strength < engine.KNOWN  # forgotten words come back
    quick = LangItemState(child_id="c", lang="es", item="dog", strength=0.0, seen=0, correct=0)
    engine.apply(st, quick, engine.Result("success", 1.0), 3)
    assert quick.strength >= 0.7  # right at a harder level: already known
    assert engine.open_tier({}, "es") == 1 and engine.open_tier(known("es", 1), "es") == 2 and engine.open_tier(known("es", 3), "es") == 4


def test_only_open_words_are_taught_and_choices_hold_the_answer():
    rng = random.Random(3)
    for _ in range(40):
        act = engine.choose("hi", skills(), {}, rng, focus="listen")
        assert act.type == "listen_pick" and WORDS["hi"][act.spec["item"]].tier == 1
        assert len(act.spec["options"]) == 2 and act.spec["options"][act.spec["answer"]]["emoji"] == WORDS["hi"][act.spec["item"]].emoji
        assert "answer" not in act.public and "item" not in act.public
    hard = engine.choose("hi", skills(listen=5), known("hi", 3), rng, focus="listen")
    assert len(hard.spec["options"]) == 4 and hard.spec["roman"] is None  # no reading aid at the hard levels


def test_activities_grow_with_difficulty():
    rng = random.Random(1)
    assert engine.choose("ko", skills(), {}, rng, focus="read").type == "letter_sound"
    easy_read = engine.choose("ko", skills(read=2), known("ko", 1), rng, focus="read")
    assert easy_read.type == "read_pick" and easy_read.spec["prompt"]["roman"] and "emoji" in easy_read.spec["options"][0]
    hard_read = engine.choose("ko", skills(read=4), known("ko", 2), rng, focus="read")
    assert "emoji" in hard_read.spec["prompt"] and "text" in hard_read.spec["options"][0]
    assert engine.choose("ru", skills(), {}, rng, focus="write").type == "trace"
    spell = next(a for a in (engine.choose("ru", skills(write=4), known("ru", 2), rng, focus="write") for _ in range(20)) if a.type == "spell")
    assert "".join(sorted(spell.spec["tiles"])) != "" and len(spell.spec["tiles"]) == spell.spec["length"] + 2
    say = engine.choose("fr", skills(speak=1), {}, rng, focus="speak", speech=True)
    assert say.type == "say_word" and say.spec["model"] is True
    # without a microphone, speaking is never chosen
    assert all(engine.choose("fr", skills(), {}, rng).skill != "speak" for _ in range(40))


def test_missed_word_is_retaught_and_two_misses_bring_an_easy_one():
    rng = random.Random(5)
    last = {"item": "apple", "outcome": "miss", "type": "read_pick", "skill": "read", "retry": False}
    again = engine.choose("es", skills(read=3), known("es", 2), rng, last=last, miss_run=1)
    assert again.events == ["retry"] and again.spec["item"] == "apple" and len(again.spec["options"]) == 2 and again.spec["show_word"]
    comfort = engine.choose("es", skills(read=3, listen=4), known("es", 2), rng, last={**last, "retry": True}, miss_run=2)
    assert "comfort" in comfort.events and comfort.difficulty == 1 and comfort.type == "listen_pick"


def test_speaking_is_judged_generously_and_silence_is_never_wrong():
    spec = {"answer": "Thank you"}
    assert engine.score("say_word", spec, {"heard": ["thank you"]}).outcome == "success"
    assert engine.score("say_word", spec, {"heard": ["sank you", "tank you"]}).outcome == "success"
    assert engine.score("say_word", spec, {"heard": ["banana"]}).outcome == "miss"
    assert engine.score("say_word", spec, {"heard": []}).outcome == "uncertain"
    assert engine.score("say_word", {"answer": "你好"}, {"heard": ["你好。"]}).outcome == "success"
    assert engine.score("say_word", {"answer": "नमस्ते"}, {"heard": ["नमस्ते जी"]}).outcome == "success"


def test_writing_is_judged_on_tracing_and_spelling():
    assert engine.score("trace", {}, {"strokes": 3, "coverage": 0.85, "spill": 0.1}).outcome == "success"
    assert engine.score("trace", {}, {"strokes": 2, "coverage": 0.5, "spill": 0.2}).outcome == "partial"
    assert engine.score("trace", {}, {"strokes": 9, "coverage": 0.9, "spill": 0.9}).outcome == "miss"  # scribbling everywhere
    assert engine.score("trace", {}, {"strokes": 0}).outcome == "skipped"
    assert engine.score("spell", {"answer": "gato"}, {"text": "Gato"}).outcome == "success"
    assert engine.score("spell", {"answer": "gato"}, {"text": "gaot"}).outcome == "partial"
    assert engine.score("spell", {"answer": "gato"}, {"text": "xyz"}).outcome == "miss"


def _answer_right(aid):
    db = session_factory()()
    a = db.get(LangAttempt, aid)
    spec, t = a.spec, a.activity
    db.close()
    if t in ("listen_pick", "read_pick", "letter_sound", "reply_pick"):
        return {"choice": spec["answer"]}
    if t == "say_word":
        return {"heard": [spec["answer"]]}
    if t == "trace":
        return {"strokes": 2, "coverage": 0.9, "spill": 0.05}
    return {"text": spec["answer"]}


def test_language_lessons_over_the_api(client):
    register(client)
    child = make_child(client, language="en")
    cid = child["id"]
    assert len(client.get("/api/learn/languages").json()) == 20
    assert client.post(f"/api/children/{cid}/learn/xx/next", json={}).status_code == 404
    start = client.get(f"/api/children/{cid}/learn/es").json()
    assert start["stage"] == 0 and start["words_known"] == 0 and start["language"]["native"] == "Español"
    seen_types, stars = set(), 0
    for _ in range(40):
        nxt = client.post(f"/api/children/{cid}/learn/es/next", json={"speech": True}).json()
        assert "answer" not in nxt["spec"] and nxt["say"] and nxt["skill"] != "speak"  # no microphone consent: no speaking
        seen_types.add(nxt["type"])
        res = client.post(f"/api/children/{cid}/learn/attempts/{nxt['attempt_id']}/answer", json={"response": _answer_right(nxt["attempt_id"])}).json()
        assert res["outcome"] == "success", res
        stars += res["star"]
    assert stars == 40 and {"listen_pick", "trace"} <= seen_types
    status = res["status"]
    assert status["stage"] >= 3 and status["words_known"] >= 6 and status["tier"] >= 2
    assert all(status["skills"][s]["stage"] >= 3 for s in ("listen", "read", "write"))
    # answering twice is refused; another family cannot see or answer
    assert client.post(f"/api/children/{cid}/learn/attempts/{nxt['attempt_id']}/answer", json={"response": {"choice": 0}}).status_code == 409
    listed = {x["language"]["code"]: x for x in client.get(f"/api/children/{cid}/learn").json()}
    assert listed["es"]["started"] and not listed["ko"]["started"]
    # reset progress clears language learning too
    client.delete(f"/api/children/{cid}/progress")
    assert client.get(f"/api/children/{cid}/learn/es").json()["words_known"] == 0


def test_speaking_needs_consent_and_a_miss_is_retaught_kindly(client):
    register(client)
    child = make_child(client, language="en")
    cid = child["id"]
    client.put(f"/api/children/{cid}/consent", json={"microphone": True})
    nxt = client.post(f"/api/children/{cid}/learn/fr/next", json={"speech": True, "focus": "speak"}).json()
    assert nxt["type"] == "say_word" and nxt["spec"]["emoji"]
    quiet = client.post(f"/api/children/{cid}/learn/attempts/{nxt['attempt_id']}/answer", json={"response": {"heard": []}}).json()
    assert quiet["outcome"] == "uncertain" and ("hear" in quiet["say"].lower() or "ears" in quiet["say"].lower()) and quiet["status"]["skills"]["speak"]["attempts"] == 0
    nxt = client.post(f"/api/children/{cid}/learn/fr/next", json={"focus": "listen"}).json()
    db = session_factory()()
    spec = db.get(LangAttempt, nxt["attempt_id"]).spec
    db.close()
    miss = client.post(f"/api/children/{cid}/learn/attempts/{nxt['attempt_id']}/answer", json={"response": {"choice": 1 - spec["answer"]}}).json()
    assert miss["outcome"] == "miss" and miss["reveal"]["word"] == spec["word"] and miss["reveal"]["correct"] == spec["answer"]
    again = client.post(f"/api/children/{cid}/learn/fr/next", json={"focus": "read"}).json()
    assert again["retry"] is True and again["type"] == "listen_pick" and again["spec"]["word"] == spec["word"]
