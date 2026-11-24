"""Security sweep: every API route is checked for sign-in, cross-family access (IDOR), crashes on hostile
input (SQL / path / template / shell injection, XSS, huge and odd strings) and leaked internals."""
import base64
import json
import re

from app.instrument import _public_host

from .conftest import make_child, register

# Answer without sign-in on purpose: static catalogues the sign-in page needs, which brain is on (no secrets), logout.
PUBLIC = {("GET", "/api/health"), ("GET", "/api/catalog"), ("GET", "/api/instrument-kinds"), ("GET", "/api/learn/languages"),
          ("GET", "/api/teacher/status"), ("POST", "/api/auth/logout")}
HOSTILE = [
    "' OR '1'='1", "'; DROP TABLE children; --", "1 UNION SELECT 1,2,3--", "../../../../etc/passwd",
    "..\\..\\..\\windows\\win.ini", "<script>alert(1)</script>", "javascript:alert(1)", "{{7*7}}${7*7}",
    "$(whoami)`id`;ls|dir&", "A" * 20000, "%n%s%x", "ಹೌದು‮",
]
LEAK = re.compile(r"scrypt\$|Traceback|sqlite3\.|OperationalError|File \"", re.I)


def _routes(client):
    """Every API operation, from the OpenAPI document (FastAPI keeps included routers out of app.routes)."""
    for path, ops in client.get("/api/openapi.json").json()["paths"].items():
        if path.startswith("/api/"):
            for m in ops:
                yield m.upper(), path


def _fill(path, child_id, other="x1"):
    return re.sub(r"\{[^}]+\}", lambda m: child_id if m.group(0) == "{child_id}" else other, path)


def test_every_route_needs_sign_in_and_no_family_reaches_another(client):
    register(client, "victim@example.com")
    victim = make_child(client)["id"]
    routes = sorted(_routes(client))
    client.post("/api/auth/logout")
    client.cookies.clear()
    assert len(routes) > 80
    open_routes = [(m, p) for m, p in routes if (m, p) not in PUBLIC and client.request(m, _fill(p, victim), json={}).status_code < 300]
    assert open_routes == [], open_routes

    register(client, "attacker@example.com")
    reached = [(m, p) for m, p in routes if "{child_id}" in p and client.request(m, _fill(p, victim), json={}).status_code < 300]
    assert reached == [], reached


def _val(spec, comps, payload, depth=0):
    while "$ref" in spec:
        spec = comps[spec["$ref"].split("/")[-1]]
    if depth > 4:
        return None
    for k in ("anyOf", "oneOf", "allOf"):
        if k in spec:
            return _val(spec[k][0], comps, payload, depth + 1)
    if "enum" in spec:
        return spec["enum"][0]
    t = spec.get("type")
    if t == "object" or "properties" in spec:
        return {n: _val(s, comps, payload, depth + 1) for n, s in spec.get("properties", {}).items()}
    if t == "array":
        return [_val(spec.get("items", {}), comps, payload, depth + 1)]
    return {"integer": 1, "number": 1.0, "boolean": True}.get(t, payload)


def test_hostile_input_never_crashes_or_leaks(client):
    register(client)
    cid = make_child(client)["id"]
    api = client.get("/api/openapi.json").json()
    comps = api.get("components", {}).get("schemas", {})
    bad = []
    for path, ops in api["paths"].items():
        for method, op in ops.items():
            if not path.startswith("/api/") or "logout" in path or method == "delete" or "account" in path:
                continue
            body_spec = op.get("requestBody", {}).get("content", {}).get("application/json", {}).get("schema")
            for pl in HOSTILE:
                url = _fill(path.replace("{child_id}", cid), cid, pl[:200].replace("/", "%2F"))
                params = {p["name"]: _val(p.get("schema", {}), comps, pl) for p in op.get("parameters", []) if p["in"] == "query"}
                r = client.request(method.upper(), url, params=params, json=_val(body_spec, comps, pl) if body_spec else None)
                if r.status_code >= 500 or LEAK.search(r.text):
                    bad.append((r.status_code, method, path, pl[:20]))
    assert bad == []
    assert client.get(f"/api/children/{cid}").status_code == 200  # nothing was dropped


def test_forged_sessions_csrf_and_brute_force(client):
    register(client, "a@example.com")
    assert client.post("/api/children", json={"name": "Bo", "age": 5, "language": "en"}, headers={"X-Requested-With": ""}).status_code == 403
    good = client.cookies.get("melo_session")
    h, p, s = good.split(".")
    none = base64.urlsafe_b64encode(json.dumps({"alg": "none", "typ": "JWT"}).encode()).rstrip(b"=").decode() + f".{p}."
    for tok in (none, f"{h}.{p}.{s[:-4]}AAAA"):
        client.cookies.clear()
        client.cookies.set("melo_session", tok)
        assert client.get("/api/children").status_code == 401
    client.cookies.clear()
    codes = [client.post("/api/auth/login", json={"email": "a@example.com' OR '1'='1", "password": "' OR '1'='1"}).status_code for _ in range(12)]
    assert set(codes[:10]) == {401} and codes[-1] == 429
    assert client.post("/mcp/", json={}).status_code == 401
    assert client.post("/mcp/", json={}, headers={"Authorization": "Bearer guess"}).status_code == 401


def test_links_and_uploads_cannot_carry_scripts(client):
    register(client)
    cid = make_child(client)["id"]
    assert client.put(f"/api/children/{cid}/instrument", json={"sources": ["javascript:alert(1)"]}).status_code == 422
    for name, data, ct in [("x.svg", b"<svg onload=alert(1)>", "image/svg+xml"), ("x.html", b"<script>", "text/html"),
                           ("x.jpg", b"<script>alert(1)</script>", "image/jpeg")]:
        assert client.post(f"/api/children/{cid}/instrument/photos", files={"file": (name, data, ct)}).status_code == 415


def test_link_reader_never_reaches_this_computer_or_home_network():
    for host in ("127.0.0.1", "localhost", "::1", "::ffff:127.0.0.1", "::ffff:192.168.1.1", "10.0.0.1", "169.254.169.254", "0.0.0.0"):
        assert not _public_host(host), host


def test_ai_brain_may_only_read_the_photo_folder(tmp_path, monkeypatch):
    from app.config import get_settings
    from app.teacher import service

    monkeypatch.setattr(service, "find_claude_cli", lambda _b: "claude")
    monkeypatch.setattr(get_settings(), "data_dir", tmp_path)
    p = service._ClaudeCodeProvider(get_settings())
    assert "--allowedTools" not in p.command({}, "")
    cmd = p.command({}, "Read")
    assert cmd[cmd.index("--allowedTools") + 1] == "Read(./vision/**)" and cmd[cmd.index("--tools") + 1] == "Read"
