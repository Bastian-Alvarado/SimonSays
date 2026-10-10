/**
 * @license
 * SPDX-License-Identifier: Apache-2.0 AND LicenseRef-Commons-Clause-1.0
 *
 * Two buttons for a phone used as a deck: fill the whole screen, hiding the
 * browser's bar (which, held sideways, is a good part of the height), and
 * keep the screen from dimming and locking mid-stream.
 *
 * Each only shows where the browser can do it. Keeping the screen awake needs
 * a secure page (https, or this computer), so on a plain http address on the
 * home network it is not offered.
 *
 * Whether to keep it awake is this device's choice, remembered, and held by
 * <HoldAwake /> on the dock's pages whichever way up the phone is — the
 * button only shows sideways, but turning the phone upright should not let
 * it sleep. It is asked for again whenever the page comes back into view: the
 * browser lets go of it every time the page is hidden.
 */
import React, { useEffect, useState } from 'react';
import { Maximize2, Minimize2, Sun, Moon } from 'lucide-react';

const AWAKE_KEY = 'simonsays.keepAwake';

const canFullscreen = () => {
  try { return Boolean(document.fullscreenEnabled && document.documentElement.requestFullscreen); } catch { return false; }
};
const canKeepAwake = () => {
  try { return Boolean(window.isSecureContext && (navigator as any).wakeLock?.request); } catch { return false; }
};

// The choice, shared by the button and whatever holds the screen awake.
let awakeWanted = (() => { try { return localStorage.getItem(AWAKE_KEY) === 'yes'; } catch { return false; } })();
const awakeListeners = new Set<() => void>();
const setAwakeWanted = (on: boolean) => {
  awakeWanted = on;
  try { localStorage.setItem(AWAKE_KEY, on ? 'yes' : 'no'); } catch { /* private mode: for this visit only */ }
  awakeListeners.forEach((l) => l());
};
const useAwakeWanted = () => {
  const [on, setOn] = useState(awakeWanted);
  useEffect(() => {
    const l = () => setOn(awakeWanted);
    awakeListeners.add(l);
    return () => { awakeListeners.delete(l); };
  }, []);
  return on;
};

/** Holds the screen awake while this is on the page and keeping it awake is wanted. Draws nothing. */
export const HoldAwake = () => {
  const wanted = useAwakeWanted();
  useEffect(() => {
    if (!wanted || !canKeepAwake()) return undefined;
    let gone = false;
    let lock: any = null;
    const take = async () => {
      if (document.visibilityState !== 'visible' || lock) return;
      try {
        const got = await (navigator as any).wakeLock.request('screen');
        if (gone) { got.release().catch(() => {}); return; }
        lock = got;
        got.addEventListener?.('release', () => { if (lock === got) lock = null; });
      } catch { /* refused: low battery, or the page went away first */ }
    };
    take();
    document.addEventListener('visibilitychange', take);
    return () => {
      gone = true;
      document.removeEventListener('visibilitychange', take);
      lock?.release?.().catch(() => {});
      lock = null;
    };
  }, [wanted]);
  return null;
};

function useFullscreen() {
  const [on, setOn] = useState(() => Boolean(document.fullscreenElement));
  useEffect(() => {
    const update = () => setOn(Boolean(document.fullscreenElement));
    document.addEventListener('fullscreenchange', update);
    return () => document.removeEventListener('fullscreenchange', update);
  }, []);
  const toggle = () => {
    if (document.fullscreenElement) document.exitFullscreen?.().catch(() => {});
    else document.documentElement.requestFullscreen?.({ navigationUI: 'hide' } as any).catch(() => {});
  };
  return { on, toggle };
}

/** The two buttons, stacked, for a rail at the side of the screen. */
export const ScreenControls = ({ t }: { t: any }) => {
  const full = useFullscreen();
  const awake = useAwakeWanted();
  const showFull = canFullscreen();
  const showAwake = canKeepAwake();
  if (!showFull && !showAwake) return null;
  const base = 'w-9 h-9 shrink-0 flex items-center justify-center rounded-lg border transition-colors';
  const fullWords = full.on ? (t.screenFullscreenOff || 'Leave full screen') : (t.screenFullscreenOn || 'Full screen');
  const awakeWords = awake ? (t.screenAwakeOff || 'Let the screen sleep') : (t.screenAwakeOn || 'Keep the screen on');
  return (
    <div className="flex flex-col items-center gap-1.5" data-screen-controls>
      {showFull && (
        <button
          onClick={full.toggle}
          className={`${base} ${full.on ? 'bg-current-accent border-transparent text-white' : 'bg-zinc-900/60 border-zinc-800 text-zinc-400'}`}
          title={fullWords} aria-label={fullWords} aria-pressed={full.on}
          data-screen-fullscreen
        >
          {full.on ? <Minimize2 size={16} /> : <Maximize2 size={16} />}
        </button>
      )}
      {showAwake && (
        <button
          onClick={() => setAwakeWanted(!awake)}
          className={`${base} ${awake ? 'bg-current-accent border-transparent text-white' : 'bg-zinc-900/60 border-zinc-800 text-zinc-400'}`}
          title={awakeWords} aria-label={awakeWords} aria-pressed={awake}
          data-screen-awake
        >
          {awake ? <Sun size={16} /> : <Moon size={16} />}
        </button>
      )}
    </div>
  );
};
