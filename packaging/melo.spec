# PyInstaller build of the Melo desktop app (Windows, macOS, Linux).
#   python -m PyInstaller packaging/melo.spec --noconfirm --distpath dist --workpath build
# Produces dist/Melo/ (a folder with Melo.exe / Melo) and, on macOS, dist/Melo.app.
# The built web app (frontend/dist) and the language packs are bundled inside.
import os
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
datas += collect_data_files("mcp") + collect_data_files("certifi") + collect_data_files("gtts")
# Recordings shipped read-only so every word has a voice without downloading anything: native speakers
# (licences that allow it) and neural-voice clips for words without one. See packaging/voices.py.
sys.path.insert(0, str(ROOT / "packaging"))
import voices  # noqa: E402

bundle = ROOT / "build" / "native_bundle"
shipped = voices.bundle(bundle)
print(f"Melo voices bundled: {shipped}")
if any(shipped.values()):
    datas.append((str(bundle), "native_audio"))
hidden = (
    collect_submodules("app") + collect_submodules("uvicorn") + collect_submodules("mcp", filter=lambda n: not n.startswith("mcp.cli"))
    + ["sqlalchemy.dialects.sqlite", "anthropic", "multipart", "python_multipart", "dotenv", "jwt", "cryptography.fernet", "miniaudio"]
    + collect_submodules("edge_tts") + collect_submodules("gtts")  # neural voices for words without a native recording
)
icon = {"win32": ROOT / "packaging" / "icons" / "melo.ico", "darwin": ROOT / "packaging" / "icons" / "melo.icns"}.get(sys.platform)
icon = str(icon) if icon and icon.is_file() else None
# macOS signing (optional): MELO_CODESIGN_IDENTITY="Developer ID Application: Name (TEAMID)" signs every binary
# with the hardened runtime, as notarization requires. Unset = unsigned build (right-click > Open the first time).
sign_id = (os.environ.get("MELO_CODESIGN_IDENTITY") or None) if sys.platform == "darwin" else None
entitlements = str(ROOT / "packaging" / "macos" / "entitlements.plist") if sign_id else None

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
    codesign_identity=sign_id,
    entitlements_file=entitlements,
)
coll = COLLECT(exe, a.binaries, a.datas, name="Melo", upx=False)
if sys.platform == "darwin":
    app = BUNDLE(
        coll, name="Melo.app", icon=icon, bundle_identifier="app.melo.teacher",
        info_plist={"CFBundleShortVersionString": "1.6.0", "NSHighResolutionCapable": True, "LSMinimumSystemVersion": "11.0"},
    )
