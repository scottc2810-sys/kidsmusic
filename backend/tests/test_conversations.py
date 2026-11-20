"""Everyday conversations and side-by-side language comparison."""
import random

from app.db import session_factory
from app.lang import engine
from app.lang.content import TARGETS
from app.lang.phrases import ITEMS, PHRASE_WORDS, PHRASES, TOPIC_IDS, TOPIC_OF, topic_pool
from app.models import LangAttempt, LangItemState, LangSkillState
from tests.conftest import make_child, register


def skills(**difficulty):
    return {s: LangSkillState(child_id="c", lang="es", skill=s, mastery=0.0, difficulty=difficulty.get(s, 1), attempts=0, successes=0,
                              streak=0, fail_streak=0) for s in engine.SKILLS}


def test_every_language_has_every_phrase_and_pictures_are_unambiguous():
    assert len({p[2] for p in PHRASES}) == len(PHRASES) == 57 and set(TOPIC_IDS) == {"greetings", "meeting", "polite", "directions", "food", "help", "market",
                                                                                     "school", "friends", "feelings"}
    for code, t in TARGETS.items():
        assert len(PHRASE_WORDS[code]) == 57 and all(w.text for w in PHRASE_WORDS[code].values())
        assert all((w.roman is None) == t.latin for w in PHRASE_WORDS[code].values()), code
        assert len({w.text for w in PHRASE_WORDS[code].values()}) >= 34  # at most one shared phrase per language
        for topic in TOPIC_IDS:
            assert len(topic_pool(code, topic)) == {"school": 8, "friends": 8, "feelings": 6}.get(topic, 5)


def test_writing_a_phrase_means_putting_its_words_in_order():
    assert engine.pieces("Je veux de l'eau, s'il te plaît.", "fr") == (["Je", "veux", "de", "l'eau", "s'il", "te", "plaît"], " ")
    assert engine.pieces("请再说一遍。", "zh") == (["请", "再", "说", "一", "遍"], "")
    assert engine.pieces("धीरे-धीरे, कृपया।", "hi") == (["धीरे-धीरे", "कृपया"], " ")
    assert engine.pieces("Lütfen.", "tr")[0] == ["L", "ü", "t", "f", "e", "n"]  # one word: its letters
    spec = {"answer": "¿Cómo estás?"}
    assert engine.score("spell", spec, {"text": "Cómo estás"}).outcome == "success"  # punctuation does not matter
    assert engine.score("spell", spec, {"text": "estás Cómo"}).outcome in ("partial", "miss")
    assert engine.score("spell", {"answer": "请再说一遍。"}, {"text": "请再说一遍"}).outcome == "success"


def test_topic_mode_only_practises_that_topic_and_grows_with_the_child():
    rng = random.Random(2)
    for _ in range(40):
        act = engine.choose("ko", skills(), {}, rng, topic="directions")
        assert TOPIC_OF[act.spec["item"]] == "directions"
        if act.type in ("listen_pick", "read_pick"):
            assert len(act.spec["options"]) <= 5
    easy = engine.build("ru", ITEMS["ru"]["p_left"], "write", 1, topic_pool("ru", "directions"), rng, hint=True)
    assert easy.type == "spell" and easy.spec["show_text"] and len(easy.spec["tiles"]) == easy.spec["length"] == 2
    hard = engine.build("ru", ITEMS["ru"]["p_left"], "write", 4, topic_pool("ru", "directions"), rng, hint=False)
    assert hard.spec["show_text"] is None and len(hard.spec["tiles"]) == 4  # two extra words that do not belong
    read = engine.build("ar", ITEMS["ar"]["p_toilet"], "read", 4, topic_pool("ar", "directions"), rng, hint=False)
    assert "emoji" in read.spec["prompt"] and len(read.spec["options"]) == 4
    # a missed phrase is re-taught from its own topic
    again = engine.choose("ko", skills(), {}, rng, topic="food", last={"item": "p_tasty", "outcome": "miss", "skill": "read"}, miss_run=1)
    assert again.events == ["retry"] and again.spec["item"] == "p_tasty" and all(TOPIC_OF.get(o.get("emoji"), "") == "" for o in again.spec["options"])


def test_known_phrases_come_up_less():
    rng = random.Random(4)
    items = {pid: LangItemState(child_id="c", lang="es", item=pid, strength=0.95, seen=5, correct=5) for pid in ("p_hello", "p_morning", "p_how", "p_fine")}
    picks = [engine.choose("es", skills(), items, rng, topic="greetings", focus="listen").spec["item"] for _ in range(60)]
    assert picks.count("p_bye") > len(picks) * 0.35  # the one phrase not yet known is practised most


def _right(aid):
    db = session_factory()()
    a = db.get(LangAttempt, aid)
    spec, t = a.spec, a.activity
    db.close()
    if t in ("listen_pick", "read_pick", "reply_pick"):
        return {"choice": spec["answer"]}
    if t == "say_word":
        return {"heard": [spec["answer"]]}
    return {"text": spec["answer"]}


