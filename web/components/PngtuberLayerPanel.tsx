/**
 * @license
 * SPDX-License-Identifier: Apache-2.0 AND LicenseRef-Commons-Clause-1.0
 *
 * A PNGtuber layer's pictures and habits: the quiet and talking pictures,
 * the two with the eyes shut for blinking, named sets for faces, who it
 * talks with, and whether it hops, shakes and dims.
 */
import React, { useEffect, useState } from 'react';
import { Upload, Images, Trash2, Plus } from 'lucide-react';
import { refusalWords } from '../words';
import { TalkWithSelect, TalkChoices } from './TalkWithSelect';
import { StillImg } from './StillPicture';

interface Props {
  config: Record<string, any>;
  patch: (next: Record<string, any>) => void;
  /** Who it can talk along with: the call now, the people set up, the rest of the Discord server. */
  choices: TalkChoices;
  /** Whether the bot listens for who talks, on the Voice call screen. */
  listening: boolean;
  listAssets: () => Promise<any[]>;
  uploadAsset: (file: File) => Promise<any>;
  t: any;
}

const field = 'w-full bg-zinc-950/60 border border-zinc-800 rounded-md px-1.5 py-1 text-[10px] text-zinc-300 outline-none focus:border-current-accent';
const label = 'text-[8px] font-black uppercase tracking-widest text-zinc-600';
const CHECKER = {
  backgroundImage: 'linear-gradient(45deg, #1f1f23 25%, transparent 25%), linear-gradient(-45deg, #1f1f23 25%, transparent 25%), linear-gradient(45deg, transparent 75%, #1f1f23 75%), linear-gradient(-45deg, transparent 75%, #1f1f23 75%)',
  backgroundSize: '12px 12px',
  backgroundPosition: '0 0, 0 6px, 6px -6px, -6px 0',
};

const Check = ({ on, set, text }: { on: boolean; set: (v: boolean) => void; text: string }) => (
  <label className="flex items-center gap-2 cursor-pointer">
    <input type="checkbox" checked={on} onChange={(e) => set(e.target.checked)} className="accent-current-accent" />
    <span className="text-[9px] text-zinc-400">{text}</span>
  </label>
);

/** One picture: shown, uploaded, chosen from earlier uploads, or cleared. */
const Pick = ({ title, value, set, choose, upload }: {
  title: string; value?: string; set: (url: string) => void; choose: () => void; upload: (file?: File | null) => void;
}) => (
  <div className="space-y-1">
    <span className={`${label} block truncate`}>{title}</span>
    <div className="aspect-square rounded-md border border-zinc-800 overflow-hidden grid place-items-center" style={CHECKER}>
      {value ? <StillImg src={value} width={96} alt="" className="w-full h-full object-contain" /> : <span className="text-[8px] text-zinc-600">—</span>}
    </div>
    <div className="flex gap-0.5">
      <label className="flex-1 grid place-items-center py-0.5 rounded border border-zinc-800 bg-zinc-900 text-zinc-400 hover:bg-zinc-800 cursor-pointer">
        <Upload size={10} />
        <input type="file" accept="image/*" className="hidden" onChange={(e) => { upload(e.target.files?.[0]); e.currentTarget.value = ''; }} />
      </label>
      <button onClick={choose} className="flex-1 grid place-items-center py-0.5 rounded border border-zinc-800 bg-zinc-900 text-zinc-400 hover:bg-zinc-800"><Images size={10} /></button>
      {value && <button onClick={() => set('')} className="px-1 rounded border border-zinc-800 bg-zinc-900 text-zinc-500 hover:text-rose-400"><Trash2 size={10} /></button>}
    </div>
  </div>
);

