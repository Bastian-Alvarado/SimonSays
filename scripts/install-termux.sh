#!/data/data/com.termux/files/usr/bin/sh
# SimonSays on an Android phone, with Termux (3.1): one command.
#
#   curl -fsSL https://github.com/<repository>/releases/latest/download/install-termux.sh | sh
#
# Attached to each release with its repository, version and checksum filled in (.local/release.sh), so it
# installs exactly that release: the app with its web part built (no building on the phone), its packages
# from npm, a port of its own, starting when the phone boots (Termux:Boot), and started now.
#
# It never touches a SimonSays already on the phone: a folder that is there is refused, a boot script that
# is there is left alone, and a port in use is skipped. Settings, all optional:
#   SIMONSAYS_DIR=~/somewhere   where to install (default ~/SimonSays)
#   SIMONSAYS_PORT=8090         the port (default 8081, or the next free one)
#   SIMONSAYS_NO_BOOT=1         do not start it when the phone boots, nor take Termux's wake lock (a trial copy)
set -eu

REPO='__SIMONSAYS_REPO__'
VERSION='__SIMONSAYS_VERSION__'
SHA256='__SIMONSAYS_SHA256__'

say() { printf '%s\n' "SimonSays: $*"; }
die() { printf '%s\n' "SimonSays: $*" >&2; exit 1; }

case "$REPO$VERSION$SHA256" in *__SIMONSAYS_*) die "this script is attached to a release: run it from there (the command on the SimonSays website)" ;; esac
case "${PREFIX:-}" in *com.termux*) ;; *) die "this is for Termux on Android; on a Linux PC, use SimonSays-Linux-x64.tar.gz" ;; esac

DIR="${SIMONSAYS_DIR:-$HOME/SimonSays}"
BOOT_DIR="$HOME/.termux/boot"
BOOT="$BOOT_DIR/simonsays-$(basename "$DIR")"
[ ! -e "$DIR" ] || die "$DIR is already there: SimonSays updates itself from Settings → About. To install another copy, set SIMONSAYS_DIR=~/another-folder"

# Node 22 or newer: Termux's own, installed only when there is none.
if command -v node >/dev/null 2>&1; then
  MAJOR=$(node -p 'process.versions.node.split(".")[0]')
  [ "$MAJOR" -ge 22 ] || die "Node $(node -v) is older than SimonSays needs (22): run pkg upgrade, then this again"
else
  say "installing Node (Termux's nodejs-lts)"
  pkg install -y nodejs-lts
fi

TGZ="${TMPDIR:-$PREFIX/tmp}/simonsays-$VERSION.tgz"
say "downloading SimonSays $VERSION"
curl -fsSL -o "$TGZ" "https://github.com/$REPO/releases/download/v$VERSION/simonsays-$VERSION.tgz"
[ "$(sha256sum "$TGZ" | cut -c1-64)" = "$SHA256" ] || { rm -f "$TGZ"; die "the download is not what the release says it is; nothing was installed"; }

mkdir -p "$DIR"
tar -xzf "$TGZ" -C "$DIR"
rm -f "$TGZ"
say "installing what it needs (a few minutes on a phone)"
# npm ci keeps to the release's lock; a newer npm than it was written with may call it out of step, then npm install.
( cd "$DIR/server" && { npm ci --omit=dev --ignore-scripts --no-audit --no-fund >/dev/null 2>&1 || npm install --omit=dev --ignore-scripts --no-audit --no-fund >/dev/null; } )

# A port of its own: the one asked for, or 8081, or the next one free.
PORT=$(SIMONSAYS_PORT="${SIMONSAYS_PORT:-}" node -e '
  const net = require("net");
  const free = (p) => new Promise((r) => { const s = net.createServer(); s.once("error", () => r(false)); s.listen(p, "0.0.0.0", () => s.close(() => r(true))); });
  (async () => {
    const asked = Number(process.env.SIMONSAYS_PORT);
    if (asked) { console.log((await free(asked)) ? asked : ""); return; }
    for (let p = 8081; p < 8100; p += 1) if (await free(p)) { console.log(p); return; }
    console.log("");
  })();
')
[ -n "$PORT" ] || die "no free port (set SIMONSAYS_PORT=another one); SimonSays is in $DIR, not started"
printf '# SimonSays settings (read at start). See the README for every one.\nPORT=%s\n' "$PORT" > "$DIR/.env"
printf 'installed by install-termux.sh %s\n' "$VERSION" > "$DIR/.installed-by-termux"

# Started when the phone boots (the Termux:Boot app), unless asked not to; a boot script already there is left alone.
if [ -z "${SIMONSAYS_NO_BOOT:-}" ]; then
  if [ -e "$BOOT" ]; then
    say "$BOOT is already there: left as it is"
  else
    mkdir -p "$BOOT_DIR"
    cat > "$BOOT" <<EOF
#!/data/data/com.termux/files/usr/bin/sh
# SimonSays in $DIR, started when the phone boots (install-termux.sh).
termux-wake-lock
cd "$DIR" && exec node start.js > "$DIR/simonsays.log" 2>&1
EOF
    chmod 700 "$BOOT"
  fi
fi

# Termux's wake lock keeps Android from putting it to sleep; a trial copy (SIMONSAYS_NO_BOOT) leaves the phone's as it is.
if [ -z "${SIMONSAYS_NO_BOOT:-}" ] && command -v termux-wake-lock >/dev/null 2>&1; then termux-wake-lock || true; fi
( cd "$DIR" && nohup node start.js > "$DIR/simonsays.log" 2>&1 & echo $! > "$DIR/simonsays.pid" )
say "starting"
UP=0
for _ in $(seq 1 90); do
  if node -e "fetch('http://127.0.0.1:$PORT/api/health').then(r=>process.exit(r.ok?0:1),()=>process.exit(1))" 2>/dev/null; then UP=1; break; fi
  sleep 1
done
[ "$UP" = 1 ] || die "it did not answer within 90 seconds: see $DIR/simonsays.log"

# The phone's address on the Wi-Fi: Node's own list (Android keeps `ip` from showing it), or ifconfig.
IP=$(node -e 'const n=require("os").networkInterfaces();const a=(n.wlan0||Object.values(n).flat()).find((x)=>x.family==="IPv4"&&!x.internal);console.log(a?a.address:"")' 2>/dev/null || true)
[ -n "$IP" ] || IP=$(ifconfig 2>/dev/null | grep -A1 wlan0 | sed -n 's/.*inet \([0-9.]*\).*/\1/p' | head -1)
say "ready. Open http://${IP:-this-phone's-address}:$PORT/ from your PC on the same Wi-Fi."
say "Stop it: kill \$(cat $DIR/simonsays.pid)     What it says: tail -f $DIR/simonsays.log"
[ -n "${SIMONSAYS_NO_BOOT:-}" ] || say "for it to start when the phone boots, install the Termux:Boot app and open it once"
say "keep Android from stopping it: Settings → Apps → Termux → Battery → Unrestricted"
