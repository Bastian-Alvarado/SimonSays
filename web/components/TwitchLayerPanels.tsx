/**
 * @license
 * SPDX-License-Identifier: Apache-2.0 AND LicenseRef-Commons-Clause-1.0
 *
 * The words on the Hype Train and shoutout layers. What sets them off — a
 * train on Twitch, a raid, a "!so" — and the rest of their settings are on
 * the Twitch screen, where a test train can be run to see the layer.
 */
import React from 'react';
import { CommittedInput } from './CommittedInput';

interface Props {
  config: Record<string, any>;
  patch: (next: Record<string, any>) => void;
  t: any;
}

const field = 'w-full bg-zinc-950/60 border border-zinc-800 rounded-md px-1.5 py-1 text-[10px] text-zinc-300 outline-none focus:border-current-accent';
const label = 'text-[8px] font-black uppercase tracking-widest text-zinc-600';

const Text = ({ name, value, placeholder, onCommit }: { name: string; value: string; placeholder: string; onCommit: (v: string) => void }) => (
  <label className="block">
    <span className={label}>{name}</span>
    <CommittedInput value={value} placeholder={placeholder} onCommit={onCommit} className={field} />
  </label>
);

export const HypeTrainLayerPanel = ({ config, patch, t }: Props) => (
  <div className="space-y-2.5 pt-2 border-t border-zinc-800/60" onClick={(e) => e.stopPropagation()} data-hype-panel>
    <div className="grid grid-cols-2 gap-2">
      <Text name={t.hypeTitle || 'Title'} value={config.title || ''} placeholder="Hype Train" onCommit={(v) => patch({ title: v })} />
      <Text name={t.hypeLevelWord || 'Word for level'} value={config.levelWord || ''} placeholder="Nivel" onCommit={(v) => patch({ levelWord: v })} />
    </div>
    <div className="grid grid-cols-[1fr_80px] gap-2">
      <Text name={t.hypeDoneText || 'When it ends'} value={config.doneText || ''} placeholder="¡Nivel {level} alcanzado!" onCommit={(v) => patch({ doneText: v })} />
      <label className="block">
        <span className={label}>{t.hypeDoneSeconds || 'For (s)'}</span>
        <input type="number" min={0} max={30} value={config.doneSeconds ?? 8} onChange={(e) => patch({ doneSeconds: Number(e.target.value) })} className={field} />
      </label>
    </div>
    <label className="flex items-center gap-2 cursor-pointer">
      <input type="checkbox" checked={config.showTop !== false} onChange={(e) => patch({ showTop: e.target.checked })} className="accent-current-accent" />
      <span className="text-[9px] text-zinc-400">{t.hypeShowTop || 'Name who is pushing it most'}</span>
    </label>
    <p className="text-[9px] text-zinc-600 leading-relaxed">
      {t.hypeLayerHint || 'Only on screen while a Hype Train runs, and for a few seconds after. Try one from the Twitch screen to see it here.'}
    </p>
  </div>
);

export const ShoutoutLayerPanel = ({ config, patch, t }: Props) => (
  <div className="space-y-2.5 pt-2 border-t border-zinc-800/60" onClick={(e) => e.stopPropagation()} data-shoutout-panel>
    <Text name={t.shoutoutCardTitle || 'Above the name'} value={config.title || ''} placeholder="¡Vayan a seguirle!" onCommit={(v) => patch({ title: v })} />
    <div className="grid grid-cols-2 gap-2">
      <Text name={t.shoutoutCardGame || 'What they played'} value={config.gameText || ''} placeholder="Estaba jugando {game}" onCommit={(v) => patch({ gameText: v })} />
      <Text name={t.shoutoutCardViewers || 'Raiders'} value={config.viewersText || ''} placeholder="+{viewers}" onCommit={(v) => patch({ viewersText: v })} />
    </div>
    <label className="flex items-center gap-2 cursor-pointer">
      <input type="checkbox" checked={config.showViewers !== false} onChange={(e) => patch({ showViewers: e.target.checked })} className="accent-current-accent" />
      <span className="text-[9px] text-zinc-400">{t.shoutoutCardShowViewers || 'Show how many came with a raid'}</span>
    </label>
    <p className="text-[9px] text-zinc-600 leading-relaxed">
      {t.shoutoutLayerHint || 'Shows who is shouted out — when somebody raids, or a "!so" goes out — for as long as the Twitch screen says. Shout somebody out from there to see it here.'}
    </p>
  </div>
);