export const PngtuberLayerPanel = ({ config, patch, choices, listening, listAssets, uploadAsset, t }: Props) => {
  const frames = config.frames || {};
  const expressions: { name: string; idle?: string; talking?: string }[] = config.expressions || [];
  // Which picture is being chosen from the uploads: a frame, or [set index, which].
  const [choosing, setChoosing] = useState<null | { frame?: string; set?: number; which?: 'idle' | 'talking' }>(null);
  const [assets, setAssets] = useState<{ url: string }[]>([]);
  const [busy, setBusy] = useState('');
  const [names, setNames] = useState(expressions.map((e) => e.name));
  useEffect(() => { setNames(expressions.map((e) => e.name)); }, [JSON.stringify(expressions.map((e) => e.name))]);

  useEffect(() => {
    if (!choosing) return;
    listAssets().then((all) => setAssets((all || []).filter((a: any) => a.kind === 'image'))).catch(() => setAssets([]));
  }, [choosing]);

  const setFrame = (k: string, url: string) => patch({ frames: { ...frames, [k]: url || undefined } });
  const setSet = (i: number, next: Partial<{ name: string; idle: string; talking: string }>) =>
    patch({ expressions: expressions.map((e, j) => (j === i ? { ...e, ...next } : e)) });
  const place = (url: string) => {
    if (!choosing) return;
    if (choosing.frame) setFrame(choosing.frame, url);
    else if (choosing.set !== undefined && choosing.which) setSet(choosing.set, { [choosing.which]: url });
    setChoosing(null);
  };
  const upload = async (target: NonNullable<typeof choosing>, file?: File | null) => {
    if (!file) return;
    setBusy(t.uploading || 'Uploading…');
    try {
      const saved = await uploadAsset(file);
      if (saved?.url) {
        if (target.frame) setFrame(target.frame, saved.url);
        else if (target.set !== undefined && target.which) setSet(target.set, { [target.which]: saved.url });
      }
      setBusy('');
    } catch (err: any) {
      setBusy(refusalWords(t, err) || String(err));
    }
  };

  const FRAMES: [string, string][] = [
    ['idle', t.pngtuberIdle || 'Quiet'],
    ['talking', t.pngtuberTalking || 'Talking'],
    ['blink', t.pngtuberBlink || 'Blinking'],
    ['blinkTalking', t.pngtuberBlinkTalking || 'Blinking, talking'],
  ];
  const who = config.talkWith as { id: string; name: string } | null;

  return (
    <div className="space-y-2.5 pt-2 border-t border-zinc-800/60" onClick={(e) => e.stopPropagation()} data-pngtuber-panel>
      <div className="grid grid-cols-4 gap-1.5">
        {FRAMES.map(([k, title]) => (
          <Pick
            key={k} title={title} value={frames[k]} set={(url) => setFrame(k, url)}
            choose={() => setChoosing(choosing?.frame === k ? null : { frame: k })}
            upload={(file) => upload({ frame: k }, file)}
          />
        ))}
      </div>
      <p className="text-[9px] text-zinc-600 leading-relaxed">
        {t.pngtuberFramesHint || 'Transparent pictures of the same size work best. Only Quiet is needed; without a talking one it hops, and without the blinking ones it does not blink.'}
      </p>

      <label className="block">
        <span className={label}>{t.pngtuberTalkWith || 'Talks when'}</span>
        {/* Always something: with nobody chosen it talks with the microphone. */}
        <TalkWithSelect value={who} onChange={(next) => patch({ talkWith: next || { id: 'mic', name: 'mic' } })} choices={choices} nobody={false} listening={listening} className={field} t={t} />
      </label>

      <div className="flex flex-wrap gap-x-3 gap-y-1">
        <Check on={config.blinks !== false} set={(v) => patch({ blinks: v })} text={t.avatarBlinks || 'Blinks'} />
        <Check on={config.hop !== false} set={(v) => patch({ hop: v })} text={t.avatarHop || 'Hops while talking'} />
        <Check on={config.shake !== false} set={(v) => patch({ shake: v })} text={t.avatarShake || 'Shakes when loud'} />
        <Check on={config.dimQuiet === true} set={(v) => patch({ dimQuiet: v })} text={t.voiceDimQuiet || 'Dim whoever is quiet'} />
      </div>

      <label className="block">
        <span className={label}>{t.avatarLoudFace || 'Face when loud'}</span>
        <select value={config.loudFace || ''} onChange={(e) => patch({ loudFace: e.target.value })} className={field}>
          <option value="">{t.avatarLoudFaceNone || 'Keep the same face'}</option>
          {expressions.map((e) => <option key={e.name} value={e.name}>{e.name}</option>)}
        </select>
      </label>
      {expressions.length === 0 && <p className="text-[9px] text-zinc-600">{t.pngtuberLoudNeedsFace || 'Add a face below to pick one for when you are loud.'}</p>}

      <div className="space-y-1.5">
        <div className="flex items-center gap-2">
          <span className={`${label} flex-1`}>{t.pngtuberFaces || 'Faces'}</span>
          {expressions.length < 12 && (
            <button onClick={() => patch({ expressions: [...expressions, { name: `face${expressions.length + 1}` }] })} className="flex items-center gap-1 text-[9px] text-zinc-400 hover:text-white">
              <Plus size={10} /> {t.pngtuberAddFace || 'Add a face'}
            </button>
          )}
        </div>
        {expressions.map((e, i) => (
          <div key={i} className="grid grid-cols-[1fr_56px_56px_auto] gap-1.5 items-end">
            <label className="block">
              <span className={label}>{t.pngtuberFaceName || 'Name'}</span>
              <input
                value={names[i] ?? e.name} maxLength={40}
                onChange={(ev) => setNames(names.map((n, j) => (j === i ? ev.target.value : n)))}
                onBlur={() => { const n = (names[i] || '').trim().toLowerCase(); if (n && n !== e.name) setSet(i, { name: n }); }}
                className={field}
              />
            </label>
            {(['idle', 'talking'] as const).map((which) => (
              <Pick
                key={which} title={which === 'idle' ? (t.pngtuberIdle || 'Quiet') : (t.pngtuberTalking || 'Talking')}
                value={e[which]} set={(url) => setSet(i, { [which]: url })}
                choose={() => setChoosing({ set: i, which })}
                upload={(file) => upload({ set: i, which }, file)}
              />
            ))}
            <button onClick={() => patch({ expressions: expressions.filter((_, j) => j !== i) })} className="mb-1 p-1 text-zinc-500 hover:text-rose-400"><Trash2 size={11} /></button>
          </div>
        ))}
        <p className="text-[9px] text-zinc-600 leading-relaxed">
          {t.pngtuberFacesHint || 'An action step "Avatar: show a face" with a face\'s name shows it for a few seconds — from a command, a dock button or an alert.'}
        </p>
      </div>

      {busy && <p className="text-[10px] text-zinc-500">{busy}</p>}
      {choosing && (
        <div className="space-y-1">
          <span className={label}>{t.voicePicChoose || 'Choose an upload'}</span>
          {assets.length === 0 ? (
            <p className="text-[9px] text-zinc-600">{t.voicePicNoUploads || 'Nothing uploaded yet. Use the upload button.'}</p>
          ) : (
            <div className="grid grid-cols-6 gap-1 max-h-36 overflow-y-auto">
              {assets.map((a) => (
                <button key={a.url} onClick={() => place(a.url)} className="aspect-square rounded border border-zinc-800 hover:border-current-accent overflow-hidden" style={CHECKER}>
                  <StillImg src={a.url} width={64} alt="" className="w-full h-full object-contain" />
                </button>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
};
