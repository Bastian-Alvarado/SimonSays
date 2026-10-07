/**
 * @license
 * SPDX-License-Identifier: Apache-2.0 AND LicenseRef-Commons-Clause-1.0
 *
 * The PNGtuber microphone (server/engine/pngtuber.js): which of OBS's inputs
 * is your voice, how loud counts as talking and as loud, and how long the
 * mouth stays open between words — with the level live, so the threshold
 * can be set against your own voice, and the avatar talking along to prove
 * it. Faces can be tried from here too.
 */
import React, { useEffect, useState } from 'react';
import { Mic, AlertTriangle } from 'lucide-react';
import { LivingAvatar } from '../AvatarLayer';
import { kitFor } from '../../../shared/house-avatar.js';
import { pixelHasFace, pixelHats } from '../../../shared/pixel-avatars.js';
import { AVATAR_EXPRESSIONS_LIST, AVATAR_COSTUMES_LIST, AVATAR_HATS, AVATAR_ACTIONS_LIST, AVATAR_DRESS_WORDS } from '../../../shared/avatar.js';
import { avatarFaceNames, avatarCostumeNames, avatarHatNames, avatarActionNames } from '../AvatarLayerPanel';
import { pixelActionLabel, pixelOutfitName, pixelExtraName } from '../pixelNames';
import type { PixelAvatarDef } from '../../types';

interface Props {
  /** The pixel avatars drawn in the Pixel avatars tab: what they do can be tried here too. */
  pixelAvatars?: PixelAvatarDef[];
  settings?: { inputName: string; threshold: number; loud: number; holdMs: number };
  talk?: { talking: boolean; loud: boolean; soft?: boolean };
  level?: { db: number } | null;
  /** The face an action or a button here asked for, shown by the preview too. */
  asked?: { name: string } | null;
  sources: { inputName: string; inputKind?: string }[];
  obsConnected: boolean;
  save: (patch: Record<string, any>) => void;
  meter: () => void;
  face: (name: string, seconds?: number) => void;
  /** Put on what viewers can put on it, for a few minutes, and take it all off. */
  dress: (what: 'outfit' | 'hat', name: string, minutes?: number) => void;
  undress: () => void;
  /** What it is dressed in now, by viewers or here. */
  dressed?: { outfit?: string | null; hat?: string | null } | null;
  /** Have every avatar on stream do something once — drink water — and what it was last asked to do. */
  act: (name: string) => void;
  acted?: { name: string; key: string } | null;
  t: any;
}

const box = 'w-full bg-zinc-950 border border-zinc-800 rounded-xl px-4 py-2 text-xs text-white outline-none focus:border-current-accent';
const tag = 'text-[9px] font-black uppercase tracking-widest text-zinc-500';
/** Where a level sits on the meter, which runs from -70 dB to 0. */
const at = (db: number) => `${Math.min(100, Math.max(0, ((db + 70) / 70) * 100))}%`;
const isMic = (kind = '') => /input_capture|dshow|pulse_input|alsa_input|coreaudio_input|jack/i.test(kind);

