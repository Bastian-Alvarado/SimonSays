/**
 * @license
 * SPDX-License-Identifier: Apache-2.0 AND LicenseRef-Commons-Clause-1.0
 *
 * The Discord voice call on stream: an avatar for everybody in it, glowing
 * while they talk.
 *
 * Who is in the call and who is talking come from the server (see
 * server/platforms/discord-voice.js); the Voice call screen chooses the
 * channel. This only draws them. Nothing is drawn while the call is empty.
 *
 * Tiles are sized by how many the layer has room for, not by who is there,
 * so an avatar does not grow when somebody leaves or shrink when somebody
 * joins — the lesson of the players list. More people than room and they
 * shrink to fit rather than being dropped.
 *
 * Somebody with pictures of their own — set on the Voice call screen — is
 * drawn with those instead of their avatar, PNGtuber style: the quiet one,
 * swapped for the talking one the moment they speak, and hopping while they
 * do. Their pictures are drawn whole rather than cropped into the avatar's
 * circle, since they are usually a character on a transparent background.
 *
 * Plain on purpose: this is the default look, and themes dress it. Every
 * part names itself (data-voice), and every tile says whether its person is
 * talking, muted or deafened (data-voice-speaking, -muted, -deafened) and
 * whether it is drawn with pictures (data-voice-pictured).
 *
 * An emoji reaction or a soundboard sound somebody sends in the call pops up
 * over their tile for a few seconds (data-voice="reaction"; the tile says
 * data-voice-reacting meanwhile). The server keeps it only that long.
 *
 * Somebody can be drawn as the pixel avatar instead (shared/avatar.js): it
 * talks while they talk and blinks while they do not, in the colour, outfit
 * and hat chosen for them — the layout's colour unless told otherwise. A
 * regular can be their own drawing (shared/avatar-regulars.js), opening its
 * mouth as they talk.
 */
import React, { useEffect, useMemo, useRef, useState } from 'react';
import { MicOff, HeadphoneOff } from 'lucide-react';
import { LivingAvatar } from './AvatarLayer';
import { avatarCallProps, avatarFacingToward, AVATAR_TURN_HOLD_MS } from '../../shared/avatar.js';
import { pixelColours } from '../../shared/pixel-avatars.js';
import { kitFor } from '../../shared/house-avatar.js';
import type { PixelAvatarDef } from '../types';

/**
 * How somebody drawn as the pixel avatar looks: a regular's own drawing, or
 * the avatar with the choices an avatar layer has. Empty is the avatar in
 * the layout colour (see avatarCallLook in shared/avatar.js).
 */
export interface VoiceLook {
  /** A pixel avatar from the Pixel avatars tab, by its id: its colour, outfit and hat below are its own. */
  kit?: string;
  drawing?: string;
  colouring?: string;
  ownColour?: string;
  costume?: string;
  hat?: string;
}

export interface VoicePictures {
  name?: string;
  quiet?: string;
  talking?: string;
  muted?: string;
  /** Drawn as the pixel avatar rather than with pictures. */
  avatar?: boolean;
  /** And how, when it is. */
  look?: VoiceLook;
}

/**
 * Somebody drawn as the pixel avatar, in their look, against the layout's
 * accent: on stream, on the Voice call screen and in its preview alike.
 */
export const VoicePixel = ({ look, accent, speaking = false, hop = true, facing = null, pixelAvatars = [] }: { look?: VoiceLook; accent?: string; speaking?: boolean; hop?: boolean; facing?: 'left' | 'front' | 'right' | null; pixelAvatars?: PixelAvatarDef[] }) => {
  const key = JSON.stringify(look || {});
  // A pixel avatar from the tab, if their look names one that is still there; gone or none, the house avatar draws them.
  const kit = kitFor(look?.kit, pixelAvatars);
  const drawn = useMemo(() => (kit
    ? { drawing: '', costume: look?.costume || '', extras: look?.hat ? [look.hat] : [], colours: pixelColours(kit, look?.colouring || 'layout', { accent, own: look?.ownColour }) as Record<string, string> }
    // eslint-disable-next-line react-hooks/exhaustive-deps
    : avatarCallProps(look || {}, accent)), [key, accent, kit]);
  return <LivingAvatar speaking={speaking} hop={hop} colours={drawn.colours} costume={drawn.costume} extras={drawn.extras} drawing={drawn.drawing} facing={facing} kit={kit} glance={!kit || Boolean(kit.eyes || kit.turn)} twinkle={!kit || Boolean(kit.eyes)} />;
};

/**
 * Who talked last in the call: whoever started talking most recently, kept
 * through the gaps between their words — AVATAR_TURN_HOLD_MS after everybody
 * has gone quiet — so what turns toward them does not turn away at each one.
 */
