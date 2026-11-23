#!/bin/sh
# Install Melo for the current user (no root): copies the app to ~/.local/share/melo-app and adds it to
# the applications menu. Run from the unpacked Melo folder:  ./install.sh
#
# System check first. Melo bundles its own Python and web app; it only needs a few common system
# libraries and a web browser. Anything missing is listed, and NOTHING is installed without asking:
# for each missing piece the script asks (y/N) before using the system package manager (sudo), or you
# can install it yourself and run ./install.sh again. Optional: Ollama, a free local AI brain.
set -eu
SRC="$(cd "$(dirname "$0")" && pwd)"
DEST="${XDG_DATA_HOME:-$HOME/.local/share}/melo-app"
APPS="${XDG_DATA_HOME:-$HOME/.local/share}/applications"
YES="${MELO_YES:-}"  # MELO_YES=1 ./install.sh answers yes to every question (for automated installs)

ask() {  # ask "question"  -> 0 for yes
  [ -n "$YES" ] && return 0
  [ -t 0 ] || return 1  # not interactive: never install anything unasked
  printf '%s [y/N] ' "$1"
  read -r a || return 1
  case "$a" in y|Y|yes|YES) return 0 ;; *) return 1 ;; esac
}

pkg_install() {  # pkg_install <apt pkgs> <dnf pkgs> <pacman pkgs>
  if command -v apt-get >/dev/null 2>&1; then sudo apt-get install -y $1
  elif command -v dnf >/dev/null 2>&1; then sudo dnf install -y $2
  elif command -v pacman >/dev/null 2>&1; then sudo pacman -S --needed --noconfirm $3
  else echo "  Please install with your package manager: $1"; return 1; fi
}

echo "== Melo system check =="
ok=1
arch="$(uname -m)"
if [ "$arch" != "x86_64" ] && [ "$arch" != "aarch64" ]; then echo "  [!!] Unsupported processor: $arch"; exit 1; fi
echo "  [OK] processor: $arch"
free_mb=$(df -Pm "$HOME" | awk 'NR==2 {print $4}')
if [ "${free_mb:-0}" -lt 700 ]; then echo "  [!!] Only ${free_mb} MB free in $HOME: Melo needs about 700 MB."; exit 1; fi
echo "  [OK] disk space: ${free_mb} MB free"

# libraries the bundled app links against (reported by the dynamic linker, not guessed)
missing="$(ldd "$SRC/Melo" 2>/dev/null | awk '/not found/ {print $1}' | sort -u | tr '\n' ' ')"
if [ -n "$missing" ]; then
  ok=0
  echo "  [!!] missing system libraries: $missing"
  if ask "  Install the usual ones now (needs sudo: libgl1, libxkbcommon0, libtk8.6, libfuse2)?"; then
    pkg_install "libgl1 libxkbcommon0 tk libfuse2" "mesa-libGL libxkbcommon tk fuse-libs" "mesa libxkbcommon tk fuse2" && ok=1
  else
    echo "  Install them yourself, then run ./install.sh again."
  fi
else
  echo "  [OK] system libraries"
fi
if command -v xdg-open >/dev/null 2>&1; then echo "  [OK] xdg-open (opens Melo in your browser)"
else
  echo "  [--] xdg-open missing: open http://127.0.0.1:8000 in your browser yourself"
  ask "  Install xdg-utils now (needs sudo)?" && pkg_install xdg-utils xdg-utils xdg-utils || true
fi
browser=""
for b in microsoft-edge google-chrome chromium chromium-browser firefox; do command -v "$b" >/dev/null 2>&1 && browser="$b" && break; done
if [ -n "$browser" ]; then echo "  [OK] browser: $browser (speaking practice works best in Chrome or Edge)"
else echo "  [--] no browser found: install Chrome, Edge or Firefox"; fi
if command -v claude >/dev/null 2>&1; then echo "  [OK] Claude Code found: Melo can use it as its AI brain"
else echo "  [--] Claude Code not found (optional AI brain): https://claude.com/claude-code"; fi
if command -v ollama >/dev/null 2>&1; then echo "  [OK] Ollama found: a free local AI brain"
else
  echo "  [--] Ollama not found (optional free local AI brain)"
  if ask "  Install Ollama now from ollama.com (about 1 GB, runs its official install script)?"; then
    curl -fsSL https://ollama.com/install.sh | sh || echo "  Ollama install failed; Melo works without it."
  fi
fi
if [ "$ok" -ne 1 ]; then echo "Some required libraries are missing; Melo may not start until they are installed."; fi

echo "== Installing Melo =="
rm -rf "$DEST"
mkdir -p "$DEST" "$APPS"
cp -R "$SRC/." "$DEST/"
chmod +x "$DEST/Melo"
sed "s|^Exec=.*|Exec=$DEST/Melo|; s|^Icon=.*|Icon=$DEST/melo.png|" "$SRC/melo.desktop" > "$APPS/melo.desktop"
command -v update-desktop-database >/dev/null 2>&1 && update-desktop-database "$APPS" >/dev/null 2>&1 || true
echo "Melo is installed. Find it in your applications menu, or run: $DEST/Melo"