export const PngtuberView = ({ settings, talk, level, asked, sources, obsConnected, save, meter, face, dress, undress, dressed, act, acted, pixelAvatars = [], t }: Props) => {
  const houseKit = kitFor('', pixelAvatars);
  // What the pixel avatars from the Pixel avatars tab do as well, named as they name it.
  const theirActions = pixelAvatars.flatMap((p) => p.actions.map((a) => ({ name: a.name, label: pixelActionLabel(p, a.name, t) }))).filter((a, i, all) => !(AVATAR_ACTIONS_LIST as string[]).includes(a.name) && all.findIndex((b) => b.name === a.name) === i);
  const s = settings || { inputName: '', threshold: -38, loud: -12, holdMs: 220 };
  // Sliders move freely and save when let go.
  const [draft, setDraft] = useState(s);
  useEffect(() => { setDraft(s); }, [s.inputName, s.threshold, s.loud, s.holdMs]);

  // The level only flows while somebody is looking at it.
  useEffect(() => {
    meter();
    const id = setInterval(meter, 5000);
    return () => clearInterval(id);
  }, []);

  const inputs = [...sources].sort((a, b) => Number(isMic(b.inputKind)) - Number(isMic(a.inputKind)));
  const commit = (key: 'threshold' | 'loud' | 'holdMs') => { if (draft[key] !== s[key]) save({ [key]: draft[key] }); };
  const db = level?.db ?? -100;
  const faces = avatarFaceNames(t);
  // What it can be dressed in: the house avatar's own outfits and hats when there is one, else the built-in avatar's.
  // Each outfit is [its name, the word that asks for it, what the button says]; the one it was drawn in is asked for by its own word.
  const builtInBaseWord: string = (AVATAR_DRESS_WORDS as any).outfit['']?.[0] || '';
  const outfits: [string, string, string][] = houseKit
    ? ['', ...houseKit.outfits.map((o) => o.name)].filter((o) => o || houseKit.baseWords?.length).map((o) => [o, o || houseKit.baseWords[0], pixelOutfitName(houseKit, o, t)])
    : AVATAR_COSTUMES_LIST.filter((c: string) => c || builtInBaseWord).map((c: string) => [c, c || builtInBaseWord, avatarCostumeNames(t)[c] || c]);
  const hats: [string, string][] = houseKit
    ? (pixelHats(houseKit) as string[]).map((h) => [h, pixelExtraName(houseKit, h, t)])
    : AVATAR_HATS.map((h: string) => [h, avatarHatNames(t)[h] || h]);

  return (
    <div className="animate-fade-in space-y-6 pb-20">
      <div className="glass-panel rounded-3xl border border-zinc-800 p-6 space-y-5">
        <div className="flex items-center gap-3">
          <Mic size={16} className="text-current-accent" />
          <span className="text-[11px] font-black uppercase tracking-widest text-zinc-300 flex-1">{t.pngtuberNav || 'PNGtuber'}</span>
          <span className={`text-[10px] font-bold ${talk?.talking ? 'text-emerald-400' : 'text-zinc-600'}`} data-mic-talking={talk?.talking ? 'true' : 'false'}>
            {talk?.loud ? (t.pngtuberLoud || 'Loud') : talk?.talking ? (talk?.soft ? (t.pngtuberSoftNow || 'Talking softly') : (t.pngtuberTalkingNow || 'Talking')) : (t.pngtuberQuiet || 'Quiet')}
          </span>
        </div>
        <p className="text-[11px] text-zinc-500 leading-relaxed">
          {t.pngtuberHint || 'Choose the microphone OBS hears, and any Pixel avatar or PNGtuber layer set to talk with "my microphone" opens its mouth when you talk — no Discord call needed.'}
        </p>
        {!obsConnected && (
          <p className="flex items-center gap-2 text-[11px] text-amber-400">
            <AlertTriangle size={13} /> {t.pngtuberNoObs || 'OBS is not connected. It hears the microphone, so open OBS on the PC (with its WebSocket server on) and this comes alive.'}
          </p>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-[1fr_220px] gap-6 items-start">
          <div className="space-y-5">
            <label className="space-y-1 block">
              <span className={tag}>{t.pngtuberInput || 'Microphone in OBS'}</span>
              <select value={s.inputName} onChange={(e) => save({ inputName: e.target.value })} className={box}>
                <option value="">{t.pngtuberInputNone || 'None — off'}</option>
                {s.inputName && !inputs.some((i) => i.inputName === s.inputName) && <option value={s.inputName}>{s.inputName}</option>}
                {inputs.map((i) => <option key={i.inputName} value={i.inputName}>{i.inputName}{isMic(i.inputKind) ? ' 🎙' : ''}</option>)}
              </select>
            </label>

            <div className="space-y-1.5">
              <span className={tag}>{t.pngtuberLevel || 'Level'}</span>
              <div className="relative h-5 rounded-md bg-zinc-900 border border-zinc-800 overflow-hidden" data-mic-meter>
                <div className="absolute inset-y-0 left-0 bg-zinc-600 transition-[width] duration-100" style={{ width: at(db), background: db >= draft.loud ? '#f43f5e' : db >= draft.threshold ? '#22c55e' : '#52525b' }} />
                <div className="absolute inset-y-0 w-0.5 bg-emerald-300" style={{ left: at(draft.threshold) }} title={t.pngtuberThreshold || 'Talking from'} />
                <div className="absolute inset-y-0 w-0.5 bg-rose-300" style={{ left: at(draft.loud) }} title={t.pngtuberLoudFrom || 'Loud from'} />
                {/* Halfway between them: under it the mouth opens only a little. */}
                <div className="absolute inset-y-0 w-0 border-l border-dashed border-zinc-300/70" style={{ left: at((draft.threshold + draft.loud) / 2) }} title={t.pngtuberSoftUnder || 'Soft under here'} data-mic-soft-mark />
              </div>
              <p className="text-[10px] text-zinc-600">
                {level ? `${db.toFixed(1)} dB` : (t.pngtuberNoLevel || 'No level yet — it shows once OBS is connected and a microphone is chosen.')}
              </p>
            </div>

            {([
              ['threshold', t.pngtuberThreshold || 'Talking from (dB)', -70, 0, 1],
              ['loud', t.pngtuberLoudFrom || 'Loud from (dB)', -70, 0, 1],
              ['holdMs', t.pngtuberHold || 'Mouth stays open after (ms)', 0, 1000, 10],
            ] as const).map(([key, text, min, max, step]) => (
              <label key={key} className="space-y-1 block">
                <span className={tag}>{text}: <span className="text-zinc-300">{draft[key]}</span></span>
                <input
                  type="range" min={min} max={max} step={step} value={draft[key]}
                  onChange={(e) => setDraft({ ...draft, [key]: Number(e.target.value) })}
                  onMouseUp={() => commit(key)} onTouchEnd={() => commit(key)} onKeyUp={() => commit(key)} onBlur={() => commit(key)}
                  className="w-full accent-current-accent"
                />
              </label>
            ))}
            <p className="text-[10px] text-zinc-600 leading-relaxed">
              {t.pngtuberTuneHint || 'Talk normally and put the green mark just under where your voice sits, and the red one where you shout. If the mouth flickers between words, keep it open for longer.'}
            </p>
            <p className="text-[10px] text-zinc-600 leading-relaxed">
              {t.pngtuberMouthHint || 'The pixel avatar\'s mouth follows your voice: a little open under the dotted mark, halfway between the two, open above it, and wide once you are loud.'}
            </p>
          </div>

          <div className="space-y-3">
            <div className="aspect-square rounded-2xl border border-zinc-800 bg-zinc-950/60 overflow-hidden">
              {/* The house avatar (shared/house-avatar.js), or the built-in one when there is none. */}
              <LivingAvatar speaking={Boolean(talk?.talking)} loud={Boolean(talk?.loud)} soft={Boolean(talk?.soft)} reaction={asked?.name && (houseKit ? pixelHasFace(houseKit, asked.name) : (AVATAR_EXPRESSIONS_LIST as string[]).includes(asked.name)) ? asked.name : null} action={acted} kit={houseKit} />
            </div>
            <span className={tag}>{t.pngtuberTryFace || 'Show a face on stream for 3 s'}</span>
            <div className="flex flex-wrap gap-1">
              {AVATAR_EXPRESSIONS_LIST.filter((f: string) => !['neutral', 'talking', 'blink'].includes(f)).map((f: string) => (
                <button key={f} onClick={() => face(f, 3)} className="px-2 py-1 rounded-md border border-zinc-800 text-[10px] text-zinc-400 hover:text-white hover:border-zinc-600">{faces[f]}</button>
              ))}
            </div>
            {/* What the "Avatar: do something" step does, to try: on every avatar on stream, once. */}
            <span className={tag}>{t.pngtuberTryAction || 'Do something on stream'}</span>
            <div className="flex flex-wrap gap-1" data-action-buttons>
              {AVATAR_ACTIONS_LIST.map((a: string) => (
                <button key={a} onClick={() => act(a)} className="px-2 py-1 rounded-md border border-zinc-800 text-[10px] text-zinc-400 hover:text-white hover:border-zinc-600">
                  {(avatarActionNames(t) as Record<string, string>)[a] || a}
                </button>
              ))}
              {theirActions.map((a) => (
                <button key={`pa-${a.name}`} onClick={() => act(a.name)} data-pixel-action={a.name} className="px-2 py-1 rounded-md border border-dashed border-zinc-800 text-[10px] text-zinc-400 hover:text-white hover:border-zinc-600">
                  {a.label}
                </button>
              ))}
            </div>
            {/* What viewers can do with the "Avatar: dress up" step, to try: on every avatar on stream for a minute. */}
            <span className={tag}>{t.pngtuberTryDress || 'Dress it up on stream for 1 min'}</span>
            <div className="flex flex-wrap gap-1" data-dress-buttons>
              {outfits.map(([c, word, name]) => (
                <button
                  key={c || 'base'} onClick={() => dress('outfit', word, 1)}
                  className={`px-2 py-1 rounded-md border text-[10px] hover:text-white ${dressed?.outfit === c ? 'border-current-accent text-white' : 'border-zinc-800 text-zinc-400 hover:border-zinc-600'}`}
                >
                  {name}
                </button>
              ))}
              {[...hats, ['none', t.avatarHatNone || 'None']].map(([h, name]) => (
                <button
                  key={h} onClick={() => dress('hat', h, 1)}
                  className={`px-2 py-1 rounded-md border text-[10px] hover:text-white ${dressed?.hat === h ? 'border-current-accent text-white' : 'border-zinc-800 text-zinc-400 hover:border-zinc-600'}`}
                >
                  {h === 'none' ? `${t.avatarHat || 'Hat'}: ${name}` : name}
                </button>
              ))}
              <button onClick={undress} className="px-2 py-1 rounded-md border border-zinc-800 text-[10px] text-zinc-500 hover:text-white hover:border-zinc-600">{t.pngtuberUndress || 'Own outfit back'}</button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
