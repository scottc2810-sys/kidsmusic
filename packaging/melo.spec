# PyInstaller build of the Melo desktop app (Windows, macOS, Linux).
#   python -m PyInstaller packaging/melo.spec --noconfirm --distpath dist --workpath build
# Produces dist/Melo/ (a folder with Melo.exe / Melo) and, on macOS, dist/Melo.app.
# The built web app (frontend/dist) and the language packs are bundled inside.
import sys
from pathlib import Path

from PyInstaller.utils.hooks import collect_data_files, collect_submodules

ROOT = Path(SPECPATH).parent
BACKEND = ROOT / "backend"
DIST = ROOT / "frontend" / "dist"
if not (DIST / "index.html").is_file():
    raise SystemExit("frontend/dist is missing: run `npm ci && npm run build` in frontend/ first")

datas = [
    (str(DIST), "frontend_dist"),
    (str(BACKEND / "app" / "teacher" / "locales"), "app/teacher/locales"),
]
datas += collect_data_files("mcp")
# Native-speaker recordings (Lingua Libre, CC BY-SA), when they were downloaded on the build machine:
# shipped read-only so families hear real voices without downloading anything.
# Family recordings (a grandparent's voice recorded at home) stay on that computer: only public ones are copied.
NATIVE = ROOT / "data" / "native_audio"
if (NATIVE / "manifest.json").is_file():
    import json
    import shutil

    bundle = ROOT / "build" / "native_bundle"
    shutil.rmtree(bundle, ignore_errors=True)
    public = {}
    for lang, items in json.loads((NATIVE / "manifest.json").read_text(encoding="utf-8")).items():
        for item, refs in items.items():
            # not family voices, and not non-commercial recordings (Tatoeba CC BY-NC...): those are downloaded by each family
            # nor Common Voice clips ("noshare": its terms forbid re-sharing the dataset)
            keep = [r for r in refs if not r.get("family") and not r.get("noncommercial") and not r.get("noshare")
                    and (NATIVE / r["file"]).is_file()]
            for r in keep:
                (bundle / lang).mkdir(parents=True, exist_ok=True)
                shutil.copy2(NATIVE / r["file"], bundle / r["file"])
            if keep:
                public.setdefault(lang, {})[item] = keep
    if public:
        (bundle / "manifest.json").write_text(json.dumps(public, ensure_ascii=False), encoding="utf-8")
        datas.append((str(bundle), "native_audio"))
hidden = (
    collect_submodules("app") + collect_submodules("uvicorn") + collect_submodules("mcp", filter=lambda n: not n.startswith("mcp.cli"))
    + ["sqlalchemy.dialects.sqlite", "anthropic", "multipart", "python_multipart", "dotenv", "jwt", "cryptography.fernet"]
)
icon = {"win32": ROOT / "packaging" / "icons" / "melo.ico", "darwin": ROOT / "packaging" / "icons" / "melo.icns"}.get(sys.platform)
icon = str(icon) if icon and icon.is_file() else None

a = Analysis(
    [str(BACKEND / "melo_app.py")],
    pathex=[str(BACKEND)],
    datas=datas,
    hiddenimports=hidden,
    excludes=["pytest", "IPython", "matplotlib", "PIL", "pandas", "scipy"],
    noarchive=False,
)
pyz = PYZ(a.pure)
exe = EXE(
    pyz, a.scripts, [],
    exclude_binaries=True,
    name="Melo",
    console=False,  # no terminal window; output goes to melo.log in the data folder
    icon=icon,
    upx=False,
)
coll = COLLECT(exe, a.binaries, a.datas, name="Melo", upx=False)
if sys.platform == "darwin":
    app = BUNDLE(
        coll, name="Melo.app", icon=icon, bundle_identifier="app.melo.teacher",
        info_plist={"CFBundleShortVersionString": "1.4.0", "NSHighResolutionCapable": True, "LSMinimumSystemVersion": "11.0"},
    )
