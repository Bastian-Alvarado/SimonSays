#!/bin/sh
# SimonSays for Linux (3.1): removes the installed program, its service and its menu entry.
#
#   ~/.local/opt/simonsays/uninstall.sh            keeps your things
#   ~/.local/opt/simonsays/uninstall.sh --purge    deletes them too (asked first when there is someone to ask)
#
# What is yours (data, pictures, settings, backups) is kept in ~/.local/share/simonsays unless you say so,
# so installing again later brings everything back.
set -eu

say() { printf '%s\n' "SimonSays: $*"; }

PROGRAM="$HOME/.local/opt/simonsays"
HOME_DIR="${XDG_DATA_HOME:-$HOME/.local/share}/simonsays"
UNIT="${XDG_CONFIG_HOME:-$HOME/.config}/systemd/user/simonsays.service"
DESKTOP_FILE="${XDG_DATA_HOME:-$HOME/.local/share}/applications/simonsays.desktop"
PURGE=0
[ "${1:-}" = "--purge" ] && PURGE=1

if systemctl --user show-environment >/dev/null 2>&1; then
  # Stopped first: SIGTERM, so it saves and says goodbye.
  systemctl --user disable --now simonsays >/dev/null 2>&1 || true
  rm -f "$UNIT"
  systemctl --user daemon-reload || true
fi
rm -f "$DESKTOP_FILE"
# Out of the program's own folder before it goes.
cd "$HOME"
rm -rf "$PROGRAM"
# ~/.local/opt too, when nothing else is in it (install.sh made it).
rmdir "$(dirname "$PROGRAM")" 2>/dev/null || true
say "removed the program"

if [ -d "$HOME_DIR" ]; then
  if [ "$PURGE" = 1 ] && [ -t 0 ]; then
    printf 'Delete your SimonSays data too (layouts, commands, accounts, pictures, backups) in %s? This cannot be undone. [y/N] ' "$HOME_DIR"
    read -r ANSWER
    case "$ANSWER" in y|Y|yes|YES) ;; *) PURGE=0 ;; esac
  fi
  if [ "$PURGE" = 1 ]; then
    rm -rf "$HOME_DIR"
    say "deleted your data"
  else
    say "your things are kept in $HOME_DIR (install again to have them back; uninstall.sh --purge to delete them)"
  fi
fi