export function useLastSpeaker(members: VoiceMember[]) {
  const talking = members.filter((m) => m.speaking && !m.muted).map((m) => m.id);
  const key = talking.join(',');
  const [last, setLast] = useState<string | null>(null);
  const before = useRef<string[]>([]);
  useEffect(() => {
    const started = talking.filter((id) => !before.current.includes(id));
    before.current = talking;
    if (started.length) { setLast(started[started.length - 1]); return undefined; }
    // Somebody still talking, and not the one faced: face them instead.
    if (talking.length) { setLast((now) => (now && talking.includes(now) ? now : talking[0])); return undefined; }
    const timer = setTimeout(() => setLast(null), AVATAR_TURN_HOLD_MS);
    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);
  return last;
}

export interface VoiceMember {
  id: string;
  name: string;
  avatar: string;
  speaking: boolean;
  muted: boolean;
  deafened: boolean;
  pictures?: VoicePictures;
  /** A reaction they just sent in the call: an emoji's character or picture, and whether it came with a sound. */
  reaction?: { id: number; text?: string; url?: string; sound?: boolean };
}

export interface VoiceLayerConfig {
  arrange?: 'row' | 'column' | 'grid';
  slots?: number;
  shape?: 'circle' | 'rounded';
  show?: 'everyone' | 'talking';
  showNames?: boolean;
  showStatus?: boolean;
  dimQuiet?: boolean;
  hide?: { id: string; name: string }[];
  glowColor?: string;
  textColor?: string;
  usePictures?: boolean;
  hop?: boolean;
  showReactions?: boolean;
}

/**
 * Which of somebody's pictures to show now, and every one they have, so all
 * of them can be loaded up front and a swap is instant rather than a blank
 * while the next one arrives. A missing talking picture falls back to the
 * quiet one, a missing quiet one to their avatar.
 */
export function pictureFor(m: VoiceMember) {
  const p = m.pictures || {};
  const quiet = p.quiet || m.avatar;
  const all = { quiet, talking: p.talking || quiet, muted: p.muted || quiet };
  const now = (m.muted || m.deafened) && p.muted ? 'muted' : m.speaking ? 'talking' : 'quiet';
  return { now: now as keyof typeof all, all };
}

/** Who a layer shows: everybody but those it hides, or only who is talking. */
export function voiceMembersFor(config: VoiceLayerConfig, members: VoiceMember[] = []) {
  const hidden = new Set((config.hide || []).map((h) => h.id));
  const shown = members.filter((m) => !hidden.has(m.id));
  return config.show === 'talking' ? shown.filter((m) => m.speaking) : shown;
}

/** Columns and rows for `count` tiles, by how the layer arranges them. */
export function voiceGrid(arrange: VoiceLayerConfig['arrange'], count: number) {
  const n = Math.max(1, count);
  if (arrange === 'column') return { cols: 1, rows: n };
  if (arrange === 'grid') {
    const cols = Math.ceil(Math.sqrt(n));
    return { cols, rows: Math.ceil(n / cols) };
  }
  return { cols: n, rows: 1 };
}

export const VoiceLayer = ({ config, voice, accent, pixelAvatars = [] }: { config: VoiceLayerConfig; voice?: { members?: VoiceMember[] }; accent?: string; pixelAvatars?: PixelAvatarDef[] }) => {
  const shown = voiceMembersFor(config, voice?.members);
  // Whoever talked last, for anybody drawn in a drawing that turns to face them.
  const lastSpeaker = useLastSpeaker(shown);
  if (!shown.length) return null;

  const room = Math.max(config.slots ?? 6, shown.length);
  const { cols, rows } = voiceGrid(config.arrange, room);
  const glow = config.glowColor || '#23a55a';
  const round = config.shape === 'rounded' ? '22%' : '50%';
  const names = config.showNames !== false;
  const usePictures = config.usePictures !== false;

  return (
    <div
      className={`w-full h-full flex flex-wrap content-start ${config.arrange === 'column' ? '' : 'justify-center'}`}
      data-voice="list"
      style={{
        color: config.textColor || '#ffffff',
        // A talking colour chosen here, for a look to read before its own.
        ['--voice-glow' as any]: config.glowColor || undefined,
      }}
    >
      {/* The hop, for anybody drawn with pictures. Named so no theme's keyframes collide with it. */}
      <style>{'@keyframes simonsaysVoiceHop { from { transform: translateY(0); } to { transform: translateY(-7%); } }'
        + '@keyframes simonsaysVoiceReact { 0% { opacity: 0; transform: scale(.3) translateY(25%); } 10% { opacity: 1; transform: scale(1.18); } 18% { transform: scale(1); } 80% { opacity: 1; transform: translateY(-12%); } 100% { opacity: 0; transform: translateY(-30%); } }'}</style>
      {shown.map((m, i) => {
        // Talking, they face the stream; otherwise toward whoever talked last, if that is across from them.
        const facing = m.speaking && !m.muted ? 'front'
          : lastSpeaker && lastSpeaker !== m.id ? avatarFacingToward(i, shown.findIndex((x) => x.id === lastSpeaker), cols) as 'left' | 'right' | null : null;
        const pixel = usePictures && m.pictures?.avatar === true;
        const pictured = pixel || (usePictures && Boolean(m.pictures?.quiet || m.pictures?.talking));
        const picture = pictured && !pixel ? pictureFor(m) : null;
        const reaction = config.showReactions !== false ? m.reaction : undefined;
        return (
        <div
          key={m.id}
          className="flex flex-col items-center justify-center" data-voice="member"
          data-voice-speaking={m.speaking ? 'true' : 'false'}
          data-voice-muted={m.muted ? 'true' : 'false'}
          data-voice-deafened={m.deafened ? 'true' : 'false'}
          data-voice-pictured={pictured ? 'true' : 'false'}
          data-voice-reacting={reaction ? 'true' : 'false'}
          style={{
            width: `${100 / cols}%`,
            height: `${100 / rows}%`,
            // Sized to its own tile, so six to a row and two to a row both read.
            containerType: 'size',
            opacity: config.dimQuiet && !m.speaking ? 0.55 : 1,
            transition: m.speaking ? 'opacity 30ms linear' : 'opacity 200ms ease-out',
          }}
        >
          <div
            className="relative shrink-0" data-voice="frame"
            style={{
              width: names ? 'min(84cqw, 72cqh)' : 'min(88cqw, 88cqh)',
              aspectRatio: '1 / 1',
              animation: picture && m.speaking && config.hop !== false ? 'simonsaysVoiceHop 0.22s ease-in-out infinite alternate' : undefined,
            }}
          >
            {pixel ? (
              <div className="absolute inset-0" data-voice="picture">
                <VoicePixel look={m.pictures?.look} accent={accent} speaking={m.speaking && !m.muted} hop={config.hop !== false} facing={facing} pixelAvatars={pixelAvatars} />
              </div>
            ) : picture ? (
              /*
                Every picture they have, stacked and loaded, with only the one
                for now showing: switching is a change of opacity, never a
                picture that has yet to arrive.
              */
              [...new Set(Object.values(picture.all))].map((src) => (
                <img
                  key={src} src={src} alt=""
                  className="absolute inset-0 w-full h-full object-contain" data-voice="picture"
                  style={{ opacity: picture.all[picture.now] === src ? 1 : 0 }}
                />
              ))
            ) : (
            <img
              src={m.avatar} alt=""
              className="w-full h-full object-cover" data-voice="avatar"
              style={{
                borderRadius: round,
                boxShadow: m.speaking ? `0 0 0 max(2px, 5cqw) ${glow}, 0 0 max(6px, 14cqw) ${glow}` : '0 0 0 max(2px, 5cqw) transparent',
                // On with the word; off with a short fade, so a pause between words is not a blink.
                transition: m.speaking ? 'box-shadow 30ms linear' : 'box-shadow 180ms ease-out',
              }}
            />
            )}
            {/* A muted picture says it already; the badge is for everybody else. */}
            {config.showStatus !== false && (m.muted || m.deafened) && (pixel || picture?.now !== 'muted') && (
              <span
                className="absolute bottom-0 right-0 grid place-items-center rounded-full bg-zinc-900 text-rose-400" data-voice="status"
                style={{ width: '30%', height: '30%', border: '2px solid #18181b' }}
              >
                {m.deafened ? <HeadphoneOff style={{ width: '58%', height: '58%' }} /> : <MicOff style={{ width: '58%', height: '58%' }} />}
              </span>
            )}
            {reaction && (
              // Keyed by the reaction, so a second one in a row pops again rather than sitting still.
              <span
                key={reaction.id}
                className="absolute grid place-items-center pointer-events-none" data-voice="reaction"
                style={{ top: '-14%', right: '-14%', width: '52%', height: '52%', fontSize: 'min(34cqw, 34cqh)', lineHeight: 1, animation: 'simonsaysVoiceReact 5s ease-out forwards', filter: 'drop-shadow(0 2px 4px #000a)' }}
              >
                {reaction.url ? <img src={reaction.url} alt="" className="w-full h-full object-contain" /> : reaction.text}
              </span>
            )}
          </div>
          {names && (
            <span
              className="max-w-full truncate font-bold leading-none" data-voice="name"
              style={{ fontSize: 'min(12cqh, 13cqw)', marginTop: '5cqh', textShadow: '0 1px 3px #000c' }}
            >
              {m.name}
            </span>
          )}
        </div>
        );
      })}
    </div>
  );
};
