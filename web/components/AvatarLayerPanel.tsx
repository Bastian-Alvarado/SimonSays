/**
 * @license
 * SPDX-License-Identifier: Apache-2.0 AND LicenseRef-Commons-Clause-1.0
 *
 * How an avatar layer draws the pixel avatar: which face it rests on, what
 * it wears, its colour, and what it does by itself — blink, talk along with
 * somebody in the Discord call, pull a face at alerts — and a line of text
 * under it, for a screen that says "back soon".
 */
import React, { useEffect, useState } from 'react';
import { PixelAvatar } from './PixelAvatar';
import { PixelKitAvatar } from './PixelKitAvatar';
import { AVATAR_EXPRESSIONS_LIST, AVATAR_HEADWEAR, AVATAR_HATS, AVATAR_EXTRAS_LIST, AVATAR_REACTIONS, AVATAR_REACTION_DEFAULTS, AVATAR_COSTUMES_LIST, AVATAR_SLEEP_AFTER, AVATAR_DEEP_SLEEP_AFTER, AVATAR_ACTIONS_LIST, AVATAR_OUTFIT_NAMES, AVATAR_COLOUR_NAME, avatarColours } from '../../shared/avatar.js';
import { pixelColours, pixelHats, pixelOutfit, pixelHasFace } from '../../shared/pixel-avatars.js';
import { kitFor, HOUSE_CHARACTER } from '../../shared/house-avatar.js';
import { PLAYER_COLOURS } from '../../shared/players.js';
import { pixelFaceChoices, pixelFaceName, pixelOutfitName, pixelExtraName, pixelFaceCrop, pixelActionLabel } from './pixelNames';
import type { PixelAvatarDef } from '../types';
import { TalkWithSelect, TalkChoices } from './TalkWithSelect';
import { fill } from '../words';

interface Props {
  config: Record<string, any>;
  patch: (next: Record<string, any>) => void;
  /** Who it can talk along with: the call now, the people set up, the rest of the Discord server. */
  choices: TalkChoices;
  /** Whether the bot listens for who talks, on the Voice call screen. */
  listening: boolean;
  accent?: string;
  /** The avatars drawn in the Pixel avatars tab, any of which it can be drawn as. */
  pixelAvatars?: PixelAvatarDef[];
  t: any;
}

const field = 'w-full bg-zinc-950/60 border border-zinc-800 rounded-md px-1.5 py-1 text-[10px] text-zinc-300 outline-none focus:border-current-accent';
const label = 'text-[8px] font-black uppercase tracking-widest text-zinc-600';
/** The face alone, from the eyebrow to the chin, so a thumbnail shows the expression. */
const FACE = '22 34 48 44';
const CREWMATE = Object.keys(PLAYER_COLOURS).filter((c) => c !== 'grey');

const Check = ({ on, set, text }: { on: boolean; set: (v: boolean) => void; text: string }) => (
  <label className="flex items-center gap-2 cursor-pointer">
    <input type="checkbox" checked={on} onChange={(e) => set(e.target.checked)} className="accent-current-accent" />
    <span className="text-[9px] text-zinc-400">{text}</span>
  </label>
);

export function avatarFaceNames(t: any): Record<string, string> {
  return {
    neutral: t.avatarFaceNeutral || 'Resting',
    blink: t.avatarFaceBlink || 'Eyes closed',
    talking: t.avatarFaceTalking || 'Talking',
    happy: t.avatarFaceHappy || 'Happy',
    surprised: t.avatarFaceSurprised || 'Surprised',
    startled: t.avatarFaceStartled || 'Startled',
    wink: t.avatarFaceWink || 'Wink',
    sad: t.avatarFaceSad || 'Sad',
    angry: t.avatarFaceAngry || 'Angry',
    'star-eyes': t.avatarFaceStars || 'Star eyes',
    'heart-eyes': t.avatarFaceHearts || 'Heart eyes',
    dizzy: t.avatarFaceDizzy || 'Dizzy',
    sleepy: t.avatarFaceSleepy || 'Sleepy',
    'deep-sleep': t.avatarFaceDeepSleep || 'Fast asleep',
  };
}

