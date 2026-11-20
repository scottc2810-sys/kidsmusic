"""Melo "AI brain" MCP server — lets Claude Code read (and optionally annotate) a child's
learning-graph memory.

Connect from a terminal (the app's Parent ▸ Connect Claude Code page prints these with your token):

  HTTP (server running):  claude mcp add --transport http melo http://127.0.0.1:8000/mcp/ --header "Authorization: Bearer <token>"
  stdio (no server):      claude mcp add melo --env KM_MCP_TOKEN=<token> -- <python> <repo>/backend/melo_mcp.py

Every tool is scoped to the parent who owns the token; children of other parents are invisible.
Write tools (notes, focus) require a token created with "allow changes".
"""
from __future__ import annotations

import hashlib
import json
import os
import secrets
from datetime import datetime, timezone
from typing import Any

from mcp.server.mcpserver import Context, MCPServer
from sqlalchemy import select
from sqlalchemy.orm import Session

from . import basics, memory
from .curriculum import ACTIVITIES, LEVELS, SKILLS, SONGS
from .db import session_factory
from .models import ApiToken, Child, Recording

TOKEN_PREFIX = "melo_"

INSTRUCTIONS = """Melo is an AI music teacher for children aged 3-8. These tools expose one family's
learning-graph memory: per-child skills (mastery 0-1, difficulty 1-5), activities practised, songs,
lesson sessions, practice-recording analyses, recurring mistakes and parent notes.
Start with list_children, then child_overview. Use learning_graph to walk relationships and
progress_timeline for history. Treat analyser numbers as estimates (they can contain detection errors).
Never shame or compare children; frame suggestions positively and keep practice short (3-5 minutes)."""


# --- tokens ----------------------------------------------------------------------------------
def hash_token(token: str) -> str:
    return hashlib.sha256(token.encode()).hexdigest()


def create_token(db: Session, parent_id: str, name: str, allow_write: bool) -> tuple[ApiToken, str]:
    raw = TOKEN_PREFIX + secrets.token_urlsafe(32)
    tok = ApiToken(parent_id=parent_id, name=name[:60] or "Claude Code", prefix=raw[:12], token_hash=hash_token(raw), allow_write=allow_write)
    db.add(tok)
    db.commit()
    return tok, raw


def resolve_token(db: Session, raw: str | None) -> ApiToken | None:
    if not raw or not raw.startswith(TOKEN_PREFIX) or len(raw) > 200:
        return None
    tok = db.scalar(select(ApiToken).where(ApiToken.token_hash == hash_token(raw)))
    if tok is None or tok.revoked:
        return None
    now = datetime.now(timezone.utc)
    last = tok.last_used_at.replace(tzinfo=timezone.utc) if tok.last_used_at and not tok.last_used_at.tzinfo else tok.last_used_at
    if last is None or (now - last).total_seconds() > 60:
        tok.last_used_at = now
        db.commit()
    return tok


def _bearer(headers: Any) -> str | None:
    if not headers:
        return None
    h = headers.get("authorization") or headers.get("Authorization") or ""
    return h[7:].strip() if h.lower().startswith("bearer ") else None


class ToolError(Exception):
    pass


def _auth(db: Session, ctx: Context | None) -> ApiToken:
    raw = None
    try:
        raw = _bearer(ctx.headers) if ctx is not None else None
    except ValueError:  # no request context (direct call)
        raw = None
    raw = raw or os.environ.get("KM_MCP_TOKEN")
    tok = resolve_token(db, raw)
    if tok is None:
        raise ToolError("Not authorised: create a token in Melo (Parent ▸ Connect Claude Code) and pass it as a Bearer header or KM_MCP_TOKEN.")
    return tok


def _child(db: Session, tok: ApiToken, child: str) -> Child:
    key = (child or "").strip()
    kids = list(db.scalars(select(Child).where(Child.parent_id == tok.parent_id)))
    for c in kids:
        if c.id == key or c.name.lower() == key.lower():
            return c
    if len(kids) == 1 and not key:
        return kids[0]
    raise ToolError(f"No child '{key}'. Available: {', '.join(c.name for c in kids) or 'none'}")


