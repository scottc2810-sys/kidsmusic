#!/usr/bin/env bash
# Build the Melo desktop app on macOS or Linux (run it on the system you are building for;
# PyInstaller cannot cross-compile).
#   ./packaging/build.sh
# macOS  -> dist/Melo.app and dist/Melo-<version>.dmg   (drag Melo to Applications)
# Linux  -> dist/Melo-<version>-x86_64.AppImage (double-click) and dist/Melo-linux.tar.gz (+ install.sh)
# Needs Python 3.11+ with tkinter (Linux: sudo apt install python3-venv python3-tk) and Node.js 18+.
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"
VERSION="1.4.0"
PY="${PYTHON:-python3}"

echo "==> Python environment"
[ -d backend/.venv ] || "$PY" -m venv backend/.venv
VPY=backend/.venv/bin/python
"$VPY" -m pip install --quiet --upgrade pip
"$VPY" -m pip install --quiet -r backend/requirements.txt -c backend/requirements.lock pyinstaller pillow

echo "==> Web app"
( cd frontend && { [ -d node_modules ] || npm ci --no-audit --no-fund; } && npm run build )

echo "==> Desktop app"
"$VPY" packaging/make_icons.py
"$VPY" -m PyInstaller packaging/melo.spec --noconfirm --distpath dist --workpath build

case "$(uname -s)" in
  Darwin)
    echo "==> Disk image"
    rm -rf build/dmg && mkdir -p build/dmg
    cp -R dist/Melo.app build/dmg/
    ln -s /Applications build/dmg/Applications
    hdiutil create -volname "Melo" -srcfolder build/dmg -ov -format UDZO "dist/Melo-$VERSION.dmg"
    echo "Done: dist/Melo-$VERSION.dmg"
    echo "Note: the app is not signed with an Apple Developer ID. The first time, right-click Melo and choose Open."
    ;;
  Linux)
    echo "==> Portable archive"
    cp packaging/linux/install.sh packaging/linux/melo.desktop packaging/icons/melo.png dist/Melo/
    tar -C dist -czf dist/Melo-linux.tar.gz Melo
    echo "==> AppImage"
    APPDIR=build/Melo.AppDir
    rm -rf "$APPDIR" && mkdir -p "$APPDIR/usr/bin"
    cp -R dist/Melo/. "$APPDIR/usr/bin/"
    cp packaging/linux/melo.desktop "$APPDIR/melo.desktop"
    cp packaging/icons/melo.png "$APPDIR/melo.png"
    printf '#!/bin/sh\nexec "$(dirname "$(readlink -f "$0")")/usr/bin/Melo" "$@"\n' > "$APPDIR/AppRun"
    chmod +x "$APPDIR/AppRun"
    TOOL=build/appimagetool
    if [ ! -x "$TOOL" ]; then
      curl -fsSL -o "$TOOL" "https://github.com/AppImage/appimagetool/releases/download/continuous/appimagetool-$(uname -m).AppImage" && chmod +x "$TOOL" || TOOL=""
    fi
    if [ -n "$TOOL" ] && ARCH="$(uname -m)" "$TOOL" --appimage-extract-and-run "$APPDIR" "dist/Melo-$VERSION-$(uname -m).AppImage"; then
      echo "Done: dist/Melo-$VERSION-$(uname -m).AppImage (make it executable, then double-click)"
    else
      echo "AppImage tool unavailable; use dist/Melo-linux.tar.gz (unpack and run ./install.sh)"
    fi
    ;;
  *) echo "Unsupported system: $(uname -s)"; exit 1 ;;
esac
