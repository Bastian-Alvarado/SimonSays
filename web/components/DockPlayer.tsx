/**
 * @license
 * SPDX-License-Identifier: Apache-2.0 AND LicenseRef-Commons-Clause-1.0
 *
 * The stream itself, in the dock: Twitch's own player, for a moderator who
 * works from a phone and has no second screen to watch on.
 *
 * Twitch's player, and only that. The picture comes straight from Twitch to
 * the phone, as it does to any viewer, so it costs the streamer's computer and
 * the server nothing; pictures taken from OBS would have gone through both for
 * every moderator watching, and the streamer did not want that load.
 *
 * Off unless switched on, and on one device at a time (the Watch button by the
 * tabs, kept in this browser): a moderator who watches on a phone but docks at
 * a desk with the stream on another screen turns it on where it helps.
 *
 * Twitch's rules for its player shape the box (dev.twitch.tv/docs/embed): the
 * page must be https, so at a home-network http address it says where it
 * plays instead of a player that would only show Twitch's error; and the
 * player must be at least 300 tall and is not to be covered, so it has its own
 * space at the top (300 tall, or half a short window, so the chat keeps the
 * other half; beside the tabs on a phone held sideways), never an overlay.
 * A phone held upright is narrower than the 400 Twitch asks for;
 * that can't be helped, and holding it sideways gives the player its room.
 * It starts muted, as a phone asks a tap before sound anyway.
 */
import React from 'react';
import { Tv } from 'lucide-react';

interface DockPlayerProps {
  /** The Twitch channel being streamed to (Connections). */
  channel: string;
  /** Beside the panels rather than a band on top: a phone held sideways, or a wide window at a desk. */
  beside?: boolean;
  /** The height the page keeps for itself above and below the player there: its padding, and the tab bar when that is on top. */
  topRoom?: number;
  /**
   * Beside the panels, what goes under the player in its column: the stream's
   * line (DockStreamInfo) and a second panel (DockBelow). The width leaves
   * UNDER_ROOM for the line, so it fits even with the picture at full height.
   */
  children?: React.ReactNode;
  t: any;
}

/** The stream's line under the player (28) and the gaps around it (4 each): what the width leaves under a full-height picture. */
export const UNDER_ROOM = 36;

/** The player's address: this page's own host as the parent Twitch checks, muted, playing as soon as it may. */
export const twitchPlayerUrl = (channel: string, host: string) =>
  `https://player.twitch.tv/?channel=${encodeURIComponent(channel)}&parent=${encodeURIComponent(host)}&muted=true&autoplay=true`;

/*
  Beside the panels (a phone held sideways, a wide desk window), how much of
  the width the player takes is the moderator's to drag (the handle between
  it and the panels), kept on this device. The box
  is always exactly 16:9, so the picture fills it with no bars of Twitch's:
  as wide as asked, unless the height runs out first. A phone is wider than
  16:9 sideways, so all of the height and a usable chat can't both be had;
  where the line goes is a choice, not a guess. The split is of the page's
  width, measured from the player's own left edge.
*/
const SPLIT_KEY = 'dock_watch_split';
const SPLIT_MIN = 0.3;
const SPLIT_MAX = 0.9;
const clampSplit = (n: number) => Math.min(SPLIT_MAX, Math.max(SPLIT_MIN, n));
const savedSplit = () => {
  try { const n = Number(localStorage.getItem(SPLIT_KEY)); return n ? clampSplit(n) : 0.6; } catch { return 0.6; }
};

export const DockPlayer: React.FC<DockPlayerProps> = ({ channel, beside = false, topRoom = 16, children = null, t }) => {
  const [split, setSplit] = React.useState(savedSplit);
  const dragging = React.useRef(false);
  // The split as dragged, for saving when the finger lifts (the state is a render behind by then).
  const live = React.useRef(split);
  const endDrag = () => {
    if (!dragging.current) return;
    dragging.current = false;
    try { localStorage.setItem(SPLIT_KEY, live.current.toFixed(3)); } catch { /* this visit only */ }
  };
  const box = beside
    ? 'w-full shrink-0 aspect-video'
    : 'w-full shrink-0 mb-2 aspect-video min-h-[min(300px,50dvh)] max-h-[50dvh]';
  // The column's width: as wide as the split asks, but no wider than 16:9 of the height there is
  // (what the page keeps, and the stream's line under it, taken off).
  const columnStyle = { width: `min(calc(${split.toFixed(3)} * (100vw - 16px)), calc((100dvh - ${topRoom + UNDER_ROOM}px) * 16 / 9))` };
  const column = (inside: React.ReactNode) => (
    <div style={columnStyle} className="shrink-0 self-stretch min-h-0 flex flex-col gap-1" data-dock-side>
      {inside}
      {children}
    </div>
  );
  const handle = (
    <div
      role="separator" aria-orientation="vertical" aria-label={t.dockWatchResize || 'Drag to share the width between the stream and the panels'}
      aria-valuemin={SPLIT_MIN * 100} aria-valuemax={SPLIT_MAX * 100} aria-valuenow={Math.round(split * 100)} tabIndex={0}
      className="w-3 -mx-1 shrink-0 self-stretch flex items-center justify-center cursor-col-resize touch-none"
      // Captured, so the drag stays with the handle when the finger passes over the player's frame.
      onPointerDown={(e) => { dragging.current = true; e.currentTarget.setPointerCapture(e.pointerId); }}
      onPointerMove={(e) => {
        if (!dragging.current) return;
        const start = e.currentTarget.previousElementSibling?.getBoundingClientRect().left ?? 0;
        live.current = clampSplit((e.clientX - start) / Math.max(1, window.innerWidth - 16));
        setSplit(live.current);
      }}
      onPointerUp={endDrag}
      // A drag the browser takes back (a system gesture) ends too, and keeps where it got to.
      onPointerCancel={endDrag}
      onLostPointerCapture={endDrag}
      onKeyDown={(e) => {
        const step = e.key === 'ArrowLeft' ? -0.05 : e.key === 'ArrowRight' ? 0.05 : 0;
        if (!step) return;
        const next = clampSplit(split + step);
        live.current = next;
        setSplit(next);
        try { localStorage.setItem(SPLIT_KEY, String(next)); } catch { /* this visit only */ }
      }}
      data-dock-player-handle
    >
      <span className="w-1 h-10 rounded-full bg-zinc-700" />
    </div>
  );
  const say = (text: string) => (
    <div className={`${box} rounded-lg border border-zinc-800 bg-zinc-900/80 flex flex-col items-center justify-center gap-2 p-4 text-center`} data-dock-player="note">
      <Tv size={20} className="text-zinc-500" />
      <p className="text-[10px] font-bold text-zinc-400 leading-snug max-w-[18rem]">{text}</p>
    </div>
  );
  const note = !channel ? (t.dockWatchNoChannel || 'Connect Twitch on the Connections screen to watch the stream here.')
    : !window.isSecureContext ? (t.dockWatchNeedsHttps || 'Twitch plays only on a secure (https) page. Open the dock at your https address to watch the stream here.')
    : '';
  const player = note ? say(note) : (
    <div className={`${box} rounded-lg overflow-hidden border border-zinc-800 bg-black`} data-dock-player={channel}>
      <iframe
        src={twitchPlayerUrl(channel, window.location.hostname)}
        title={t.dockWatchTitle || 'The stream on Twitch'}
        className="w-full h-full block"
        allow="autoplay; fullscreen; picture-in-picture"
        allowFullScreen
      />
    </div>
  );
  return beside ? <>{column(player)}{handle}</> : player;
};