def _run(ctx: Context | None, fn, write: bool = False) -> str:
    db = session_factory()()
    try:
        tok = _auth(db, ctx)
        if write and not tok.allow_write:
            raise ToolError("This token is read-only. Create a token with 'allow changes' to use this tool.")
        out = fn(db, tok)
        db.commit()
        return json.dumps(out, ensure_ascii=False, default=str, indent=1)
    except ToolError as e:
        db.rollback()
        return json.dumps({"error": str(e)})
    finally:
        db.close()


# --- server ----------------------------------------------------------------------------------
def build_server() -> MCPServer:
    mcp = MCPServer(name="melo", title="Melo music-teacher memory", instructions=INSTRUCTIONS, version="1.0.0")

    @mcp.tool(description="List the children on this Melo account with their level and teaching language.")
    def list_children(ctx: Context) -> str:
        return _run(ctx, lambda db, tok: [
            {"id": c.id, "name": c.name, "age": c.age, "level": c.current_level, "level_name": LEVELS[c.current_level]["name"],
             "language": c.language, "mode": c.mode, "instrument": c.instrument}
            for c in db.scalars(select(Child).where(Child.parent_id == tok.parent_id).order_by(Child.created_at))
        ])

    @mcp.tool(description="One-call progress summary for a child (by name or id): skills, strengths, struggles, songs, recent events and a recommended focus.")
    def child_overview(child: str, ctx: Context) -> str:
        return _run(ctx, lambda db, tok: memory.overview(db, _child(db, tok, child)))

    @mcp.tool(description="The short memory brief Melo's own AI brain receives before every lesson, chat and exercise for this child: "
                          "skills, strengths, what is hard, songs, languages (stage per skill, hard words), recent events, parent notes.")
    def teacher_brief(child: str, ctx: Context) -> str:
        return _run(ctx, lambda db, tok: memory.brief(db, _child(db, tok, child)))

    @mcp.tool(description="The progress tracker: spider-chart scores (0-100, 80% measured from activities + 20% teacher/AI assessment) "
                          "per area (music, each language, learning habits), bands, trends over 2 weeks, recommendations and assessments.")
    def progress_tracker(child: str, ctx: Context) -> str:
        from . import assessment

        return _run(ctx, lambda db, tok: {k: v for k, v in assessment.tracker(db, _child(db, tok, child)).items() if k != "parameters"})

    @mcp.tool(description="Teacher's lesson plan from the progress tracker: what the child understands, what is developing and the "
                          "next 2-4 activities. Optional lens filters one skill across areas: listen, speak, read, write, vocabulary, "
                          "conversation, music, habits.")
    def teacher_plan(child: str, ctx: Context, lens: str | None = None) -> str:
        from . import assessment

        def fn(db: Session, tok: ApiToken) -> dict:
            t = assessment.tracker(db, _child(db, tok, child))
            return {**assessment.teacher_plan(t, lens), "lens_view": assessment.lens_view(t, lens) if lens else None}
        return _run(ctx, fn)

    @mcp.tool(description="Language learning progress for a child: every language studied, its stage (1 Sound Seeker .. 5 Little Pro) "
                          "for listen / speak / read / write, words known and the words that are hard right now.")
    def language_progress(child: str, ctx: Context) -> str:
        return _run(ctx, lambda db, tok: memory.languages(db, _child(db, tok, child)))

    @mcp.tool(description="Walk the learning graph. node_id defaults to the child node; depth 1-3; optional relation filter "
                          "(HAS_SKILL, PRACTICED, TRAINS, ATTENDED, INCLUDED, LEARNING, LEARNED, RECORDED, OF_SONG, REVEALED, STRUGGLES_WITH, STRONG_AT, ABOUT, "
                          "STUDIES, KNOWS, IN).")
    def learning_graph(child: str, ctx: Context, node_id: str | None = None, depth: int = 1, relation: str | None = None) -> str:
        return _run(ctx, lambda db, tok: memory.subgraph(db, _child(db, tok, child), node_id, depth, relation))

    @mcp.tool(description="Search graph nodes by label text (e.g. 'Twinkle', 'rhythm', 'F was often'); optional kind filter "
                          "(skill, activity, song, session, mistake, recording, note).")
    def search_memory(child: str, query: str, ctx: Context, kind: str | None = None) -> str:
        return _run(ctx, lambda db, tok: memory.search(db, _child(db, tok, child), query, kind))

    @mcp.tool(description="Chronological progress events (newest first): level_up, harder, easier, frustration, session, recording, song_learned, note, focus.")
    def progress_timeline(child: str, ctx: Context, days: int = 30, kinds: list[str] | None = None, limit: int = 50) -> str:
        return _run(ctx, lambda db, tok: memory.timeline(db, _child(db, tok, child), days, kinds, limit))

    @mcp.tool(description="Latest practice-recording analyses and AI feedback for a child.")
    def recording_feedback(child: str, ctx: Context, limit: int = 5) -> str:
        def fn(db: Session, tok: ApiToken) -> list[dict]:
            c = _child(db, tok, child)
            recs = db.scalars(select(Recording).where(Recording.child_id == c.id).order_by(Recording.created_at.desc()).limit(max(1, min(limit, 20))))
            return [{"id": r.id, "title": r.title, "created_at": r.created_at, "status": r.status, "duration_s": r.duration_seconds,
                     "analysis": {k: v for k, v in (r.analysis or {}).items() if k != "notes"}, "feedback": r.feedback} for r in recs]
        return _run(ctx, fn)

    @mcp.tool(description="Recommended next focus and what is needed to unlock the next level.")
    def recommend_next_lesson(child: str, ctx: Context) -> str:
        return _run(ctx, lambda db, tok: memory.overview(db, _child(db, tok, child))["recommendation"])

    @mcp.tool(description="Curriculum reference: levels, activity types (with skills/modes) and the song library.")
    def curriculum() -> str:
        return json.dumps({"levels": {k: {"name": v["name"], "core_skills": v["core_skills"]} for k, v in LEVELS.items()},
                           "activities": {k: {"skill": a.skill, "min_level": a.min_level, "modes": a.modes} for k, a in ACTIVITIES.items()},
                           "songs": {k: s["title"] for k, s in SONGS.items()}, "skills": SKILLS})

    @mcp.tool(description="(Write) Add a parent/teacher note to the child's memory, optionally about a skill. Requires a write-enabled token.")
    def add_note(child: str, note: str, ctx: Context, about_skill: str | None = None) -> str:
        def fn(db: Session, tok: ApiToken) -> dict:
            n = memory.add_note(db, _child(db, tok, child), note.strip()[:1000], about_skill, author="claude-code")
            return {"ok": True, "node": n.id}
        return _run(ctx, fn, write=True)

    @mcp.tool(description="(Write) Set or clear (skill=null) the focus skill Melo prioritises in the next lessons. "
                          "Must be a skill available at the child's level. Requires a write-enabled token.")
    def set_focus_skill(child: str, ctx: Context, skill: str | None = None) -> str:
        def fn(db: Session, tok: ApiToken) -> dict:
            c = _child(db, tok, child)
            allowed = sorted({a.skill for a in ACTIVITIES.values() if a.min_level <= c.current_level})
            if skill is not None and skill not in allowed:
                raise ToolError(f"skill must be one of {allowed}")
            memory.set_focus_override(db, c, skill)
            return {"ok": True, "focus_skill": skill}
        return _run(ctx, fn, write=True)

    @mcp.tool(description="Music Basics progress: tier (1-3) per topic (swars, rhythm, taal, alankars, ...), what is needed for the "
                          "next tier, the swar names allowed at the child's current swars/alankars tier, and the exercises made so far.")
    def basics_status(child: str, ctx: Context) -> str:
        def fn(db: Session, tok: ApiToken) -> dict:
            c = _child(db, tok, child)
            tiers = basics.tiers_for(db, c)
            rows = db.scalars(select(basics.CustomExercise).where(basics.CustomExercise.child_id == c.id))
            return {"tiers": tiers, "allowed_swars": {t: list(basics.SWARS_FOR_TIER[tiers[t]["tier"]]) for t in basics.EXERCISE_TOPICS},
                    "exercises": [{"song_id": f"x_{r.id}", "title": r.title, "topic": r.topic, "tier": r.tier, "source": r.source} for r in rows]}
        return _run(ctx, fn)

    @mcp.tool(description="(Write) Add a sargam exercise (alankar) for the child, taught in Melo's song school part by part. "
                          "swars: names from basics_status.allowed_swars (e.g. ['Sa','Re','Ga','Re','Ga','Ma']); beats: optional, one per swar "
                          "(0.5, 1, 1.5, 2 or 3); phrase_length: swars per part (3-12); intro: 1-2 short child-friendly sentences "
                          "(may use {name}). topic: swars or alankars. Requires a write-enabled token.")
    def add_exercise(child: str, title: str, swars: list[str], ctx: Context, beats: list[float] | None = None,
                     phrase_length: int = 8, intro: str | None = None, topic: str = "alankars") -> str:
        def fn(db: Session, tok: ApiToken) -> dict:
            c = _child(db, tok, child)
            if topic not in basics.EXERCISE_TOPICS:
                raise ToolError(f"topic must be one of {list(basics.EXERCISE_TOPICS)}")
            tier = basics.tiers_for(db, c)[topic]["tier"]
            try:
                ex = basics.validate(swars, None, beats, phrase_length, tier, title, intro)
            except ValueError as e:
                raise ToolError(str(e)) from None
            row = basics.save(db, c, topic, tier, ex, "claude-code")
            return {"ok": True, "song_id": f"x_{row.id}", "title": row.title, "tier": tier, "notes": len(row.notes), "parts": len(row.phrases)}
        return _run(ctx, fn, write=True)

    @mcp.tool(description="Rebuild the child's learning graph from raw lesson/recording data (safe, idempotent).")
    def rebuild_memory(child: str, ctx: Context) -> str:
        return _run(ctx, lambda db, tok: memory.rebuild(db, _child(db, tok, child)))

    @mcp.prompt(description="Write a warm weekly progress report for a parent.")
    def weekly_report(child: str) -> str:
        return (f"Use child_overview and progress_timeline (days=7) for '{child}'. Write a short, warm weekly report for the parent: "
                "what went well (specific), one or two gentle focus areas, and 3 tiny playful practice ideas for next week. "
                "Mention uncertainty where the data is thin. Never compare with other children.")

    return mcp


