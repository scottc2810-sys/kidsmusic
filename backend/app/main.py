"""FastAPI application: API + single-page app in one process."""
from __future__ import annotations

import logging
from contextlib import asynccontextmanager
from pathlib import Path

from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.middleware.gzip import GZipMiddleware
from fastapi.responses import FileResponse, JSONResponse
from fastapi.staticfiles import StaticFiles
from sqlalchemy import text

from .config import get_settings
from .db import get_engine
from .mcp_server import BearerAuthASGI, build_server
from .routers import alphabet, auth, basics, children, instrument, integrations, learn, lessons, material, native, parent_chat, progress, recordings, songs, subjects, system, teacher
from .security import CSRF_HEADER, CSRF_VALUE
from .teacher.service import get_teacher

logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(name)s: %(message)s")
log = logging.getLogger("melo")

UNSAFE_METHODS = {"POST", "PUT", "PATCH", "DELETE"}
CSP = (
    "default-src 'self'; "
    "script-src 'self' 'wasm-unsafe-eval' https://cdn.jsdelivr.net; "
    "connect-src 'self' https://cdn.jsdelivr.net https://storage.googleapis.com; "
    "img-src 'self' data: blob:; media-src 'self' blob:; style-src 'self' 'unsafe-inline'; "
    "worker-src 'self' blob:; font-src 'self'; frame-ancestors 'none'; base-uri 'self'; form-action 'self'"
)


@asynccontextmanager
async def lifespan(_app: FastAPI):
    s = get_settings()
    get_engine()  # initialise lazily (tests may have configured another URL)
    s.resolved_secret_key()
    s.resolved_recording_key()
    t = get_teacher()
    mcp_app = getattr(_app.state, "mcp_app", None)
    log.info("Melo started (env=%s, ai=%s, db=%s)", s.env, t.status()["provider"], s.db_url.split("///")[0])
    if s.is_production and not s.secure_cookies:
        log.info("Cookies are marked Secure automatically on HTTPS requests; set KM_COOKIE_SECURE=true behind an HTTPS proxy")
    if mcp_app is not None:
        async with mcp_app.router.lifespan_context(mcp_app):  # run the MCP session manager
            yield
    else:
        yield


def create_app() -> FastAPI:
    s = get_settings()
    app = FastAPI(title="Melo - AI Music Teacher", version="1.0.0", lifespan=lifespan,
                  docs_url=None if s.is_production else "/api/docs", redoc_url=None, openapi_url=None if s.is_production else "/api/openapi.json")

    if s.cors_origins:
        app.add_middleware(CORSMiddleware, allow_origins=s.cors_origins, allow_credentials=True,
                           allow_methods=["GET", "POST", "PUT", "PATCH", "DELETE"], allow_headers=["Content-Type", "X-Requested-With"])

    app.add_middleware(GZipMiddleware, minimum_size=1024)
    max_body = (s.max_upload_mb + 1) * 1024 * 1024

    @app.middleware("http")
    async def guard(request: Request, call_next):
        path = request.url.path
        if path.startswith("/api/"):
            if request.method in UNSAFE_METHODS and request.headers.get(CSRF_HEADER, "").lower() != CSRF_VALUE:
                return JSONResponse({"detail": "Missing CSRF header"}, status_code=403)
            cl = request.headers.get("content-length")
            if cl is not None and (not cl.isdigit() or int(cl) > max_body):
                return JSONResponse({"detail": "Request too large"}, status_code=413)
        response = await call_next(request)
        response.headers.setdefault("X-Content-Type-Options", "nosniff")
        response.headers.setdefault("Referrer-Policy", "no-referrer")
        response.headers.setdefault("X-Frame-Options", "DENY")
        response.headers.setdefault("Permissions-Policy", "camera=(self), microphone=(self), geolocation=(), payment=()")
        response.headers.setdefault("Content-Security-Policy", CSP)
        if path.startswith("/api/"):
            response.headers.setdefault("Cache-Control", "no-store")
        elif path.startswith("/assets/"):  # content-hashed by Vite
            response.headers.setdefault("Cache-Control", "public, max-age=31536000, immutable")
        if s.secure_cookies:
            response.headers.setdefault("Strict-Transport-Security", "max-age=31536000")
        return response

    for r in (auth.router, children.router, lessons.router, songs.router, basics.router, learn.router, teacher.router, recordings.router,
              integrations.router, progress.router, parent_chat.router, system.router, native.router, instrument.router, material.router, subjects.router,
              alphabet.router):
        app.include_router(r)

    # Claude Code / MCP over streamable HTTP at /mcp/ (Bearer token required).
    from mcp.server.transport_security import TransportSecuritySettings

    hosts = ["127.0.0.1:*", "localhost:*", "[::1]:*", *s.mcp_allowed_hosts]
    mcp_app = build_server().streamable_http_app(  # fresh instance per app (session manager runs once)
        streamable_http_path="/", stateless_http=True, json_response=True,
        transport_security=TransportSecuritySettings(allowed_hosts=hosts, allowed_origins=[f"http://{h}" for h in hosts]),
    )
    app.state.mcp_app = mcp_app
    app.mount("/mcp", BearerAuthASGI(mcp_app))

    @app.get("/api/health")
    def health() -> dict:
        with get_engine().connect() as conn:
            conn.execute(text("SELECT 1"))
        return {"status": "ok", "ai": get_teacher().status()["provider"]}

    @app.api_route("/api/{rest:path}", methods=["GET", "POST", "PUT", "PATCH", "DELETE"], include_in_schema=False)
    def api_not_found(rest: str) -> JSONResponse:
        return JSONResponse({"detail": "Not found"}, status_code=404)

    _mount_spa(app, s.frontend_dist)
    return app


def _mount_spa(app: FastAPI, dist: Path) -> None:
    index = dist / "index.html"
    if not index.exists():
        @app.get("/", include_in_schema=False)
        def no_frontend() -> JSONResponse:
            return JSONResponse({"detail": "Frontend not built. Run scripts/setup (npm run build) or use the Vite dev server."})
        return
    if (dist / "assets").exists():
        app.mount("/assets", StaticFiles(directory=dist / "assets"), name="assets")
    root = dist.resolve()

    @app.get("/{full_path:path}", include_in_schema=False)
    def spa(full_path: str) -> FileResponse:
        candidate = (root / full_path).resolve()
        if full_path and candidate.is_file() and root in candidate.parents:
            return FileResponse(candidate)
        return FileResponse(index, headers={"Cache-Control": "no-cache"})


app = create_app()
