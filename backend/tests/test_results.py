"""Results per subject and combined (learned / applied in real life / remembered), completed concepts for the
AI teacher, milestone reviews, and the never-ending pool of harder questions."""
from datetime import timedelta

from app import assessment, results
from app.db import session_factory
from app.models import ChallengeSet, Child, SubjectRound
from app.routers import subjects as subj
from tests.conftest import make_child, register


def _round(client, cid, subject, topic, strand, correct, total, d, ac=0, at=0, title=""):
    r = client.post(f"/api/children/{cid}/subjects/{subject}/{topic}/round",
                    json={"correct": correct, "total": total, "difficulty": d, "strand": strand, "apply_correct": ac, "apply_total": at, "title": title})
    assert r.status_code == 200, r.text
    return r.json()


def test_subject_areas_measure_learning_and_real_life(client):
    register(client)
    cid = make_child(client, age=8)["id"]
    for d in (1, 2, 3):
        _round(client, cid, "finance", "needs_wants", "basics", 5, 5, d, ac=2, at=2)
    _round(client, cid, "finance", "saving", "save", 4, 5, 1, ac=1, at=2)
    t = client.get(f"/api/children/{cid}/tracker").json()
    fin = next(a for a in t["areas"] if a["id"] == "finance")
    axes = {a["id"]: a for a in fin["axes"]}
    assert axes["real_life"]["final"] == 87.5  # 7 of 8 real-life questions
    assert axes["basics"]["final"] is not None and fin["learned"] is not None and fin["applied"] == 87.5
    assert fin["score"] is not None
    assert t["overall"]["score"] is not None and any(a["id"] == "finance" for a in t["overall"]["areas"])


def test_summary_weights_learned_applied_remembered():
    area = {"id": "maths", "axes": [{"id": "numbers", "final": 80.0}, {"id": "real_life", "final": 40.0}, {"id": "retention", "final": None},
                                    {"id": "completed", "final": None}]}
    results.summarize(area)
    assert area["learned"] == 80.0 and area["applied"] == 40.0 and area["remembered"] is None
    assert area["score"] == round((0.45 * 80 + 0.35 * 40) / 0.8, 1)  # missing parts are left out, not counted as zero


def test_completed_concepts_reach_the_ai_teacher(client, monkeypatch):
    register(client)
    cid = make_child(client)["id"]
    _round(client, cid, "maths", "addition", "numbers", 5, 5, 4)
    with session_factory()() as db:
        child = db.get(Child, cid)
        done = results.completed_concepts(db, child)
        assert any("addition" in x for x in done)


def test_mastering_a_topic_asks_for_a_review_and_grows_the_pool(client, monkeypatch):
    register(client)
    cid = make_child(client)["id"]
    reviews, grown = [], []
    monkeypatch.setattr(assessment, "request_ai_assessment", lambda child_id, reason, force=False: reviews.append((reason, force)) or True)
    monkeypatch.setattr(subj, "grow_challenges", lambda *a: grown.append(a) or True)
    r = _round(client, cid, "science", "water_cycle", "materials", 5, 5, 5, title="The water cycle")
    assert r["mastered"] and r["challenge_started"]
    assert reviews and reviews[0][1] is True and "water cycle" in reviews[0][0].lower()
    assert grown[0][3] == 6  # the first level beyond the built-in 5


def test_challenge_items_are_checked():
    ok = subj._check_item({"prompt": "13 × 14 = ?", "choices": ["182", "172"], "answer": "182", "why": "13 + 4 = 17, 170 + 12", "steps": ["a"]})
    assert ok and ok["answer"] == "182"
    assert subj._check_item({"prompt": "13 × 14 = ?", "choices": ["181", "172"], "answer": "181", "why": "a wrong sum is dropped"}) is None
    assert subj._check_item({"prompt": "Which?", "choices": ["a"], "answer": "a", "why": "only one choice"}) is None
    assert subj._check_item({"prompt": "Which?", "choices": ["a", "b"], "answer": "c", "why": "answer not a choice"}) is None


def test_challenge_levels_are_served(client):
    register(client)
    cid = make_child(client)["id"]
    with session_factory()() as db:
        db.add(ChallengeSet(child_id=cid, subject="maths", topic="urdhva", level=6, items=[{"prompt": "x", "choices": ["1", "2"], "answer": "1", "why": "y"}]))
        db.commit()
    r = client.get(f"/api/children/{cid}/subjects/maths/urdhva/challenges").json()
    assert r["levels"][0]["level"] == 6 and r["growing"] is False


def test_subject_rounds_count_as_new_answers_for_the_ai_review(client):
    register(client)
    cid = make_child(client)["id"]
    _round(client, cid, "vedas", "gita_karma", "gita", 3, 5, 1)
    with session_factory()() as db:
        child = db.get(Child, cid)
        gap, n = assessment._since_last(db, child)
        assert n >= 5


def test_retention_needs_a_break(client):
    register(client)
    cid = make_child(client)["id"]
    for _ in range(3):
        _round(client, cid, "maths", "time", "measure", 4, 5, 2)
    with session_factory()() as db:
        rows = list(db.query(SubjectRound).filter(SubjectRound.child_id == cid).order_by(SubjectRound.id))
        assert results._subject_retention(rows) == (None, 0)  # same day: not a memory test
        rows[1].at = rows[0].at + timedelta(days=2)
        rows[2].at = rows[1].at + timedelta(days=3)
        assert results._subject_retention(rows)[0] == 80.0