_server: MCPServer | None = None


def get_mcp() -> MCPServer:
    global _server
    if _server is None:
        _server = build_server()
    return _server


class BearerAuthASGI:
    """Rejects MCP HTTP requests without a valid Melo token before they reach the MCP transport."""

    def __init__(self, app) -> None:
        self.app = app

    async def __call__(self, scope, receive, send):
        if scope["type"] != "http":
            return await self.app(scope, receive, send)
        headers = {k.decode().lower(): v.decode() for k, v in scope.get("headers", [])}
        raw = _bearer(headers)
        ok = False
        if raw:
            import anyio

            def check() -> bool:
                db = session_factory()()
                try:
                    return resolve_token(db, raw) is not None
                finally:
                    db.close()

            ok = await anyio.to_thread.run_sync(check)
        if not ok:
            body = b'{"error":"unauthorized","detail":"Create a token in Melo: Parent > Connect Claude Code"}'
            await send({"type": "http.response.start", "status": 401,
                        "headers": [(b"content-type", b"application/json"), (b"www-authenticate", b"Bearer")]})
            await send({"type": "http.response.body", "body": body})
            return
        await self.app(scope, receive, send)


def main() -> None:  # stdio entry point
    from .db import init_engine

    init_engine()
    if not os.environ.get("KM_MCP_TOKEN"):
        import sys

        print("KM_MCP_TOKEN is not set. Create a token in Melo (Parent > Connect Claude Code).", file=sys.stderr)
    get_mcp().run("stdio")


if __name__ == "__main__":
    main()
