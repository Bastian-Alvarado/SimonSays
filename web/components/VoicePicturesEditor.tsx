/**
 * @license
 * SPDX-License-Identifier: Apache-2.0 AND LicenseRef-Commons-Clause-1.0
 *
 * How one person appears on the voice layer: the name shown for them, and
 * their pictures, PNGtuber style — the one shown while they are quiet, the one
 * while they talk, and one for muted if they want it. Each is an upload, or
 * something uploaded before.
 *
 * Or the pixel avatar, previewed live: a regular's own drawing, or the
 * avatar with the choices an avatar layer has — its colour, an outfit, a hat.
 *
 * Saved as they are chosen: the server keeps them with the person's Discord
 * id and the name they had, and every voice layer uses them.
 */
import React, { useEffect, useState } from 'react';
import { Upload, Images, Trash2, X } from 'lucide-react';
import { VoicePixel, VoiceLook } from './VoiceLayer';
import { AvatarColourSelect, AvatarColourExtras, avatarCostumeNames, avatarHatNames } from './AvatarLayerPanel';
import { CommittedInput } from './CommittedInput';
import { refusalWords } from '../words';
import { AVATAR_COSTUMES_LIST, AVATAR_HATS, AVATAR_HEADWEAR, AVATAR_REGULARS, AVATAR_REGULARS_LIST } from '../../shared/avatar.js';
import { pixelHats, pixelOutfit } from '../../shared/pixel-avatars.js';
import { kitFor } from '../../shared/house-avatar.js';
import { pixelOutfitName, pixelExtraName } from './pixelNames';
import type { PixelAvatarDef } from '../types';
import { StillImg } from './StillPicture';

export interface PictureEntry { name?: string; quiet?: string; talking?: string; muted?: string; avatar?: boolean; look?: VoiceLook }
type Kind = 'quiet' | 'talking' | 'muted';

const lookField = 'w-full bg-zinc-950/60 border border-zinc-800 rounded-md px-1.5 py-1 text-[10px] text-zinc-300 outline-none focus:border-current-accent';
const lookLabel = 'text-[8px] font-black uppercase tracking-widest text-zinc-600';
const REGULARS = AVATAR_REGULARS as Record<string, { name: string }>;

interface Props {
  person: { id: string; name: string; avatar?: string };
  pictures?: PictureEntry;
  onChange: (next: PictureEntry | null) => void;
  /** The accent of the layout that shows the call, so "the layout colour" previews as it will look there. */
  accent?: string;
  /** The name shown for them on stream, in place of their Discord one. Empty is their Discord one. */
  streamName?: string;
  onStreamName: (name: string) => void;
  onClose: () => void;
  listAssets: () => Promise<any[]>;
  uploadAsset: (file: File) => Promise<any>;
  /** The pixel avatars drawn in the Pixel avatars tab, any of which they can be drawn as. */
  pixelAvatars?: PixelAvatarDef[];
  t: any;
}

const KINDS: Kind[] = ['quiet', 'talking', 'muted'];

/** A checkerboard, so a transparent picture reads as transparent rather than as missing. */
const CHECKER = {
  backgroundImage: 'linear-gradient(45deg, #1f1f23 25%, transparent 25%), linear-gradient(-45deg, #1f1f23 25%, transparent 25%), linear-gradient(45deg, transparent 75%, #1f1f23 75%), linear-gradient(-45deg, transparent 75%, #1f1f23 75%)',
  backgroundSize: '14px 14px',
  backgroundPosition: '0 0, 0 7px, 7px -7px, -7px 0',
};

