import os
import shutil
import tempfile

import pytest

_TMP = tempfile.mkdtemp(prefix="melo-test-")
os.environ["KM_DATA_DIR"] = _TMP
os.environ["KM_ENV"] = "test"
os.environ["KM_AI_PROVIDER"] = "offline"
os.environ["KM_FRONTEND_DIST"] = os.path.join(_TMP, "no-dist")
os.environ.pop("ANTHROPIC_API_KEY", None)
os.environ["KM_MCP_ALLOWED_HOSTS"] = "testserver"

from fastapi.testclient import TestClient  # noqa: E402

from app.config import get_settings  # noqa: E402
from app.db import init_engine  # noqa: E402
from app.security import rate_limiter  # noqa: E402


@pytest.fixture()
def client():
    get_settings.cache_clear()
    db_path = os.path.join(_TMP, f"t{os.urandom(4).hex()}.db")
    init_engine(f"sqlite:///{db_path}")
    rate_limiter.reset()
    # every test starts with no saved AI brain choice and a fresh teacher
    from app.teacher.service import reset_teacher

    try:
        os.remove(os.path.join(_TMP, "brain.json"))
    except FileNotFoundError:
        pass
    reset_teacher()
    from app.main import create_app

    with TestClient(create_app()) as c:
        c.headers.update({"X-Requested-With": "melo"})
        yield c


def register(c, email="parent@example.com", password="correct-horse-1"):
    r = c.post("/api/auth/register", json={"email": email, "password": password})
    assert r.status_code == 201, r.text
    return r.json()


def make_child(c, **kw):
    body = {"name": "Asha", "age": 5, "language": "hinglish", **kw}
    r = c.post("/api/children", json=body)
    assert r.status_code == 201, r.text
    return r.json()


def pytest_sessionfinish(session, exitstatus):
    shutil.rmtree(_TMP, ignore_errors=True)
