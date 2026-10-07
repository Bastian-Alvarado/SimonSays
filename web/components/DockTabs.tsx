/**
 * @license
 * SPDX-License-Identifier: Apache-2.0 AND LicenseRef-Commons-Clause-1.0
 *
 * What the chat dock is showing.
 *
 * The dock began as one thing — chat — and the button grid it is named after
 * lived in a second browser source you had to add and place yourself. That is
 * a strange split for something called Dock Actions, and a worse one every
 * time another panel wants to live at the desk.
 *
 * So the dock is a set of panels with a switch above them rather than a page
 * with things bolted to it: adding another is an entry in a list and a panel
 * to show, not a rearrangement of what is already there. Which is why this
 * takes its tabs as data and knows nothing about what any of them contain.
 *
 * One tab draws nothing at all. A switch with nothing to switch to is a
 * control that has never done anything, and the room is better spent on the
 * panel.
 */
import React, { useEffect, useRef, useState } from 'react';
import { LucideIcon } from 'lucide-react';

export interface DockTab {
  id: string;
  label: string;
  icon: LucideIcon;
  /** Something waiting there — questions to look at — shown beside the word. */
  count?: number;
}

interface Props {
  tabs: DockTab[];
  active: string;
  onPick: (id: string) => void;
}

/** About how wide a tab is with its word: the letters, and the icon and padding around them. */
const widthWithWord = (tab: DockTab) => tab.label.length * 7 + 36 + (tab.count ? 16 : 0);

export const DockTabs = ({ tabs, active, onPick }: Props) => {
  /*
    Whether every tab has room for its word. Five tabs in a dock of the usual
    width cut every word to two letters and an ellipsis, which is worse than
    no word at all. So when they do not fit, the open tab keeps its word and
    the rest show their icon, named on hover — and a wider dock gets every
    word back.
  */
  const bar = useRef<HTMLDivElement>(null);
  const [roomy, setRoomy] = useState(true);
  const needed = tabs.reduce((sum, tab) => sum + widthWithWord(tab), 0);
  useEffect(() => {
    const el = bar.current;
    if (!el) return undefined;
    const measure = () => setRoomy(el.clientWidth >= needed);
    measure();
    const watch = new ResizeObserver(measure);
    watch.observe(el);
    return () => watch.disconnect();
  }, [needed]);

  if (tabs.length < 2) return null;

  return (
    <div
      ref={bar}
      className="flex gap-0.5 bg-zinc-900/80 p-0.5 rounded-lg border border-zinc-800 mb-2 shrink-0"
      data-dock="tabs" data-dock-tabs-roomy={roomy ? 'yes' : 'no'}
    >
      {tabs.map((tab) => {
        const on = tab.id === active;
        const Icon = tab.icon;
        const worded = roomy || on;
        return (
          <button
            key={tab.id} onClick={() => onPick(tab.id)} data-dock="tab" data-dock-tab={tab.id}
            /*
              Both an icon and the word. The dock is narrow, but an icon on its
              own is a guess, and the word is the part somebody reads.
            */
            className={`${worded ? 'flex-auto' : 'flex-none'} min-w-0 px-2 py-1 rounded-md text-[8px] font-black uppercase tracking-widest transition-all flex items-center justify-center gap-1.5 ${
              on
                ? 'bg-current-accent text-white shadow-lg'
                : 'text-zinc-500 hover:text-zinc-300 hover:bg-zinc-800'
            }`}
            aria-pressed={on}
            title={worded ? undefined : tab.label}
            aria-label={tab.label}
          >
            <Icon size={11} className="shrink-0" />
            {worded && <span className="truncate">{tab.label}</span>}
            {tab.count ? (
              <span className={`shrink-0 font-mono rounded px-1 ${on ? 'bg-white/20' : 'bg-current-accent text-white'}`} data-dock-tab-count>{tab.count}</span>
            ) : null}
          </button>
        );
      })}
    </div>
  );
};