/** The outfits by name, as the panel, the PNGtuber screen and the dress-up step show them: the character's own (shared/avatar-art.js). */
export function avatarCostumeNames(t: any): Record<string, string> {
  return Object.fromEntries(Object.entries(AVATAR_OUTFIT_NAMES as Record<string, { en: string; es: string }>).map(([name, words]) => [name, t.lang === 'es' ? words.es : words.en]));
}

export function avatarHatNames(t: any): Record<string, string> {
  return {
    'party-hat': t.avatarPartyHat || 'Party hat',
    'wizard-hat': t.avatarWizardHat || 'Wizard hat',
    deerstalker: t.avatarDeerstalker || 'Detective cap',
    'pirate-hat': t.avatarPirateHat || 'Pirate hat',
    'cat-beanie': t.avatarCatBeanie || 'Cat beanie',
    'cowboy-hat': t.avatarCowboyHat || 'Cowboy hat',
    'santa-hat': t.avatarSantaHat || 'Santa hat',
    'chef-hat': t.avatarChefHat || 'Chef hat',
    crown: t.avatarCrown || 'Crown',
  };
}

/** What it can do, by name, as the PNGtuber screen shows it. */
export function avatarActionNames(t: any): Record<string, string> {
  return {
    drink: t.avatarActionDrink || 'Drink water',
  };
}

/**
 * The avatar's colour, chosen: as drawn, the layout's, one of your own, a
 * crewmate's or night vision. The same choice wherever the avatar is set up
 * — an avatar layer, or somebody in the voice call — kept as `colouring`
 * and, for a colour of your own, `ownColour`.
 */
interface ColourProps {
  colouring: string;
  ownColour?: string;
  set: (next: { colouring?: string; ownColour?: string }) => void;
  accent?: string;
  t: any;
}

export const AvatarColourSelect = ({ colouring, set, t }: ColourProps) => {
  const mode = PLAYER_COLOURS[colouring as keyof typeof PLAYER_COLOURS] ? 'crewmate' : colouring;
  return (
    <label className="block">
      <span className={label}>{t.avatarColour || 'Colour'}</span>
      <select
        value={mode}
        onChange={(e) => set({ colouring: e.target.value === 'crewmate' ? 'red' : e.target.value })}
        className={field}
      >
        <option value="original">{t.avatarColourOriginal || 'As drawn'}</option>
        <option value="layout">{t.avatarColourLayout || 'The layout colour'}</option>
        <option value="own">{t.avatarColourOwn || 'A colour of your own'}</option>
        <option value="crewmate">{t.avatarColourCrewmate || 'A crewmate colour'}</option>
        <option value="night-vision">{t.avatarColourNight || 'Night vision'}</option>
      </select>
    </label>
  );
};

/** What goes with the colour chosen: the colour of your own, the crewmate colours, or why the layout colour shows as drawn. */
export const AvatarColourExtras = ({ colouring, ownColour, set, accent, t }: ColourProps) => {
  const mode = PLAYER_COLOURS[colouring as keyof typeof PLAYER_COLOURS] ? 'crewmate' : colouring;
  return (
    <>
      {mode === 'own' && (
        <label className="flex items-center gap-1.5">
          <input type="color" value={ownColour || '#a56cae'} onChange={(e) => set({ ownColour: e.target.value })} className="w-6 h-6 bg-transparent border border-zinc-800 rounded cursor-pointer" />
          <span className={label}>{t.lang === 'es' ? AVATAR_COLOUR_NAME.es : AVATAR_COLOUR_NAME.en}</span>
        </label>
      )}
      {mode === 'crewmate' && (
        <div className="flex flex-wrap gap-1">
          {CREWMATE.map((c) => (
            <button
              key={c} onClick={() => set({ colouring: c })} title={c}
              className={`w-5 h-5 rounded border ${colouring === c ? 'border-white' : 'border-zinc-800'}`}
              style={{ background: (PLAYER_COLOURS as Record<string, string>)[c] }}
            />
          ))}
        </div>
      )}
      {mode === 'layout' && !accent && (
        <p className="text-[9px] text-zinc-600">{t.avatarNoAccent || 'This layout has no colour of its own, so the avatar is drawn as it was drawn. Give the layout one to change it.'}</p>
      )}
    </>
  );
};

