from app.scoring import score_attempt, semi_global_distance


def notes(seq, source="screen", conf=1.0):
    return {"source": source, "notes": [{"midi": m, "t": i * 400, "conf": conf} for i, m in enumerate(seq)]}


def test_semi_global_ignores_warmup_notes():
    d, _ = semi_global_distance([60, 62, 64], [72, 71, 60, 62, 64, 50])
    assert d == 0


def test_echo_exact_partial_and_miss():
    spec = {"notes": [60, 62, 64, 65]}
    assert score_attempt("echo_melody", spec, notes([60, 62, 64, 65])).outcome == "success"
    assert score_attempt("echo_melody", spec, notes([60, 62, 67, 65])).outcome == "partial"
    assert score_attempt("echo_melody", spec, notes([71, 70, 69])).outcome == "miss"


def test_mic_is_octave_tolerant_and_low_confidence_is_uncertain_not_wrong():
    spec = {"notes": [60, 62, 64]}
    assert score_attempt("echo_melody", spec, notes([72, 74, 76], "mic", 0.9)).outcome == "success"
    r = score_attempt("echo_melody", spec, notes([61, 66, 70], "mic", 0.3))
    assert r.outcome == "uncertain"


def test_camera_disagreement_demotes_mic_note():
    spec = {"keys": [60, 67], "target": 60, "tries": 1, "highlight": True}
    resp = {"source": "mic", "notes": [{"midi": 60, "t": 0, "conf": 0.7, "camera_agrees": False}]}
    assert score_attempt("find_note", spec, resp).outcome == "uncertain"


def test_find_note_tries_and_direction_hint():
    spec = {"keys": [60, 62, 64], "target": 64, "tries": 3, "highlight": True}
    assert score_attempt("find_note", spec, notes([64])).outcome == "success"
    assert score_attempt("find_note", spec, notes([60, 64])).outcome == "partial"
    r = score_attempt("find_note", spec, notes([60, 60, 62]))
    assert r.outcome == "miss" and r.detail["hint"] == "higher"


def test_choice_and_skip():
    spec = {"answer": 1}
    assert score_attempt("high_low", spec, {"choice": 1}).outcome == "success"
    assert score_attempt("high_low", spec, {"choice": 0}).outcome == "miss"
    assert score_attempt("high_low", spec, {"timed_out": True}).outcome == "skipped"


def test_rhythm_tolerates_overall_tempo_change():
    spec = {"pattern": [0, 1, 2, 2.5, 3], "bpm": 80, "tolerance_ms": 200}
    beat = 60000 / 80
    exact = [p * beat for p in spec["pattern"]]
    slower = [t * 1.2 for t in exact]
    assert score_attempt("rhythm_tap", spec, {"taps": exact}).outcome == "success"
    r = score_attempt("rhythm_tap", spec, {"taps": slower})
    assert r.outcome == "success" and r.detail["tempo"] == "slower"
    assert score_attempt("rhythm_tap", spec, {"taps": [0, 100, 200, 300, 400, 500, 600, 700]}).outcome == "miss"
    assert score_attempt("rhythm_tap", spec, {"taps": []}).outcome == "skipped"


def test_free_play_rewards_exploration():
    assert score_attempt("free_play", {}, notes([60, 64, 67, 69])).outcome == "success"
    assert score_attempt("free_play", {}, notes([60])).outcome == "partial"


def test_invalid_response_rejected():
    import pytest

    from app.scoring import InvalidResponse

    with pytest.raises(InvalidResponse):
        score_attempt("echo_melody", {"notes": [60]}, {"notes": [{"midi": 500, "t": 0}]})
