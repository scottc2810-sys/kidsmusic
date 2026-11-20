"""How Melo feels about what just happened, the way a good one-on-one teacher reacts.

A real teacher does not say "Correct!" in the same voice forty times. They:
* get louder and brighter as a child builds a streak, and throw a small party at a milestone;
* praise *effort and comeback* most of all ("You kept trying and you got it!");
* name what the child did well (sharp ears, careful writing) instead of a generic "good";
* treat the first mistake lightly and playfully, so mistakes feel normal;
* on a second mistake soften their voice, show they understand it is hard, and make it easier;
* stay curious, never disappointed, when they simply could not hear.

`react()` turns an answer into an emotion (for Melo's face, body and voice) and the extra teacher
line keys to say. The emotion names are shared with the app (frontend/src/emotion.ts).
"""
from __future__ import annotations

from dataclasses import dataclass, field

EMOTIONS = ("celebrate", "excited", "proud", "warm", "playful", "empathetic", "curious", "calm", "surprised")


@dataclass
class Reaction:
    emotion: str
    energy: int  # 1 quiet .. 5 bouncing: how big Melo's voice and body are
    lines: list[str] = field(default_factory=list)  # teacher line keys, said after the main feedback line
    sfx: str | None = None  # a small sound: sparkle | tada | clap | oops | pop


def react(outcome: str, *, streak: int = 0, miss_run: int = 0, events: tuple[str, ...] | list[str] = (), skill: str | None = None,
          difficulty: int = 1, conversation: bool = False) -> Reaction:
    """`streak`: successes in a row including this answer. `miss_run`: misses in a row *before* this answer."""
    ev = set(events)
    if outcome == "skipped":
        return Reaction("calm", 2)
    if outcome == "uncertain":
        return Reaction("curious", 2, sfx="pop")
    if outcome == "success":
        if "stage_up" in ev:
            return Reaction("celebrate", 5, sfx="tada")
        if miss_run >= 1:  # bounced back after a miss: the most important thing to praise
            return Reaction("proud", 4, ["lang.comeback"], sfx="clap")
        if streak >= 5 and streak % 5 == 0:
            return Reaction("celebrate", 5, ["lang.streak5"], sfx="tada")
        if streak == 3:
            return Reaction("excited", 4, ["lang.streak3"], sfx="clap")
        if conversation:
            return Reaction("proud", 4, ["lang.conversation_ok"], sfx="sparkle")
        if difficulty >= 4:
            return Reaction("proud", 3, [f"lang.praise.{skill}"] if skill else [], sfx="sparkle")
        return Reaction("excited", 3, [f"lang.praise.{skill}"] if skill and streak % 2 == 0 else [], sfx="sparkle")
    if outcome == "partial":
        return Reaction("warm", 3, sfx="pop")
    # miss
    if miss_run >= 1:
        return Reaction("empathetic", 1, ["lang.empathy"])
    return Reaction("playful", 2, ["lang.oops"], sfx="oops")
