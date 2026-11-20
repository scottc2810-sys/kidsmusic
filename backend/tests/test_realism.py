"""A teacher that feels real: emotional reactions, Indian scripts (barakhadi), the beginner-to-pro journey,
little conversations at the top level, and the new instruments."""
import random

from app import curriculum
from app.lang import engine
from app.lang.content import BARAKHADI, LETTERS, NO_SPACES, TARGETS, WORDS
from app.lang.phrases import PHRASE_WORDS, REPLIES
from app.models import LangAttempt, LangItemState, LangSkillState
from app.db import session_factory
from app.teacher.emotion import EMOTIONS, react
from app.teacher.phrases import P
from tests.conftest import make_child, register


def skills(lang="hi", **difficulty):
    return {s: LangSkillState(child_id="c", lang=lang, skill=s, mastery=0.0, difficulty=difficulty.get(s, 1), attempts=0, successes=0,
                              streak=0, fail_streak=0) for s in engine.SKILLS}


# --- emotions ------------------------------------------------------------------------------------------
def test_melo_reacts_like_a_teacher_not_a_quiz():
    assert react("success", streak=1).emotion == "excited"
    three = react("success", streak=3)
    assert three.emotion == "excited" and three.lines == ["lang.streak3"] and three.sfx == "clap"
    assert react("success", streak=5).emotion == "celebrate" and react("success", streak=5).lines == ["lang.streak5"]
    # bouncing back after a miss is praised above everything but a new stage
    comeback = react("success", streak=1, miss_run=2)
    assert comeback.emotion == "proud" and comeback.lines == ["lang.comeback"]
    assert react("success", miss_run=2, events=["stage_up"]).emotion == "celebrate"
    # the first mistake is light and playful; the second is gentle and quiet
    first, second = react("miss"), react("miss", miss_run=1)
    assert first.emotion == "playful" and first.lines == ["lang.oops"] and first.energy > second.energy
    assert second.emotion == "empathetic" and second.lines == ["lang.empathy"] and second.sfx is None  # no "wrong" noise when it is hard
    assert react("uncertain").emotion == "curious" and react("skipped").emotion == "calm"
    assert react("success", skill="read", streak=2).lines == ["lang.praise.read"]  # specific praise: what the child did well
    for o in ("success", "partial", "miss", "uncertain", "skipped"):
        assert react(o).emotion in EMOTIONS
    for key in ("lang.streak3", "lang.streak5", "lang.comeback", "lang.oops", "lang.empathy", "lang.conversation_ok",
                "lang.praise.listen", "lang.praise.read", "lang.praise.write", "lang.praise.speak",
                "lang.intro.reply_pick", "lang.intro.say_reply", "lang.intro.barakhadi", "lang.intro.sentence"):
        assert set(P[key]) == {"en", "hi", "hinglish"}, key


# --- languages and scripts -------------------------------------------------------------------------------
def test_new_languages_have_words_phrases_and_letters():
    for code in ("sa", "gu", "bn", "pa", "ta", "te", "kn", "de", "ja"):
        t = TARGETS[code]
        assert len(WORDS[code]) == 38 and len(PHRASE_WORDS[code]) == 57 and len(LETTERS[code]) >= 16
        assert all((w.roman is None) == t.latin for w in WORDS[code].values()), code
        assert all((w.roman is None) == t.latin for w in PHRASE_WORDS[code].values()), code
    assert TARGETS["sa"].locale == "hi-IN"  # no engine has a Sanskrit voice: a Hindi voice reads it
    assert "ja" in NO_SPACES and engine.pieces("ねこはちいさい", "ja") == (list("ねこはちいさい"), "")


def test_conjuncts_in_every_indian_script_but_tamil_writes_dead_consonants_apart():
    assert engine.clusters("ক্ষমা") == ["ক্ষ", "মা"]  # Bengali
    assert engine.clusters("ಕನ್ನಡ") == ["ಕ", "ನ್ನ", "ಡ"]  # Kannada
    assert engine.clusters("ਸ੍ਰੀ") == ["ਸ੍ਰੀ"]  # Gurmukhi
    assert engine.clusters("நாய்") == ["நா", "ய்"]  # Tamil pulli does not join
    assert engine.clusters("शुभ रात्रि")[2] == " "  # a virama never swallows a space


def test_barakhadi_rows_for_indian_scripts():
    assert set(BARAKHADI) == {"hi", "mr", "sa", "gu", "bn", "pa", "ta", "te", "kn"}
    assert BARAKHADI["hi"][0] == ["क", "का", "कि", "की", "कु", "कू", "के", "कै", "को", "कौ", "कं"]
    assert BARAKHADI["ta"][0][:4] == ["க", "கா", "கி", "கீ"] and len(BARAKHADI["ta"][0]) == 12  # short and long e / o
    rng = random.Random(4)
    reads = [engine.choose("hi", skills(read=2), {}, rng, focus="read") for _ in range(60)]
    syl = [a for a in reads if a.spec.get("barakhadi")]
    assert syl, "barakhadi practice at stage 2"
    for a in syl:
        opts = [o["text"] for o in a.spec["options"]]
        assert a.type == "letter_sound" and len(set(opts)) == 3 and len({o[0] for o in opts}) == 1  # one consonant, three vowel signs
        assert opts[a.spec["answer"]] == a.spec["say"]
    writes = [engine.choose("bn", skills("bn", write=2), {}, rng, focus="write") for _ in range(40)]
    assert any(a.spec["item"].startswith("syl:") and a.type == "trace" for a in writes)
    # no barakhadi in languages without an Indian script
    assert not any(engine.choose("es", skills("es", read=2), {}, rng, focus="read").spec.get("barakhadi") for _ in range(30))