def test_conversation_lessons_over_the_api(client):
    register(client)
    cid = make_child(client, language="en")["id"]
    assert client.post(f"/api/children/{cid}/learn/es/next", json={"topic": "nope"}).status_code == 422
    for _ in range(25):
        nxt = client.post(f"/api/children/{cid}/learn/es/next", json={"topic": "greetings"}).json()
        assert TOPIC_OF[nxt.get("spec", {}).get("item", "p_hello") if "item" in nxt["spec"] else "p_hello"] == "greetings"
        res = client.post(f"/api/children/{cid}/learn/attempts/{nxt['attempt_id']}/answer", json={"response": _right(nxt["attempt_id"])}).json()
        assert res["outcome"] == "success", res
    st = res["status"]
    greet = next(t for t in st["topics"] if t["id"] == "greetings")
    assert greet["known"] >= 3 and st["phrases_known"] == greet["known"] and st["words_known"] == 0


def test_side_by_side_comparison_and_practice(client):
    register(client)
    cid = make_child(client, language="hinglish")["id"]
    cmp = client.get("/api/learn/compare?langs=es,hi,zh,ar&topic=directions&ui=hinglish").json()
    assert [x["code"] for x in cmp["languages"]] == ["es", "hi", "zh", "ar"] and cmp["languages"][3]["rtl"] is True
    left = next(r for r in cmp["rows"] if r["id"] == "p_left")
    assert left["english"] == "Turn left." and left["meaning"] == "baayen mudiye."  # Hinglish learner: meaning in Latin Hindi
    assert left["cells"]["zh"] == {"text": "向左转。", "roman": "xiàng zuǒ zhuǎn."} and left["cells"]["es"]["roman"] is None
    assert len(cmp["topics"]) == 11 and {"school", "friends", "feelings"} <= {t["id"] for t in cmp["topics"]}
    words = client.get("/api/learn/compare?langs=fr,ko&topic=words&ui=en").json()
    assert len(words["rows"]) == 38 and words["rows"][0]["cells"]["ko"]["text"] == "고양이"
    assert client.get("/api/learn/compare?langs=es,fr,xx&topic=greetings").status_code == 422
    # as many languages as the family chooses: five, or all twenty at once
    assert len(client.get("/api/learn/compare?langs=es,fr,hi,zh,ar&topic=school").json()["languages"]) == 5
    from app.lang.content import TARGETS

    every = client.get(f"/api/learn/compare?langs={','.join(TARGETS)}&topic=friends").json()
    assert len(every["languages"]) == 20 and all(len(r["cells"]) == 20 for r in every["rows"]) and len(every["rows"]) == 8
    # practise one phrase in one language straight from the comparison: write it, then it counts
    p = client.post(f"/api/children/{cid}/learn/zh/practice", json={"item": "p_left", "skill": "write"}).json()
    assert p["type"] == "spell" and "answer" not in p["spec"] and sorted(p["spec"]["tiles"]) == sorted("向左转")
    res = client.post(f"/api/children/{cid}/learn/attempts/{p['attempt_id']}/answer", json={"response": {"text": "向左转"}}).json()
    assert res["outcome"] == "success" and res["status"]["skills"]["write"]["attempts"] == 1
    assert client.post(f"/api/children/{cid}/learn/zh/practice", json={"item": "p_left", "skill": "speak"}).status_code == 403
    client.put(f"/api/children/{cid}/consent", json={"microphone": True})
    say = client.post(f"/api/children/{cid}/learn/zh/practice", json={"item": "p_left", "skill": "speak"}).json()
    assert say["type"] == "say_word" and say["spec"]["word"] == "向左转。"
    assert client.post(f"/api/children/{cid}/learn/zh/practice", json={"item": "p_nope", "skill": "read"}).status_code == 404


def test_school_friends_and_feelings_for_real_conversations(client):
    """What a child needs at school and in the playground, in every language: a question and its answer."""
    from app.lang.phrases import REPLIES

    for code in TARGETS:
        for topic, n in (("school", 8), ("friends", 8), ("feelings", 6)):
            pool = topic_pool(code, topic)
            assert len(pool) == n and len({w.text for w in pool}) == n, (code, topic)
            assert all(w.roman for w in pool) or TARGETS[code].latin, (code, topic)
    assert REPLIES["p_play_q"] == "p_play_yes" and REPLIES["p_ok_q"] == "p_fine"
    # Melo asks "Can I play with you?" and the child picks or says the reply
    rng = random.Random(3)
    act = engine.reply_activity("ta", "listen", 3, {}, rng, [], question_id="p_play_q")
    assert act.spec["question"] == ITEMS["ta"]["p_play_q"].text
    assert act.spec["options"][act.spec["answer"]]["text"] == ITEMS["ta"]["p_play_yes"].text
    # practise one school phrase straight away
    register(client)
    cid = make_child(client, language="en")["id"]
    p = client.post(f"/api/children/{cid}/learn/kn/practice", json={"item": "p_toilet_go", "skill": "read"}).json()
    assert p["attempt_id"] and p["type"]


def test_parent_chat_offers_school_and_playground_phrases(client):
    from app.models import Child
    from app.parent_chat import offline_reply

    register(client)
    cid = make_child(client, language="en")["id"]
    db = session_factory()()
    out = offline_reply(db, db.get(Child, cid), "She starts school next month in Spanish and wants to play with other kids")
    topics = {a["params"].get("topic") for a in out["actions"] if a["type"] == "practice_topic"}
    assert {"school", "friends"} <= topics
    db.close()
