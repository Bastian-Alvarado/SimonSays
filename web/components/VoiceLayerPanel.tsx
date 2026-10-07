/**
 * @license
 * SPDX-License-Identifier: Apache-2.0 AND LicenseRef-Commons-Clause-1.0
 *
 * How a voice layer shows the call: in a row, a column or a grid, with room
 * for how many, round or rounded, everybody or only whoever is talking, and
 * who to leave out — usually yourself, whose camera is already on screen.
 * The channel is chosen on the Voice call screen.
 */
import React from 'react';
import { AutoSwatch } from './AutoSwatch';

interface Props {
  config: Record<string, any>;
  patch: (next: Record<string, any>) => void;
  /** Who is in the call now, to choose who to hide from. */
  members: { id: string; name: string }[];
  t: any;
}

const field = 'w-full bg-zinc-950/60 border border-zinc-800 rounded-md px-1.5 py-1 text-[10px] text-zinc-300 outline-none focus:border-current-accent';
const label = 'text-[8px] font-black uppercase tracking-widest text-zinc-600';

const Check = ({ on, set, text }: { on: boolean; set: (v: boolean) => void; text: string }) => (
  <label className="flex items-center gap-2 cursor-pointer">
    <input type="checkbox" checked={on} onChange={(e) => set(e.target.checked)} className="accent-current-accent" />
    <span className="text-[9px] text-zinc-400">{text}</span>
  </label>
);

export const VoiceLayerPanel = ({ config, patch, members, t }: Props) => {
  const hidden: { id: string; name: string }[] = config.hide || [];
  // Everybody in the call now, and anybody hidden before who is not in it at the moment.
  const people = [...members, ...hidden.filter((h) => !members.some((m) => m.id === h.id))];
  const toggleHidden = (who: { id: string; name: string }, hide: boolean) => patch({
    hide: hide ? [...hidden.filter((h) => h.id !== who.id), { id: who.id, name: who.name }] : hidden.filter((h) => h.id !== who.id),
  });

  return (
    <div className="space-y-2.5 pt-2 border-t border-zinc-800/60" onClick={(e) => e.stopPropagation()}>
      <div className="grid grid-cols-3 gap-2">
        <label className="block">
          <span className={label}>{t.voiceArrange || 'Arrange'}</span>
          <select value={config.arrange || 'row'} onChange={(e) => patch({ arrange: e.target.value })} className={field}>
            <option value="row">{t.voiceArrangeRow || 'Row'}</option>
            <option value="column">{t.voiceArrangeColumn || 'Column'}</option>
            <option value="grid">{t.voiceArrangeGrid || 'Grid'}</option>
          </select>
        </label>
        <label className="block">
          <span className={label}>{t.voiceSlots || 'Room for'}</span>
          <input type="number" min={1} max={25} value={config.slots ?? 6} onChange={(e) => patch({ slots: Number(e.target.value) })} className={field} />
        </label>
        <label className="block">
          <span className={label}>{t.voiceShape || 'Shape'}</span>
          <select value={config.shape || 'circle'} onChange={(e) => patch({ shape: e.target.value })} className={field}>
            <option value="circle">{t.voiceShapeCircle || 'Circle'}</option>
            <option value="rounded">{t.voiceShapeRounded || 'Rounded square'}</option>
          </select>
        </label>
      </div>
      <p className="text-[9px] text-zinc-600 leading-relaxed">
        {t.voiceSlotsHint || 'Avatars are sized for this many, so they keep their size as people come and go. More people than room and they shrink to fit.'}
      </p>

      <label className="block">
        <span className={label}>{t.voiceShow || 'Show'}</span>
        <select value={config.show || 'everyone'} onChange={(e) => patch({ show: e.target.value })} className={field}>
          <option value="everyone">{t.voiceShowEveryone || 'Everyone in the call'}</option>
          <option value="talking">{t.voiceShowTalking || 'Only whoever is talking'}</option>
        </select>
      </label>

      <Check on={config.showNames !== false} set={(v) => patch({ showNames: v })} text={t.voiceShowNames || 'Names under the avatars'} />
      <Check on={config.showStatus !== false} set={(v) => patch({ showStatus: v })} text={t.voiceShowStatus || 'Show who is muted or deafened'} />
      <Check on={config.dimQuiet === true} set={(v) => patch({ dimQuiet: v })} text={t.voiceDimQuiet || 'Dim whoever is quiet'} />
      <Check on={config.usePictures !== false} set={(v) => patch({ usePictures: v })} text={t.voiceUsePictures || 'Use their own pictures, where they have them'} />
      <Check on={config.hop !== false} set={(v) => patch({ hop: v })} text={t.voiceHop || 'Pictures hop while talking'} />
      <Check on={config.showReactions !== false} set={(v) => patch({ showReactions: v })} text={t.voiceShowReactions || 'Show emoji reactions and sounds sent in the call'} />

      <div className="space-y-1">
        <span className={label}>{t.voiceHide || 'Leave out'}</span>
        {people.length === 0 ? (
          <p className="text-[9px] text-zinc-600">{t.voiceHideNobody || 'Nobody is in the call to choose from. Join it, then come back here.'}</p>
        ) : (
          <div className="flex flex-wrap gap-x-3 gap-y-1">
            {people.map((p) => (
              <Check key={p.id} on={hidden.some((h) => h.id === p.id)} set={(v) => toggleHidden(p, v)} text={p.name} />
            ))}
          </div>
        )}
      </div>

      <div className="flex flex-wrap items-center gap-3">
        {/*
          The talking colour beats a look once chosen, and leaves the look's
          own while automatic — Discord green without one. The names are
          never coloured by a look, so their colour is a plain one.
        */}
        <AutoSwatch
          name="glowColor"
          label={t.voiceGlow || 'Talking glow'}
          value={config.glowColor}
          fallback="#23a55a"
          onChange={(v) => patch({ glowColor: v })}
          onClear={() => patch({ glowColor: '' })}
          t={t}
        />
        <label className="flex items-center gap-1.5">
          <input
            type="color"
            value={(config.textColor || '#ffffff').slice(0, 7)}
            onChange={(e) => patch({ textColor: e.target.value })}
            className="w-6 h-6 bg-transparent border border-zinc-800 rounded cursor-pointer"
          />
          <span className="text-[8px] font-black uppercase tracking-widest text-zinc-600">
            {t.playersText || 'Text'}
          </span>
        </label>
      </div>
    </div>
  );
};