export const AvatarLayerPanel = ({ config, patch, choices, listening, accent, pixelAvatars = [], t }: Props) => {
  /*
    Drawn as the built-in avatar, or as one from the Pixel avatars tab — whose
    faces, outfits, hats and extras are its own, so every list below is its.
  */
  const kit = kitFor(config.character, pixelAvatars);
  // The one it names, gone from the tab: what draws instead is said.
  const gone = Boolean(config.character) && !pixelAvatars.some((p) => p.id === config.character);
  const faceList: string[] = kit ? pixelFaceChoices(kit) : AVATAR_EXPRESSIONS_LIST;
  const faceName = (f: string) => (kit ? pixelFaceName(kit, f, t) : avatarFaceNames(t)[f]);
  const outfitList: string[] = kit ? ['', ...kit.outfits.map((o) => o.name)] : AVATAR_COSTUMES_LIST;
  const outfitName = (o: string) => (kit ? pixelOutfitName(kit, o, t) : avatarCostumeNames(t)[o] || o);
  const hatList: string[] = kit ? pixelHats(kit) : AVATAR_HATS;
  const hatName = (h: string) => (kit ? pixelExtraName(kit, h, t) : avatarHatNames(t)[h] || h);
  const headwear = kit ? Boolean(pixelOutfit(kit, config.costume || '')?.headwear) : AVATAR_HEADWEAR.includes(config.costume);
  const plainExtras: { id: string; name: string }[] = kit
    ? kit.extras.filter((e) => !e.hat).map((e) => ({ id: e.name, name: pixelExtraName(kit, e.name, t) }))
    : [{ id: 'blush', name: t.avatarBlush || 'Blush' }, { id: 'sweat', name: t.avatarSweat || 'Sweat drop' }, { id: 'mic', name: t.avatarMic || 'Headset mic' }];
  const extras: string[] = config.extras || [];
  const colouring: string = config.colouring || 'layout';
  const colours = kit ? pixelColours(kit, colouring, { accent, own: config.ownColour }) : avatarColours(colouring, { accent, own: config.ownColour });
  const hat = extras.find((e) => hatList.includes(e)) || '';
  const setExtra = (id: string, on: boolean) => patch({ extras: on ? [...extras.filter((e) => e !== id), id] : extras.filter((e) => e !== id) });
  const setHat = (id: string) => patch({ extras: [...extras.filter((e) => !hatList.includes(e)), ...(id ? [id] : [])] });
  // Changing who it is drawn as keeps whatever the new one also has, and lets go of the rest.
  const setCharacter = (id: string) => {
    const next = kitFor(id, pixelAvatars);
    const hasFace = (f: string) => (next ? pixelHasFace(next, f) : (AVATAR_EXPRESSIONS_LIST as string[]).includes(f));
    const hasOutfit = (o: string) => !o || (next ? Boolean(pixelOutfit(next, o)) : (AVATAR_COSTUMES_LIST as string[]).includes(o));
    const hasExtra = (e: string) => (next ? next.extras.some((x) => x.name === e) : (AVATAR_EXTRAS_LIST as string[]).includes(e));
    patch({
      character: id,
      expression: hasFace(config.expression || 'neutral') ? config.expression || 'neutral' : 'neutral',
      costume: hasOutfit(config.costume || '') ? config.costume || '' : '',
      extras: extras.filter(hasExtra),
    });
  };
  const Thumb = ({ face }: { face: string }) => (kit
    ? <PixelKitAvatar kit={kit} faces={face} extras={extras} colours={colours} crop={pixelFaceCrop(kit)} outfit={config.costume || ''} />
    : <PixelAvatar faces={face} extras={extras} colours={colours} crop={FACE} costume={config.costume || ''} />);
  // What it can do, to do as an alert lands: the built-in avatar's, or its pixel avatar's own.
  const actionList: string[] = kit ? kit.actions.map((a) => a.name) : AVATAR_ACTIONS_LIST;
  const actionName = (a: string) => (kit ? pixelActionLabel(kit, a, t) : avatarActionNames(t)[a] || a);
  // Eyes it can find glance and sparkle; one that turns looks about by turning.
  const glances = !kit || Boolean(kit.eyes) || Boolean(kit.turn);
  const twinkles = !kit || Boolean(kit.eyes);

  const who = config.talkWith as { id: string; name: string } | null;

  // Typed text keeps its own copy until it loses focus, so a keystroke is not a save.
  const [text, setText] = useState(config.label || '');
  useEffect(() => { setText(config.label || ''); }, [config.label]);

  const reactionNames: Record<string, string> = {
    follow: t.avatarOnFollow || 'Follow',
    sub: t.avatarOnSub || 'Sub',
    gift: t.avatarOnGift || 'Gift',
    cheer: t.avatarOnCheer || 'Bits',
    raid: t.avatarOnRaid || 'Raid',
    hype: t.avatarOnHype || 'Hype Train',
  };

  return (
    <div className="space-y-2.5 pt-2 border-t border-zinc-800/60" onClick={(e) => e.stopPropagation()} data-avatar-panel>
      <label className="block">
        <span className={label}>{t.pixelDrawnAs || 'Drawn as'}</span>
        <select value={kit ? kit.id : ''} onChange={(e) => setCharacter(e.target.value)} className={field} data-avatar-character>
          {/* With a house avatar standing in for it, there is no built-in one to offer. */}
          {!HOUSE_CHARACTER && <option value="">{t.pixelBuiltIn || 'The built-in avatar'}</option>}
          {pixelAvatars.map((p) => <option key={p.id} value={p.id}>{p.name}{p.example ? ` (${t.pixelExampleTag || 'example'})` : ''}</option>)}
        </select>
        {gone && (
          <span className="block mt-1 text-[9px] text-amber-500">
            {kit
              ? (t.pixelGoneHouse || 'That pixel avatar is gone, so {name} is drawn instead.').replace('{name}', kit.name)
              : (t.pixelGone || 'That pixel avatar is gone, so the built-in one is drawn instead.')}
          </span>
        )}
      </label>

      <span className={label}>{t.avatarFace || 'Face'}</span>
      <div className="grid grid-cols-4 gap-1.5">
        {faceList.map((f: string) => (
          <button
            key={f} onClick={() => patch({ expression: f })} title={faceName(f)}
            className={`rounded-md border overflow-hidden bg-zinc-900 ${(config.expression || 'neutral') === f ? 'border-current-accent' : 'border-zinc-800 hover:border-zinc-600'}`}
          >
            <div className="aspect-[48/44]"><Thumb face={f} /></div>
            <span className="block text-[8px] text-zinc-400 py-0.5 truncate">{faceName(f)}</span>
          </button>
        ))}
      </div>

      {outfitList.length > 1 && (
        <label className="block">
          <span className={label}>{t.avatarCostume || 'Outfit'}</span>
          <select value={config.costume || ''} onChange={(e) => patch({ costume: e.target.value })} className={field}>
            {outfitList.map((c: string) => <option key={c} value={c}>{outfitName(c)}</option>)}
          </select>
        </label>
      )}

      <div className="grid grid-cols-2 gap-2">
        {hatList.length > 0 ? (
          <label className="block">
            <span className={label}>{t.avatarHat || 'Hat'}</span>
            <select value={hat} onChange={(e) => setHat(e.target.value)} className={field} disabled={headwear} title={headwear ? (t.avatarCostumeHasHat || 'This outfit has its own headwear') : undefined}>
              <option value="">{t.avatarHatNone || 'None'}</option>
              {hatList.map((h: string) => <option key={h} value={h}>{hatName(h)}</option>)}
            </select>
          </label>
        ) : <span />}
        <AvatarColourSelect colouring={colouring} set={patch} t={t} />
      </div>
      <AvatarColourExtras colouring={colouring} ownColour={config.ownColour} set={patch} accent={accent} t={t} />

      <div className="flex flex-wrap gap-x-3 gap-y-1">
        {plainExtras.map((e) => <Check key={e.id} on={extras.includes(e.id)} set={(v) => setExtra(e.id, v)} text={e.name} />)}
        <Check on={config.blink !== false} set={(v) => patch({ blink: v })} text={t.avatarBlinks || 'Blinks'} />
        {glances && <Check on={config.glance !== false} set={(v) => patch({ glance: v })} text={t.avatarGlances || 'Eyes glance around'} />}
        {twinkles && <Check on={config.twinkle !== false} set={(v) => patch({ twinkle: v })} text={t.avatarTwinkles || 'Eyes sparkle'} />}
        <Check on={config.breathe !== false} set={(v) => patch({ breathe: v })} text={t.avatarBreathes || 'Breathes'} />
        <Check on={config.watch !== false} set={(v) => patch({ watch: v })} text={t.avatarWatches || 'Eyes follow what happens on screen'} />
        {config.watch !== false && <Check on={config.overwhelm !== false} set={(v) => patch({ overwhelm: v })} text={t.avatarOverwhelm || 'Gets dizzy when too much happens at once'} />}
      </div>
      {config.watch !== false && config.overwhelm !== false && (
        <label className="block">
          <span className={label}>{(t.avatarOverwhelmCount || 'Dizzy after this many things within a second and a half')}: <span className="text-zinc-300">{config.overwhelmCount ?? 3}</span></span>
          <input
            type="range" min={3} max={6} step={1} value={config.overwhelmCount ?? 3}
            onChange={(e) => patch({ overwhelmCount: Number(e.target.value) })}
            className="w-full accent-current-accent" data-avatar-overwhelm-count
          />
        </label>
      )}

      <label className="block">
        <span className={label}>{t.avatarTalkWhen || 'Talks when'}</span>
        {/* Somebody in the call, or somebody who is not yet: set up before they join. */}
        <TalkWithSelect value={who} onChange={(next) => patch({ talkWith: next })} choices={choices} nobody listening={listening} className={field} t={t} />
      </label>
      {who && (
        <div className="flex flex-wrap gap-x-3 gap-y-1">
          <Check on={config.hop !== false} set={(v) => patch({ hop: v })} text={t.avatarHop || 'Hops while talking'} />
          {who.id === 'mic' && <Check on={config.shake !== false} set={(v) => patch({ shake: v })} text={t.avatarShake || 'Shakes when loud'} />}
        </div>
      )}
      {who && (
        <label className="block">
          <span className={label}>{t.avatarSleepAfter || 'Dozes off when quiet for'}</span>
          <select value={String(config.sleepAfter ?? 3)} onChange={(e) => patch({ sleepAfter: Number(e.target.value) })} className={field}>
            {AVATAR_SLEEP_AFTER.map((m: number) => <option key={m} value={m}>{m === 0 ? (t.avatarSleepNever || 'Never') : `${m} min`}</option>)}
          </select>
          {(config.sleepAfter ?? 3) > 0 && (
            <span className="block mt-1 text-[9px] text-zinc-600 leading-relaxed">
              {(t.avatarSleepDeepHint || 'Quiet twice as long ({n} min) and it falls fast asleep: nodding, snoring a bubble, big z\'s.').replace('{n}', String((config.sleepAfter ?? 3) * AVATAR_DEEP_SLEEP_AFTER))}
            </span>
          )}
        </label>
      )}
      {who?.id === 'mic' && (
        <label className="block">
          <span className={label}>{t.avatarLoudFace || 'Face when loud'}</span>
          <select value={config.loudFace || 'none'} onChange={(e) => patch({ loudFace: e.target.value })} className={field}>
            <option value="none">{t.avatarLoudFaceNone || 'Keep the same face'}</option>
            {faceList.filter((f: string) => !['neutral', 'talking', 'blink'].includes(f)).map((f: string) => <option key={f} value={f}>{faceName(f)}</option>)}
          </select>
        </label>
      )}

      <Check on={config.react !== false} set={(v) => patch({ react: v })} text={t.avatarReact || 'Pulls a face at alerts, for as long as the alert is up'} />
      {config.react !== false && (
        <div className={`grid ${actionList.length ? 'grid-cols-1' : 'grid-cols-2'} gap-x-3 gap-y-1`} data-avatar-reactions>
          {AVATAR_REACTIONS.map((kind: string) => (
            <div key={kind} className="flex items-center gap-2">
              <span className={`${label} w-10 shrink-0`}>{reactionNames[kind]}</span>
              <select
                value={config.reactions?.[kind] ?? (AVATAR_REACTION_DEFAULTS as Record<string, string>)[kind]}
                onChange={(e) => patch({ reactions: { ...(config.reactions || {}), [kind]: e.target.value } })}
                className={field}
              >
                <option value="none">—</option>
                {faceList.filter((f: string) => f !== 'neutral').map((f: string) => <option key={f} value={f}>{faceName(f)}</option>)}
              </select>
              {actionList.length > 0 && (
                <select
                  value={config.reactionActions?.[kind] || 'none'} title={t.avatarOnAlertDoes || 'and does'}
                  onChange={(e) => {
                    const next = { ...(config.reactionActions || {}) };
                    if (e.target.value === 'none') delete next[kind]; else next[kind] = e.target.value;
                    patch({ reactionActions: next });
                  }}
                  className={field} data-avatar-reaction-action={kind}
                >
                  <option value="none">{t.avatarOnAlertDoes || 'and does'}: —</option>
                  {actionList.map((a) => <option key={a} value={a}>{actionName(a)}</option>)}
                </select>
              )}
            </div>
          ))}
        </div>
      )}

      <Check on={config.dressable !== false} set={(v) => patch({ dressable: v })} text={t.avatarDressable || 'Viewers can dress it up (the "Avatar: dress up" action step)'} />

      <label className="block">
        <span className={label}>{t.avatarLabel || 'Text under it (optional)'}</span>
        <input
          value={text} maxLength={60} placeholder={t.avatarLabelPlaceholder || 'Back soon'}
          onChange={(e) => setText(e.target.value)}
          onBlur={() => { if (text !== (config.label || '')) patch({ label: text }); }}
          className={field}
        />
      </label>
    </div>
  );
};

