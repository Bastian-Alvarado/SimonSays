/**
 * @license
 * SPDX-License-Identifier: Apache-2.0 AND LicenseRef-Commons-Clause-1.0
 *
 * A second panel under the stream, when the dock puts the stream beside the
 * panels (a wide window at a desk, a phone held sideways): the room a 16:9
 * picture leaves under itself is used for another of the dock's tabs, so a
 * moderator can watch, read the chat on the right and press the deck below
 * without switching.
 *
 * Which tab is this device's choice (kept in the browser), from the panels
 * other than the chat (the chat lives on the right, with its sending box).
 * Only when there is room for it: under a picture that takes most of the
 * height a panel would be a sliver, so below MIN_HEIGHT it is not drawn at
 * all and the strip above it is all there is.
 */
import React, { useEffect, useRef, useState } from 'react';
import { DockTab } from './DockTabs';

interface Props {
  /** The dock's tabs; every one but the chat can be shown here. */
  tabs: DockTab[];
  /** What each tab draws (App.tsx dockPanelBody). */
  body: (id: string) => React.ReactNode;
  t: any;
}

const KEY = 'dock_below';
/** Below this, no panel: room for its picker and a row or two of the deck, or a question (a phone held sideways, the picture made smaller). */
export const MIN_HEIGHT = 120;

export const DockBelow: React.FC<Props> = ({ tabs, body, t }) => {
  const choices = tabs.filter((tab) => tab.id !== 'chat');
  const [pick, setPick] = useState(() => {
    try { const saved = localStorage.getItem(KEY); return saved === 'none' || choices.some((c) => c.id === saved) ? saved! : 'actions'; } catch { return 'actions'; }
  });
  const choose = (id: string) => {
    setPick(id);
    try { localStorage.setItem(KEY, id); } catch { /* this visit only */ }
  };
  // Whether there is room, measured: the panel is whatever height the picture leaves.
  const box = useRef<HTMLDivElement>(null);
  const [fits, setFits] = useState(false);
  useEffect(() => {
    const el = box.current;
    if (!el) return undefined;
    const measure = () => setFits(el.clientHeight >= MIN_HEIGHT);
    measure();
    const watch = new ResizeObserver(measure);
    watch.observe(el);
    return () => watch.disconnect();
  }, []);
  return (
    <div ref={box} className="flex-1 min-h-0 flex flex-col" data-dock-below={fits ? pick : 'no-room'}>
      {fits && (
        <>
          <div className="shrink-0 flex items-center gap-0.5 mb-1" role="group" aria-label={t.dockBelowPick || 'Show under the stream'}>
            {choices.map((tab) => {
              const Icon = tab.icon;
              const on = tab.id === pick;
              return (
                <button
                  key={tab.id} type="button" onClick={() => choose(on ? 'none' : tab.id)} aria-pressed={on} title={tab.label} aria-label={tab.label}
                  className={`px-2 py-1 rounded-md flex items-center gap-1.5 text-[8px] font-black uppercase tracking-widest transition-all ${on ? 'bg-current-accent text-white' : 'text-zinc-500 hover:text-zinc-300 hover:bg-zinc-800'}`}
                  data-dock-below-pick={tab.id}
                >
                  <Icon size={11} />
                  {on && <span>{tab.label}</span>}
                </button>
              );
            })}
          </div>
          {pick !== 'none' && (
            <div className="flex-1 min-h-0 overflow-y-auto flex flex-col" data-dock-below-panel={pick}>
              {body(pick)}
            </div>
          )}
        </>
      )}
    </div>
  );
};