export const VoicePicturesEditor = ({ person, pictures, onChange, accent, streamName = '', onStreamName, onClose, listAssets, uploadAsset, pixelAvatars = [], t }: Props) => {
  const entry: PictureEntry = pictures || {};
  const look: VoiceLook = entry.look || {};
  // Drawn as a pixel avatar from the tab: its own outfits and hats, not the built-in one's.
  const kit = kitFor(look.kit, pixelAvatars);
  const outfits: string[] = kit ? ['', ...kit.outfits.map((o) => o.name)] : AVATAR_COSTUMES_LIST;
  const hats: string[] = kit ? pixelHats(kit) : AVATAR_HATS;
  const outfitName = (c: string) => (kit ? pixelOutfitName(kit, c, t) : avatarCostumeNames(t)[c] || c);
  const hatName = (h: string) => (kit ? pixelExtraName(kit, h, t) : avatarHatNames(t)[h] || h);
  const hasHeadwear = (c: string) => (kit ? Boolean(pixelOutfit(kit, c)?.headwear) : AVATAR_HEADWEAR.includes(c));
  const [choosing, setChoosing] = useState<Kind | null>(null);
  // The preview talks only when asked, so the look can be judged both ways.
  const [previewTalking, setPreviewTalking] = useState(false);
  const [assets, setAssets] = useState<{ url: string; name?: string }[]>([]);
  const [busy, setBusy] = useState('');

  useEffect(() => {
    if (!choosing) return;
    listAssets().then((all) => setAssets((all || []).filter((a: any) => a.kind === 'image'))).catch(() => setAssets([]));
  }, [choosing]);

  const label: Record<Kind, string> = {
    quiet: t.voicePicQuiet || 'Quiet',
    talking: t.voicePicTalking || 'Talking',
    muted: t.voicePicMuted || 'Muted (optional)',
  };

  const set = (kind: Kind, url: string) => {
    const next = { ...entry, name: person.name, [kind]: url || undefined };
    onChange(next.avatar || KINDS.some((k) => next[k]) ? next : null);
  };

  // The pixel avatar instead of pictures: the pictures are kept, for turning it off again.
  const setAvatar = (on: boolean) => {
    const next = { ...entry, name: person.name, avatar: on || undefined };
    onChange(next.avatar || KINDS.some((k) => next[k]) ? next : null);
  };

  // One choice of their look changed; a choice back to the default leaves the look without it.
  const setLook = (patch: Partial<VoiceLook>) => {
    const next: Record<string, string | undefined> = { ...look, ...patch };
    if (next.colouring === 'layout') delete next.colouring;
    for (const key of Object.keys(next)) if (!next[key]) delete next[key];
    onChange({ ...entry, name: person.name, look: next as VoiceLook });
  };
  const headwear = hasHeadwear(look.costume || '');

  const upload = async (kind: Kind, file?: File | null) => {
    if (!file) return;
    setBusy(t.uploading || 'Uploading…');
    try {
      const saved = await uploadAsset(file);
      if (saved?.url) set(kind, saved.url);
      setBusy('');
    } catch (err: any) {
      setBusy(refusalWords(t, err) || String(err));
    }
  };

  return (
    <div className="rounded-2xl border border-current-accent/60 bg-zinc-950/70 p-4 space-y-3" data-voice-pictures-editor={person.id}>
      <div className="flex items-center gap-2">
        <span className="text-xs font-black text-zinc-200 flex-1 min-w-0 truncate">{String(t.voicePersonFor || 'How {name} appears on stream').split('{name}').join(person.name)}</span>
        {(entry.avatar || KINDS.some((k) => entry[k])) && (
          <button onClick={() => onChange(null)} className="text-[9px] font-black uppercase tracking-widest text-zinc-500 hover:text-rose-400">
            {t.voicePicRemoveAll || 'Remove all'}
          </button>
        )}
        <button onClick={onClose} className="p-1 text-zinc-500 hover:text-white"><X size={14} /></button>
      </div>

      {/* Their Twitch name, a nickname — whatever the stream knows them by. */}
      <label className="block space-y-1 max-w-xs">
        <span className="block text-[9px] font-black uppercase tracking-widest text-zinc-500">{t.voiceStreamName || 'Name on stream'}</span>
        <CommittedInput
          type="text" value={streamName} maxLength={40} placeholder={person.name}
          onCommit={(v: string) => onStreamName(v)}
          className="w-full bg-zinc-900 border border-zinc-800 rounded-lg px-3 py-1.5 text-xs text-zinc-200 outline-none focus:border-current-accent"
          data-voice-stream-name
        />
      </label>

      <label className="flex items-center gap-2 cursor-pointer">
        <input type="checkbox" checked={entry.avatar === true} onChange={(e) => setAvatar(e.target.checked)} className="accent-current-accent" data-voice-pixel-avatar />
        <span className="text-[10px] text-zinc-300">{t.voicePicAvatar || 'Draw them as a pixel avatar — it talks and blinks by itself'}</span>
      </label>

      {entry.avatar ? (
        <div className="flex flex-wrap items-start gap-4" data-voice-look>
          <div className="space-y-1.5">
            <div className="w-36 aspect-square rounded-xl border border-zinc-800 overflow-hidden" style={CHECKER} data-voice-look-preview>
              <VoicePixel look={look} accent={accent} speaking={previewTalking} pixelAvatars={pixelAvatars} />
            </div>
            <label className="flex items-center gap-1.5 cursor-pointer">
              <input type="checkbox" checked={previewTalking} onChange={(e) => setPreviewTalking(e.target.checked)} className="accent-current-accent" data-voice-look-talk />
              <span className="text-[9px] text-zinc-400">{t.voiceLookPreviewTalking || 'Show it talking'}</span>
            </label>
          </div>

          <div className="flex-1 min-w-[12rem] max-w-xs space-y-2">
            <label className="block">
              <span className={lookLabel}>{t.voiceLookAvatar || 'Avatar'}</span>
              <select
                value={look.kit ? `kit:${look.kit}` : look.drawing || ''}
                onChange={(e) => {
                  const v = e.target.value;
                  // Between the built-in avatar and one from the tab, the outfit and hat are each its own: they start over.
                  if (v.startsWith('kit:')) setLook({ kit: v.slice(4), drawing: '', costume: '', hat: '' });
                  else setLook({ drawing: v, ...(look.kit ? { kit: '', costume: '', hat: '' } : {}) });
                }}
                className={lookField} data-voice-look-drawing
              >
                <option value="">{t.voiceLookPixelAvatar || 'The pixel avatar'}</option>
                <optgroup label={t.voiceLookTheirOwn || 'Their own drawing'}>
                  {AVATAR_REGULARS_LIST.map((id: string) => <option key={id} value={id}>{REGULARS[id].name}</option>)}
                </optgroup>
                {pixelAvatars.length > 0 && (
                  <optgroup label={t.voiceLookFromTab || 'Drawn in the Pixel avatars tab'}>
                    {pixelAvatars.map((p) => <option key={p.id} value={`kit:${p.id}`}>{p.name}</option>)}
                  </optgroup>
                )}
              </select>
            </label>

            {/* Their own drawing is drawn as it was given; the rest is for the pixel avatar. */}
            {look.drawing ? (
              <p className="text-[9px] text-zinc-600 leading-relaxed">{t.voiceLookOwnHint || 'Drawn as it was given, in its own colours. It opens its mouth while they talk, and breathes and hops like the pixel avatar.'}</p>
            ) : (
              <>
                <label className="block">
                  <span className={lookLabel}>{t.avatarCostume || 'Outfit'}</span>
                  <select value={look.costume || ''} onChange={(e) => setLook({ costume: e.target.value, ...(hasHeadwear(e.target.value) ? { hat: '' } : {}) })} className={lookField} data-voice-look-costume>
                    {outfits.map((c: string) => <option key={c} value={c}>{outfitName(c)}</option>)}
                  </select>
                </label>
                <div className="grid grid-cols-2 gap-2">
                  <label className="block">
                    <span className={lookLabel}>{t.avatarHat || 'Hat'}</span>
                    <select
                      value={headwear ? '' : look.hat || ''} onChange={(e) => setLook({ hat: e.target.value })} className={lookField} data-voice-look-hat
                      disabled={headwear} title={headwear ? (t.avatarCostumeHasHat || 'This outfit has its own headwear') : undefined}
                    >
                      <option value="">{t.avatarHatNone || 'None'}</option>
                      {hats.map((h: string) => <option key={h} value={h}>{hatName(h)}</option>)}
                    </select>
                  </label>
                  <AvatarColourSelect colouring={look.colouring || 'layout'} set={setLook} t={t} />
                </div>
                <AvatarColourExtras colouring={look.colouring || 'layout'} ownColour={look.ownColour} set={setLook} accent={accent} t={t} />
              </>
            )}
          </div>
        </div>
      ) : (
      <div className="grid grid-cols-3 gap-3 max-w-md">
        {KINDS.map((kind) => (
          <div key={kind} className="space-y-1.5">
            <span className="block text-[9px] font-black uppercase tracking-widest text-zinc-500">{label[kind]}</span>
            <div className="relative aspect-square rounded-xl border border-zinc-800 overflow-hidden grid place-items-center" style={CHECKER}>
              {entry[kind] ? (
                <StillImg src={entry[kind]} width={160} alt="" className="w-full h-full object-contain" />
              ) : (
                <span className="text-[9px] text-zinc-600 text-center px-2">
                  {kind === 'quiet' ? (t.voicePicQuietNone || 'Their avatar') : kind === 'talking' ? (t.voicePicTalkingNone || 'The quiet one, hopping') : (t.voicePicMutedNone || 'The quiet one, with a badge')}
                </span>
              )}
            </div>
            <div className="flex gap-1">
              <label className="flex-1 flex items-center justify-center gap-1 px-1.5 py-1 rounded-md border border-zinc-800 bg-zinc-900 text-zinc-400 hover:bg-zinc-800 cursor-pointer text-[9px] font-black uppercase tracking-widest" title={t.voicePicUpload || 'Upload'}>
                <Upload size={11} />
                <input type="file" accept="image/*" className="hidden" onChange={(e) => { upload(kind, e.target.files?.[0]); e.currentTarget.value = ''; }} />
              </label>
              <button
                onClick={() => setChoosing(choosing === kind ? null : kind)} title={t.voicePicChoose || 'Choose an upload'}
                className={`flex-1 flex items-center justify-center px-1.5 py-1 rounded-md border text-zinc-400 hover:bg-zinc-800 ${choosing === kind ? 'border-current-accent bg-zinc-800' : 'border-zinc-800 bg-zinc-900'}`}
              >
                <Images size={11} />
              </button>
              {entry[kind] && (
                <button onClick={() => set(kind, '')} title={t.voicePicClear || 'Clear'} className="px-1.5 py-1 rounded-md border border-zinc-800 bg-zinc-900 text-zinc-500 hover:text-rose-400">
                  <Trash2 size={11} />
                </button>
              )}
            </div>
          </div>
        ))}
      </div>
      )}

      {busy && <p className="text-[10px] text-zinc-500">{busy}</p>}

      {choosing && !entry.avatar && (
        <div className="space-y-1.5">
          <span className="block text-[9px] font-black uppercase tracking-widest text-zinc-500">{(t.voicePicChooseFor || 'Choose the picture for')} {label[choosing].toLowerCase()}</span>
          {assets.length === 0 ? (
            <p className="text-[10px] text-zinc-600">{t.voicePicNoUploads || 'Nothing uploaded yet. Use the upload button.'}</p>
          ) : (
            <div className="grid grid-cols-6 gap-1.5 max-h-44 overflow-y-auto">
              {assets.map((a) => (
                <button
                  key={a.url} onClick={() => { set(choosing, a.url); setChoosing(null); }}
                  className="aspect-square rounded-lg border border-zinc-800 hover:border-current-accent overflow-hidden" style={CHECKER}
                >
                  <StillImg src={a.url} width={72} alt="" className="w-full h-full object-contain" />
                </button>
              ))}
            </div>
          )}
        </div>
      )}

      {!entry.avatar && (
        <p className="text-[10px] text-zinc-600 leading-relaxed">
          {t.voicePicHint || 'Transparent PNGs or GIFs of the same size work best, so the swap looks like the same character opening their mouth. Every voice layer uses these unless it is told not to.'}
        </p>
      )}
    </div>
  );
};