/** A named pixel avatar: one avatar layer's settings under a name (server/engine/layouts.js cleanAvatarSources). */
export interface AvatarSource { id: string; name: string; config: Record<string, any> }

interface SectionProps extends Omit<Props, 'config' | 'patch'> {
  /** This layer's own settings, with `source` when it wears a named avatar. */
  layerConfig: Record<string, any>;
  /** Change this layer's own settings. */
  patchLayer: (next: Record<string, any>) => void;
  /** Replace this layer's own settings outright: unlinking writes the named avatar's in. */
  setLayer: (config: Record<string, any>) => void;
  sources: AvatarSource[];
  /** How many avatar layers on this profile's layouts wear it, this one left out. */
  othersWearing: (id: string) => number;
  /** The named avatars' requests: create, save, rename, delete. Answers, or refuses. */
  request: (payload: Record<string, any>) => Promise<any>;
  /** A refusal in the screen's language. */
  why: (err: any) => string;
}

/**
 * An avatar layer's settings, or the named avatar's it wears.
 *
 * Named, an avatar becomes a source of its own, the way one OBS source sits
 * in many scenes: every avatar layer on any layout that wears the name draws
 * with the same settings, and changing them from any one changes them all.
 * The layer keeps its own settings underneath, so taking the name off — or
 * the name going — leaves it drawing as it was, with the shared ones copied in.
 */
