#!/bin/sh
# SimonSays for Linux (3.1): installs the folder this script is in, just for you, with no sudo.
#
#   ./install.sh            install, or update an installed copy to this one
#
# The program goes to ~/.local/opt/simonsays; what is yours (data, pictures, settings, backups, versions
# updated to) stays in ~/.local/share/simonsays, apart from it, so installing again or uninstalling keeps it.
# It runs as a systemd user service, started now and at every sign-in; on a computer with no desktop it
# listens on the network, so you can open it from another device.
set -eu

say() { printf '%s\n' "SimonSays: $*"; }
die() { printf '%s\n' "SimonSays: $*" >&2; exit 1; }

[ "$(id -u)" -ne 0 ] || die "run this as your own user, without sudo: SimonSays is installed just for you"
HERE=$(cd "$(dirname "$0")" && pwd)
[ -x "$HERE/node/node" ] && [ -f "$HERE/start.js" ] || die "run install.sh from inside the unpacked SimonSays folder"
case "$(uname -m)" in x86_64|amd64) ;; *) die "this build is for 64-bit Intel/AMD (x86_64); this computer is $(uname -m)" ;; esac
"$HERE/node/node" -e "" 2>/dev/null || die "the Node in this folder does not run here (it needs glibc 2.28 or newer)"

PROGRAM="$HOME/.local/opt/simonsays"
HOME_DIR="${XDG_DATA_HOME:-$HOME/.local/share}/simonsays"
UNIT_DIR="${XDG_CONFIG_HOME:-$HOME/.config}/systemd/user"
APPS="${XDG_DATA_HOME:-$HOME/.local/share}/applications"
HAS_SYSTEMD=0
systemctl --user show-environment >/dev/null 2>&1 && HAS_SYSTEMD=1
DESKTOP=0
[ -n "${DISPLAY:-}${WAYLAND_DISPLAY:-}" ] && DESKTOP=1

# The copy running now, stopped while the program is replaced; what is yours is not touched.
if [ "$HAS_SYSTEMD" = 1 ] && systemctl --user is-active --quiet simonsays 2>/dev/null; then
  say "stopping the SimonSays running now"
  systemctl --user stop simonsays
fi

if [ "$HERE" != "$PROGRAM" ]; then
  say "installing to $PROGRAM"
  mkdir -p "$(dirname "$PROGRAM")"
  rm -rf "$PROGRAM.new"
  cp -a "$HERE" "$PROGRAM.new"
  [ -d "$PROGRAM" ] && mv "$PROGRAM" "$PROGRAM.old"
  mv "$PROGRAM.new" "$PROGRAM"
  rm -rf "$PROGRAM.old"
fi
# An installed copy: its things live in the home, not beside the program (start.js, homeFor).
[ -f "$PROGRAM/installed.json" ] || printf '{ "home": "user" }\n' > "$PROGRAM/installed.json"

mkdir -p "$HOME_DIR"
ENV="$HOME_DIR/.env"
if [ ! -f "$ENV" ]; then
  # A free port: 8081, or the next one free when something else has it.
  PORT=$("$PROGRAM/node/node" -e '
    const net = require("net");
    const free = (p) => new Promise((r) => { const s = net.createServer(); s.once("error", () => r(false)); s.listen(p, "0.0.0.0", () => s.close(() => r(true))); });
    (async () => { for (let p = 8081; p < 8100; p += 1) if (await free(p)) { console.log(p); return; } console.log(""); })();
  ')
  [ -n "$PORT" ] || die "no free port between 8081 and 8099: set PORT= in $ENV and run this again"
  {
    printf '# SimonSays settings (read at start). See the README for every one.\n'
    printf 'PORT=%s\n' "$PORT"
    # No desktop here: you open the dashboard from another device, so it listens on the network.
    if [ "$DESKTOP" = 0 ]; then printf 'HOST=0.0.0.0\n'; fi
  } > "$ENV"
  [ "$PORT" = 8081 ] || say "port 8081 is taken here, so SimonSays uses $PORT"
fi
PORT=$(sed -n 's/^[[:space:]]*PORT[[:space:]]*=[[:space:]]*//p' "$ENV" | tail -1)
PORT=${PORT:-8081}

if [ "$HAS_SYSTEMD" = 1 ]; then
  mkdir -p "$UNIT_DIR"
  cat > "$UNIT_DIR/simonsays.service" <<EOF
[Unit]
Description=SimonSays: stream automation
After=network-online.target
Wants=network-online.target

[Service]
WorkingDirectory=$PROGRAM
ExecStart=$PROGRAM/node/node $PROGRAM/start.js
Restart=on-failure
RestartSec=5
# Stopping sends SIGTERM: the server saves and says goodbye, the launcher follows.
TimeoutStopSec=25

[Install]
WantedBy=default.target
EOF
  systemctl --user daemon-reload
  systemctl --user enable --now simonsays >/dev/null 2>&1 || systemctl --user start simonsays
else
  say "no systemd user session here: start it with $PROGRAM/simonsays.sh"
fi

if [ "$DESKTOP" = 1 ]; then
  mkdir -p "$APPS"
  cat > "$APPS/simonsays.desktop" <<EOF
[Desktop Entry]
Type=Application
Name=SimonSays
Comment=Chat, overlays and buttons for your stream
Exec=xdg-open http://localhost:$PORT/
Icon=$PROGRAM/simonsays.png
Categories=AudioVideo;Network;
EOF
fi

if [ "$HAS_SYSTEMD" = 1 ]; then
  say "starting"
  UP=0
  for _ in $(seq 1 60); do
    if "$PROGRAM/node/node" -e "fetch('http://127.0.0.1:$PORT/api/health').then(r=>process.exit(r.ok?0:1),()=>process.exit(1))" 2>/dev/null; then UP=1; break; fi
    sleep 1
  done
  [ "$UP" = 1 ] || die "it did not answer within a minute: see journalctl --user -u simonsays"
fi

IP=$(hostname -I 2>/dev/null | awk '{print $1}')
say "ready. Open http://localhost:$PORT/ on this computer${IP:+, or http://$IP:$PORT/ from another device on your network}."
say "Stop it:  systemctl --user stop simonsays     What it says:  journalctl --user -u simonsays -f"
if [ "$DESKTOP" = 0 ] && [ "$HAS_SYSTEMD" = 1 ]; then
  say "to keep it running when you are logged out: loginctl enable-linger $(id -un)"
fi
say "your things are kept in $HOME_DIR; uninstall with $PROGRAM/uninstall.sh"