# --- beginner to pro ---------------------------------------------------------------------------------------
def test_top_level_has_little_conversations_and_sentence_building():
    rng = random.Random(9)
    acts = [engine.choose("sa", skills("sa", listen=5, read=5, speak=5, write=5), {}, rng, speech=True) for _ in range(120)]
    talk = [a for a in acts if "conversation" in a.events]
    assert {a.type for a in talk} == {"reply_pick", "say_word"}
    for a in talk:
        if a.type == "reply_pick":
            # one reply can answer several questions ("How are you?" / "Are you okay?" -> "I am fine")
            qs = [qid for qid, rid in REPLIES.items() if PHRASE_WORDS["sa"][rid].id == a.spec["item"]]
            assert a.spec["question"] in {PHRASE_WORDS["sa"][q].text for q in qs}
            assert a.spec["options"][a.spec["answer"]]["text"] == PHRASE_WORDS["sa"][a.spec["item"]].text
            assert a.spec["show_question"] == (a.skill == "read")
        else:
            assert a.spec["question"] and a.spec["model"] is False and a.spec["show_word"] is False
    sentences = [a for a in acts if "sentence" in a.events]
    assert sentences and all(a.type == "spell" and a.spec["joiner"] == " " for a in sentences)
    assert engine.score("reply_pick", {"answer": 2}, {"choice": 2}).outcome == "success"
    # beginners never get conversations
    assert not any("conversation" in engine.choose("sa", skills("sa"), {}, rng, speech=True).events for _ in range(60))


def test_journey_explains_each_stage_to_parents():
    s = engine.summary("ta", {}, {})
    assert [j["title"] for j in s["journey"]] == ["Sound Seeker", "Letter Explorer", "Word Builder", "Sentence Reader", "Little Pro"]
    assert s["journey"][0]["current"] and not s["journey"][0]["reached"] and "Tamil" in s["journey"][0]["home"]
    assert all(j[k] for j in s["journey"] for k in ("listen", "read", "write", "speak", "home")) and s["barakhadi"] is True


# --- API --------------------------------------------------------------------------------------------------
def _right(aid):
    db = session_factory()()
    a = db.get(LangAttempt, aid)
    spec, t = a.spec, a.activity
    db.close()
    if t in ("listen_pick", "read_pick", "letter_sound", "reply_pick"):
        return {"choice": spec["answer"]}
    if t == "trace":
        return {"strokes": 2, "coverage": 0.9, "spill": 0.05}
    return {"text": spec["answer"]}


def _wrong(aid):
    db = session_factory()()
    spec = db.get(LangAttempt, aid).spec
    db.close()
    return {"choice": (spec["answer"] + 1) % len(spec["options"])}


def test_answers_carry_emotion_streaks_and_comebacks(client):
    register(client)
    cid = make_child(client, language="en", name="Asha")["id"]
    out = []
    for _ in range(5):
        nxt = client.post(f"/api/children/{cid}/learn/sa/next", json={"focus": "listen"}).json()
        assert nxt["emotion"] in ("curious", "warm", "calm", "playful")
        out.append(client.post(f"/api/children/{cid}/learn/attempts/{nxt['attempt_id']}/answer", json={"response": _right(nxt["attempt_id"])}).json())
    assert [r["streak"] for r in out] == [1, 2, 3, 4, 5]
    assert out[2]["emotion"] in ("excited", "celebrate") and out[2]["sfx"] in ("clap", "tada")
    assert out[4]["emotion"] == "celebrate"
    # a miss, then another: playful, then gentle; then the comeback is praised
    nxt = client.post(f"/api/children/{cid}/learn/sa/next", json={"focus": "listen"}).json()
    miss1 = client.post(f"/api/children/{cid}/learn/attempts/{nxt['attempt_id']}/answer", json={"response": _wrong(nxt["attempt_id"])}).json()
    assert miss1["emotion"] == "playful" and miss1["streak"] == 0
    nxt = client.post(f"/api/children/{cid}/learn/sa/next", json={"focus": "listen"}).json()
    assert nxt["retry"] and nxt["emotion"] == "calm"
    miss2 = client.post(f"/api/children/{cid}/learn/attempts/{nxt['attempt_id']}/answer", json={"response": _wrong(nxt["attempt_id"])}).json()
    assert miss2["emotion"] == "empathetic" and miss2["sfx"] is None
    nxt = client.post(f"/api/children/{cid}/learn/sa/next", json={"focus": "listen"}).json()
    assert nxt["comfort"]
    back = client.post(f"/api/children/{cid}/learn/attempts/{nxt['attempt_id']}/answer", json={"response": _right(nxt["attempt_id"])}).json()
    assert back["emotion"] in ("proud", "celebrate") and ("trying" in back["say"] or "give up" in back["say"] or "stage" in back["say"])
    status = client.get(f"/api/children/{cid}/learn/sa").json()
    assert status["language"]["native"] == "संस्कृतम्" and len(status["journey"]) == 5


def test_instrument_game_adds_harder_instruments_later():
    rng = random.Random(2)
    easy = {o for _ in range(200) for o in curriculum.gen_instrument_guess(2, rng)["options"]}
    hard = {o for _ in range(200) for o in curriculum.gen_instrument_guess(5, rng)["options"]}
    assert easy <= set(curriculum.TIMBRES) and set(curriculum.TIMBRES_MORE) <= hard