export const AvatarLayerSection = ({ layerConfig, patchLayer, setLayer, sources, othersWearing, request, why, ...panel }: SectionProps) => {
  const shared = sources.find((s) => s.id === layerConfig.source) || null;
  const [naming, setNaming] = useState('');
  const [renaming, setRenaming] = useState('');
  const [problem, setProblem] = useState('');
  // What was just changed, shown at once rather than after the round trip; the server's copy takes over when it lands.
  const [draft, setDraft] = useState<Record<string, any> | null>(null);
  useEffect(() => { setDraft(null); }, [shared?.id, JSON.stringify(shared?.config || null)]);
  useEffect(() => { setRenaming(shared?.name || ''); setProblem(''); }, [shared?.id, shared?.name]);

  const ask = async (payload: Record<string, any>) => {
    setProblem('');
    try {
      return await request(payload);
    } catch (err: any) {
      setProblem(why(err));
      return null;
    }
  };
  const { source, ...own } = layerConfig;
  const create = async () => {
    const answer = await ask({ op: 'create', name: naming, config: own });
    if (answer?.id) { patchLayer({ source: answer.id }); setNaming(''); }
  };
  // Back to a layer of its own, as the named avatar looks now; the last one to leave a name takes the name away with it.
  const unlink = () => {
    if (!shared) return;
    setLayer({ ...shared.config });
    if (othersWearing(shared.id) === 0) ask({ op: 'delete', id: shared.id });
  };
  const rename = () => {
    if (shared && renaming.trim() && renaming.trim() !== shared.name) ask({ op: 'rename', id: shared.id, name: renaming });
  };
  // Every avatar layer wearing it, this one included when it does.
  const wearing = (id: string) => othersWearing(id) + (shared?.id === id ? 1 : 0);
  const config = shared ? (draft || shared.config) : layerConfig;
  const patch = (next: Record<string, any>) => {
    if (!shared) return patchLayer(next);
    const merged = { ...(draft || shared.config), ...next };
    setDraft(merged);
    ask({ op: 'save', id: shared.id, config: merged });
  };

  return (
    <div className="space-y-3">
      <div className="space-y-1.5" data-avatar-source>
        <span className={label}>{panel.t.avatarSource || 'Named avatar'}</span>
        <select
          value={shared?.id || ''}
          onChange={(e) => (e.target.value ? patchLayer({ source: e.target.value }) : unlink())}
          className={field}
          data-avatar-source-pick
        >
          <option value="">{panel.t.avatarSourceNone || 'Only this layer'}</option>
          {sources.map((s) => (
            <option key={s.id} value={s.id}>
              {s.name} · {wearing(s.id) === 1 ? (panel.t.avatarSourceLayerOne || '1 layer') : fill(panel.t.avatarSourceLayers || '{n} layers', { n: wearing(s.id) })}
            </option>
          ))}
        </select>
        {shared ? (
          <>
            <p className="text-[9px] text-zinc-500 leading-snug" data-avatar-source-note>
              {fill(othersWearing(shared.id) === 0
                ? (panel.t.avatarSourceAlone || 'These settings are «{name}»\'s. Pick it on another avatar layer and it will look the same there.')
                : othersWearing(shared.id) === 1
                  ? (panel.t.avatarSourceSharedOne || 'These settings are «{name}»\'s: changing them changes it on 1 other layer too.')
                  : (panel.t.avatarSourceShared || 'These settings are «{name}»\'s: changing them changes it on {n} other layers too.'), { name: shared.name, n: othersWearing(shared.id) })}
            </p>
            <div className="flex gap-1.5">
              <input
                value={renaming}
                onChange={(e) => setRenaming(e.target.value)}
                onBlur={rename}
                onKeyDown={(e) => { if (e.key === 'Enter') rename(); }}
                maxLength={40}
                className={`${field} flex-1 min-w-0`}
                data-avatar-source-name
              />
              <button onClick={unlink} className="px-2 rounded-md border border-zinc-800 text-[8px] font-black uppercase tracking-widest text-zinc-400 hover:text-white whitespace-nowrap" data-avatar-source-unlink>
                {panel.t.avatarSourceUnlink || 'Make it its own'}
              </button>
            </div>
          </>
        ) : (
          <div className="flex gap-1.5">
            <input
              value={naming}
              onChange={(e) => setNaming(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter' && naming.trim()) create(); }}
              placeholder={panel.t.avatarSourceNamePlaceholder || 'Name it to use it on other layouts'}
              maxLength={40}
              className={`${field} flex-1 min-w-0`}
              data-avatar-source-new
            />
            <button
              onClick={create}
              disabled={!naming.trim()}
              className="px-2 rounded-md border border-zinc-800 text-[8px] font-black uppercase tracking-widest text-zinc-400 hover:text-white disabled:opacity-40 whitespace-nowrap"
              data-avatar-source-create
            >
              {panel.t.avatarSourceCreate || 'Name it'}
            </button>
          </div>
        )}
        {problem && <p className="text-[9px] text-rose-400" data-avatar-source-problem>{problem}</p>}
      </div>
      <AvatarLayerPanel {...panel} config={config} patch={patch} />
    </div>
  );
};
