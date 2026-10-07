/**
 * @license
 * SPDX-License-Identifier: Apache-2.0 AND LicenseRef-Commons-Clause-1.0
 *
 * The chat dock's settings, on its own screen.
 *
 * In folding sections, ordered by how often each is reached for, each holding
 * everything about one thing (see ChatSettingParts, which a chat layer's
 * panel is built from too).
 *
 * Only what does something on the dock. Its look is always Marathon's, so
 * there is no theme to pick and nothing a look leaves out, and it never hides
 * old messages, so the overlay's auto-hide has no place here. A chat layer on
 * the Overlays screen has its own panel (ChatLayerPanel).
 */
import React from 'react';
import { Copy, ExternalLink, PaintBucket } from 'lucide-react';
import { Colour, Switch, labelClass, useChatSections } from './ChatSettingParts';
import { copyText } from '../utils';

interface Props {
  /** The dock's whole set of chat settings, as the server holds them. */
  values: Record<string, any>;
  /** Change one or more of them. */
  patch: (next: Record<string, any>) => void;
  dockUrl: string;
  t: any;
}

export const ChatDockSettings = ({ values, patch, dockUrl, t }: Props) => {
  const v = values || {};
  const set = (key: string) => (value: any) => patch({ [key]: value });
  /*
    Marathon is assembled like the Custom look, so every placement it has a
    control for is drawn — nothing is left out the way Retro leaves out the
    badges.
  */
  const s = useChatSections({
    values: v,
    patch,
    t,
    draws: { marks: true, slots: true },
    reset: { word: t.dockDefault || 'Default', hint: t.dockDefaultHint || 'Back to the Marathon look' },
    storageKey: 'chat_dock_sections',
  });

  return (
    <div className="flex flex-col" data-dock-settings>
      <p className="text-[10px] text-zinc-500 leading-relaxed pb-4">
        {t.dockIntro || 'Your own copy of chat. It wears the Marathon look and keeps its own settings, whatever the stream is showing.'}
      </p>

      {/* Setting it up in OBS: the link, and a window of its own. */}
      <div className="rounded-2xl border border-zinc-800 bg-zinc-900/40 p-3 space-y-2 mb-4" data-dock-use>
        <span className={labelClass}>{t.dockUseInObs || 'Use in OBS'}</span>
        <div className="flex bg-zinc-950 rounded-lg border border-zinc-800 overflow-hidden">
          <input readOnly type="text" value={dockUrl} className="bg-transparent text-[10px] font-mono text-zinc-400 p-2 w-full outline-none" />
          <button onClick={() => copyText(dockUrl)} title={t.copy || 'Copy'} className="px-3 hover:bg-zinc-800 text-zinc-500 hover:text-white border-l border-zinc-800 transition-colors"><Copy size={12} /></button>
          <button
            onClick={() => window.open(dockUrl, '_blank', 'width=400,height=600,menubar=no,toolbar=no,location=no,status=no')}
            title={t.popout || 'Popout'}
            className="px-3 hover:bg-zinc-800 text-zinc-500 hover:text-white border-l border-zinc-800 transition-colors"
            data-dock-popout
          >
            <ExternalLink size={12} />
          </button>
        </div>
        <p className="text-[9px] text-zinc-600 leading-relaxed">{t.dockUseInObsHint || 'Add this link in OBS as a custom browser dock, or pop it out into a window of its own.'}</p>
      </div>

      {s.size}
      {s.shows}
      {s.text}
      {s.box}
      {s.ranks}
      {s.events}
      {s.motion}

      {s.fold('background', <PaintBucket size={13} />, t.dockSecBackground || 'Dock background', <>
        <Switch label={t.transparentBg || 'Transparent background'} on={Boolean(v.transparentBackground)} onChange={set('transparentBackground')} />
        <Colour label={t.backgroundColor || 'Background colour'} value={v.dockBackgroundColor} fallback="#09090b"
          onChange={set('dockBackgroundColor')} disabled={Boolean(v.transparentBackground)} />
      </>)}
    </div>
  );
};
