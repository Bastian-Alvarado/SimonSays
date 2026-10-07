/**
 * @license
 * SPDX-License-Identifier: Apache-2.0 AND LicenseRef-Commons-Clause-1.0
 *
 * Discord voice: which call to show, and who is in it right now.
 *
 * Which call is a channel, or a person — follow yourself and the overlay goes
 * wherever you are. Seeing who is in it, muted or deafened, needs nothing
 * more: the bot hears that anyway. Lighting up whoever is talking needs the
 * bot to join the call, muted, which everyone in it will see; it watches whose
 * voice is arriving and never records or decodes any of it, and it only sits
 * in a call with somebody in it.
 *
 * The list here is the same one an overlay draws, so it doubles as the way
 * to check it works before going live. It is also where each person is set
 * up: the name shown for them on stream, their pictures, PNGtuber style,
 * whether they are pinned to come first — and whether they appear on stream
 * at all, for anybody who would rather not.
 */
import React, { useEffect, useRef, useState } from 'react';
import { useDragOrder, DragGrip } from '../../hooks/useDragOrder';
import { moveToGap } from '../../../shared/list-order.js';
import { Headphones, MicOff, HeadphoneOff, Radio, Video, Pin, PinOff, ArrowUp, ArrowDown, Eye, EyeOff, UserRound, Hash, SlidersHorizontal } from 'lucide-react';
import { VoicePicturesEditor, PictureEntry } from '../VoicePicturesEditor';
import { pictureFor, VoicePixel } from '../VoiceLayer';
import type { PixelAvatarDef } from '../../types';
import { refusalWords } from '../../words';
import { StillImg } from '../StillPicture';

export interface VoiceMember {
  id: string;
  name: string;
  discordName?: string;
  avatar: string;
  speaking: boolean;
  muted: boolean;
  deafened: boolean;
  streaming: boolean;
  video: boolean;
  pictures?: PictureEntry;
  pinned?: boolean;
  offStream?: boolean;
}

export interface VoicePerson { name: string; streamName?: string; offStream?: boolean }

export interface VoiceState {
  channelId: string;
  chosenChannelId?: string;
  follow?: { id: string; name: string } | null;
  listen: boolean;
  status: 'off' | 'waiting' | 'joining' | 'listening' | 'error';
  error?: string;
  errorCode?: string;
  /** Who may be shown on stream. */
  members: VoiceMember[];
  /** In the call, but kept off stream. */
  offStream?: VoiceMember[];
  /** Everybody given pictures, by Discord id, in the call or not. */
  pictures?: Record<string, PictureEntry>;
  /** Who always comes first, in this order, in the call or not. */
  pinned?: { id: string; name: string }[];
  /** Per person: a name for the stream, and whether they are kept off it. */
  persons?: Record<string, VoicePerson>;
  /** Who is in any call on the server, to choose somebody to follow. */
  inVoice?: { id: string; name: string; channelId: string }[];
}

interface Props {
  /** The pixel avatars drawn in the Pixel avatars tab, any of which somebody can be drawn as. */
  pixelAvatars?: PixelAvatarDef[];
  voice?: VoiceState;
  channels: { id: string; name: string; type: number }[];
  setVoice: (patch: Record<string, any>) => void;
  botConnected: boolean;
  listAssets: () => Promise<any[]>;
  uploadAsset: (file: File) => Promise<any>;
  /** The layouts, for the colour of the one that shows the call: "the layout colour" in a preview. */
  layouts?: { accent?: string; layers?: { type: string }[] }[];
  /** Everybody in the server, to set somebody up before they join a call. */
  listServerMembers?: () => Promise<ServerMember[]>;
  t: any;
}

export interface ServerMember { id: string; name: string; username: string; avatar: string }

/** Lower case and without accents, so "jose" finds José. */
const fold = (s: string) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();

/** How many of the server's members are listed at once, before a search narrows them. */
const SERVER_SHOWN = 60;

/** Voice and stage channels: the kinds a call happens in. */
const VOICE_TYPES = [2, 13];

const select = 'w-full bg-zinc-950 border border-zinc-800 rounded-xl px-4 py-2 text-xs text-white outline-none focus:border-current-accent';
const smallLabel = 'block text-[9px] font-black uppercase tracking-widest text-zinc-500';

export const VoiceView = ({ voice, channels, setVoice, botConnected, listAssets, uploadAsset, layouts = [], listServerMembers, pixelAvatars = [], t }: Props) => {
  /*
    The server's members, to set a regular up before they are in a call:
    asked for once the screen opens (the server keeps them a minute), and
    searched here by name, Discord name or username.
  */
  const [server, setServer] = useState<ServerMember[] | null>(null);
  const [serverError, setServerError] = useState('');
  const [serverQuery, setServerQuery] = useState('');
  /*
    Asked for when the screen opens and when the bot comes back — not
    whenever the action is made anew, which is at every change of state,
    many times a second in a lively call.
  */
  const listServer = useRef(listServerMembers);
  listServer.current = listServerMembers;
  useEffect(() => {
    if (!listServer.current || !botConnected) return undefined;
    let gone = false;
    listServer.current()
      .then((list) => { if (!gone) { setServer(list || []); setServerError(''); } })
      .catch((err: any) => { if (!gone) setServerError(refusalWords(t, err) || String(err?.message || err)); });
    return () => { gone = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [botConnected]);
  // The pixel avatars here in the colour of the layout that shows the call, as they will be on stream.
  const accent = (layouts.find((l) => l.accent && (l.layers || []).some((x) => x.type === 'voice')) || layouts.find((l) => l.accent))?.accent;
  const voiceChannels = (channels || []).filter((c) => VOICE_TYPES.includes(c.type));
  const channelName = (id: string) => voiceChannels.find((c) => c.id === id)?.name || '';
  const state: VoiceState = voice || { channelId: '', listen: false, status: 'off', members: [] };
  const onStream = state.members || [];
  const kept = state.offStream || [];
  // The screen shows everybody in the call; the stream shows only onStream.
  const members = [...onStream, ...kept];
  const pictures = state.pictures || {};
  const persons = state.persons || {};
  const [editing, setEditing] = useState<string | null>(null);
  const [mode, setMode] = useState<'channel' | 'person'>(state.follow?.id ? 'person' : 'channel');

  // People with pictures who are not in the call, so theirs can be changed too.
  const elsewhere = Object.entries(pictures).filter(([id]) => !members.some((m) => m.id === id));
  // People kept off stream who are not in the call, so they can be let back on.
  const keptAway = Object.entries(persons).filter(([id, p]) => p.offStream && !members.some((m) => m.id === id));
  const editingWho = editing
    ? (members.find((m) => m.id === editing)
      || { id: editing, name: persons[editing]?.name || pictures[editing]?.name || server?.find((p) => p.id === editing)?.name || t.voiceSomeone || 'Someone' })
    : null;
  const inCall = new Set(members.map((m) => m.id));
  const serverFound = (server || []).filter((p) => !serverQuery.trim() || [p.name, p.username].some((s) => fold(s).includes(fold(serverQuery.trim()))));

  const pinned = state.pinned || [];
  const isPinned = (id: string) => pinned.some((p) => p.id === id);
  const togglePin = (who: { id: string; name: string }) => setVoice({
    pinned: isPinned(who.id) ? pinned.filter((p) => p.id !== who.id) : [...pinned, { id: who.id, name: who.name }],
  });
  const movePin = (i: number, by: number) => {
    const j = i + by;
    if (j < 0 || j >= pinned.length) return;
    const next = [...pinned];
    [next[i], next[j]] = [next[j], next[i]];
    setVoice({ pinned: next });
  };
  const pinOrder = useDragOrder(({ from, gap }) => setVoice({ pinned: moveToGap(pinned, from, gap) }));

  const savePictures = (id: string, entry: PictureEntry | null) => {
    const next = { ...pictures };
    if (entry) next[id] = entry;
    else delete next[id];
    setVoice({ pictures: next });
  };
  /** One person's settings changed; the server drops somebody left with none. */
  const setPerson = (id: string, name: string, patch: Partial<VoicePerson>) => setVoice({
    persons: { ...persons, [id]: { ...(persons[id] || {}), name: persons[id]?.name || name, ...patch } },
  });
  const discordNameOf = (m: { name: string; discordName?: string }) => m.discordName || m.name;

  // Somebody to follow: whoever is in a call now, and whoever is followed already.
  const followable = [...(state.inVoice || [])];
  if (state.follow?.id && !followable.some((p) => p.id === state.follow!.id)) followable.push({ id: state.follow.id, name: state.follow.name, channelId: '' });

  const statusText = !state.listen ? (t.voiceNotListening || 'Not listening — who is talking is not shown')
    : state.status === 'listening' ? (t.voiceListening || 'Listening — the bot is in the call, muted')
      : state.status === 'joining' && !state.errorCode ? (t.voiceJoining || 'Joining the call…')
        : state.errorCode === 'voice_error' ? `${t.refuseVoiceError || 'The voice connection failed:'} ${state.error || ''}`
          : String(refusalWords(t, { code: state.errorCode, message: state.error }) || t.voiceError || 'Could not join the call')
            .split('{name}').join(state.follow?.name || '');

  const card = (m: VoiceMember) => (
    <div
      key={m.id}
      className={`flex flex-col items-center gap-2 p-3 rounded-2xl border ${m.offStream ? 'bg-zinc-950/30 border-dashed border-zinc-700' : 'bg-zinc-950/60 border-zinc-800'}`}
      data-voice-member={m.speaking ? 'speaking' : 'quiet'} data-voice-off-stream={m.offStream ? 'yes' : 'no'}
    >
      <div className="relative" style={{ opacity: m.offStream ? 0.45 : 1 }}>
        {m.pictures?.avatar ? (
          // The pixel avatar, talking as the overlay's will.
          <div className="w-16 h-16" style={{ opacity: m.deafened ? 0.5 : 1 }}><VoicePixel look={m.pictures.look} accent={accent} speaking={m.speaking && !m.muted} pixelAvatars={pixelAvatars} /></div>
        ) : m.pictures?.quiet || m.pictures?.talking ? (
          // Their own pictures, swapping as the overlay's will.
          <img src={pictureFor(m).all[pictureFor(m).now]} alt="" className="w-16 h-16 object-contain" style={{ opacity: m.deafened ? 0.5 : 1 }} />
        ) : (
          <img
            src={m.avatar} alt=""
            className="w-16 h-16 rounded-full object-cover"
            style={{
              boxShadow: m.speaking ? '0 0 0 3px #23a55a, 0 0 16px #23a55a88' : '0 0 0 3px transparent',
              // On at once with the word; off with a short fade, so a pause between words is not a blink.
              transition: m.speaking ? 'box-shadow 30ms linear' : 'box-shadow 180ms ease-out',
              opacity: m.deafened ? 0.5 : 1,
            }}
          />
        )}
        {(m.muted || m.deafened) && (
          <span className="absolute -bottom-1 -right-1 p-1 rounded-full bg-zinc-900 border border-zinc-700 text-rose-400">
            {m.deafened ? <HeadphoneOff size={11} /> : <MicOff size={11} />}
          </span>
        )}
        {(m.streaming || m.video) && (
          <span className="absolute -top-1 -right-1 p-1 rounded-full bg-zinc-900 border border-zinc-700 text-zinc-300"><Video size={11} /></span>
        )}
      </div>
      <div className="text-center min-w-0 max-w-full">
        <span className={`block text-xs font-bold truncate ${m.speaking ? 'text-white' : 'text-zinc-400'}`}>{m.name}</span>
        {/* The Discord name, when the stream shows another. */}
        {m.discordName && m.discordName !== m.name && <span className="block text-[9px] text-zinc-600 truncate">{m.discordName}</span>}
        {m.offStream && <span className="block text-[9px] font-black uppercase tracking-widest text-amber-400/80">{t.voiceOffStreamTag || 'Not on stream'}</span>}
      </div>
      <div className="flex gap-1">
        <button
          onClick={() => setPerson(m.id, discordNameOf(m), { offStream: !m.offStream })}
          title={m.offStream ? (t.voiceShowOnStream || 'Show them on stream again') : (t.voiceKeepOffStream || 'Keep them off stream')}
          className={`p-1 rounded-md border ${m.offStream ? 'border-amber-500/60 text-amber-400' : 'border-zinc-800 text-zinc-500 hover:text-zinc-200'}`}
          data-voice-off-stream-toggle
        >
          {m.offStream ? <EyeOff size={10} /> : <Eye size={10} />}
        </button>
        <button
          onClick={() => togglePin(m)}
          title={m.pinned ? (t.voiceUnpin || 'Unpin') : (t.voicePin || 'Pin — always first')}
          className={`p-1 rounded-md border ${m.pinned ? 'border-current-accent text-current-accent' : 'border-zinc-800 text-zinc-500 hover:text-zinc-200'}`}
        >
          {m.pinned ? <PinOff size={10} /> : <Pin size={10} />}
        </button>
        <button
          onClick={() => setEditing(editing === m.id ? null : m.id)}
          className={`flex items-center gap-1 px-2 py-0.5 rounded-md text-[9px] font-black uppercase tracking-widest border ${editing === m.id ? 'border-current-accent text-current-accent' : 'border-zinc-800 text-zinc-500 hover:text-zinc-200'}`}
        >
          <SlidersHorizontal size={10} /> {t.voicePersonEdit || 'On stream'}
        </button>
      </div>
    </div>
  );

  return (
    <div className="animate-fade-in space-y-6 pb-20">
      <div className="glass-panel rounded-3xl border border-zinc-800 p-6 space-y-4">
        <div className="flex items-center gap-3">
          <Headphones size={16} className="text-current-accent" />
          <span className="text-[11px] font-black uppercase tracking-widest text-zinc-300">{t.voiceNav || 'Voice call'}</span>
        </div>

        {!botConnected && (
          <p className="text-[11px] text-amber-400">{t.voiceNoBot || 'The Discord bot is not connected. Connect it on the Connections screen first.'}</p>
        )}

        {/* Which call: always one channel, or wherever one person is. */}
        <div className="space-y-2">
          <div className="flex gap-1 bg-zinc-900/60 p-0.5 rounded-lg border border-zinc-800 w-fit" data-voice-mode={mode}>
            {([['channel', Hash, t.voiceWhichChannel || 'A channel'], ['person', UserRound, t.voiceWhichPerson || 'Follow a person']] as const).map(([id, Icon, text]) => (
              <button
                key={id}
                onClick={() => { setMode(id); if (id === 'channel' && state.follow) setVoice({ follow: null }); }}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-[10px] font-black uppercase tracking-widest ${mode === id ? 'bg-current-accent text-white' : 'text-zinc-500 hover:text-zinc-300'}`}
              >
                <Icon size={12} /> {text}
              </button>
            ))}
          </div>
          {mode === 'channel' ? (
            <label className="block space-y-1">
              <span className={smallLabel}>{t.voiceChannel || 'Voice channel'}</span>
              <select value={state.chosenChannelId ?? state.channelId} onChange={(e) => setVoice({ channelId: e.target.value, follow: null })} className={select}>
                <option value="">{t.voiceChooseChannel || 'Choose a voice channel'}</option>
                {voiceChannels.map((c) => <option key={c.id} value={c.id}>🔊 {c.name}</option>)}
              </select>
            </label>
          ) : (
            <label className="block space-y-1">
              <span className={smallLabel}>{t.voiceFollowWho || 'Whose call to show'}</span>
              <select
                value={state.follow?.id || ''}
                onChange={(e) => {
                  const who = followable.find((p) => p.id === e.target.value);
                  setVoice({ follow: who ? { id: who.id, name: who.name } : null });
                }}
                className={select} data-voice-follow
              >
                <option value="">{t.voiceFollowChoose || 'Choose somebody — yourself, usually'}</option>
                {followable.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name}{p.channelId ? ` · 🔊 ${channelName(p.channelId) || '…'}` : ` · ${t.voicePinnedAway || 'not in a call'}`}
                  </option>
                ))}
              </select>
              <span className="block text-[10px] text-zinc-600 leading-relaxed">
                {t.voiceFollowHint || 'The overlay shows whichever voice channel they are in, and moves with them. Only people in a call right now are listed — join one to choose yourself.'}
              </span>
            </label>
          )}
        </div>

        <label className="flex items-start gap-3 cursor-pointer">
          <input
            type="checkbox" className="mt-0.5 accent-current-accent"
            checked={state.listen} disabled={!state.chosenChannelId && !state.follow?.id && !state.channelId}
            onChange={(e) => setVoice({ listen: e.target.checked })}
          />
          <span className="space-y-1">
            <span className="block text-xs font-bold text-zinc-200">{t.voiceListen || 'Light up whoever is talking'}</span>
            <span className="block text-[10px] text-zinc-500 leading-relaxed">
              {t.voiceListenHint || 'The bot joins the call, muted, so it can tell who is talking. Everyone in the call will see it there. It only watches whose voice is arriving — nothing is recorded, decoded or kept.'}
            </span>
            <span className="block text-[10px] text-zinc-500 leading-relaxed">
              {t.voiceLeaveHint || 'It only stays while somebody is in the call: once everybody has been gone for two minutes it leaves, and it joins again when somebody comes back.'}
            </span>
          </span>
        </label>

        <div className="flex items-center gap-2 text-[10px]" data-voice-status={state.status}>
          <Radio size={12} className={state.status === 'listening' ? 'text-emerald-400' : state.status === 'error' ? 'text-rose-400' : 'text-zinc-500'} />
          <span className={state.status === 'error' ? 'text-rose-400' : 'text-zinc-400'}>{statusText}</span>
        </div>
      </div>

      <div className="glass-panel rounded-3xl border border-zinc-800 p-6">
        {!state.channelId ? (
          <p className="text-[10px] text-zinc-600 uppercase tracking-widest">
            {state.follow?.id
              ? String(t.voiceFollowNotInCall || '{name} is not in a call right now.').split('{name}').join(state.follow.name)
              : (t.voiceNoChannel || 'Choose a channel to see who is in it.')}
          </p>
        ) : members.length === 0 ? (
          <p className="text-[10px] text-zinc-600 uppercase tracking-widest">{t.voiceEmpty || 'Nobody is in that channel right now.'}</p>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4" data-voice-members>
            {members.map(card)}
          </div>
        )}

        {pinned.length > 0 && (
          <div className="mt-5 space-y-2" data-voice-pinned>
            <span className={smallLabel}>{t.voicePinnedTitle || 'Always first, in this order'}</span>
            <div ref={pinOrder.listRef} className="relative space-y-1.5 max-w-md">
              {pinOrder.line}
              {pinned.map((p, i) => {
                const here = members.some((m) => m.id === p.id);
                return (
                  <div key={p.id} {...pinOrder.row(p.id)} className={`flex items-center gap-2 px-2.5 py-1.5 rounded-xl border border-zinc-800 bg-zinc-950/60 ${pinOrder.held === p.id ? 'opacity-40' : ''}`}>
                    {pinned.length > 1 && <DragGrip grip={pinOrder.grip(p.id)} title={t.voicePinnedDrag || 'Drag to change who comes first'} size={12} className="-ml-1.5 -my-1" />}
                    <span className="w-4 text-[10px] font-black text-zinc-500 tabular-nums">{i + 1}</span>
                    <span className={`flex-1 min-w-0 truncate text-[11px] font-bold ${here ? 'text-zinc-200' : 'text-zinc-500'}`}>{persons[p.id]?.streamName || p.name || p.id}</span>
                    {!here && <span className="text-[9px] text-zinc-600">{t.voicePinnedAway || 'not in the call'}</span>}
                    <button onClick={() => movePin(i, -1)} disabled={i === 0} className="p-1 text-zinc-500 hover:text-zinc-200 disabled:opacity-30"><ArrowUp size={11} /></button>
                    <button onClick={() => movePin(i, 1)} disabled={i === pinned.length - 1} className="p-1 text-zinc-500 hover:text-zinc-200 disabled:opacity-30"><ArrowDown size={11} /></button>
                    <button onClick={() => togglePin(p)} title={t.voiceUnpin || 'Unpin'} className="p-1 text-zinc-500 hover:text-rose-400"><PinOff size={11} /></button>
                  </div>
                );
              })}
            </div>
            <p className="text-[10px] text-zinc-600">{t.voicePinnedHint || 'Pinned people come first on every voice layer, in this order. Everybody else follows in the order they joined.'}</p>
          </div>
        )}

        {/* Kept off stream while away too, and let back on from here. */}
        {keptAway.length > 0 && (
          <div className="mt-5 space-y-2" data-voice-kept-away>
            <span className={smallLabel}>{t.voiceKeptOffTitle || 'Kept off stream, not in the call'}</span>
            <div className="flex flex-wrap gap-2">
              {keptAway.map(([id, p]) => (
                <button
                  key={id} onClick={() => setPerson(id, p.name, { offStream: false })}
                  title={t.voiceShowOnStream || 'Show them on stream again'}
                  className="flex items-center gap-1.5 px-2.5 py-1 rounded-xl border border-amber-500/40 bg-zinc-950/60 text-[11px] font-bold text-amber-300 hover:border-amber-400"
                >
                  <EyeOff size={11} /> {p.streamName || p.name || id}
                </button>
              ))}
            </div>
          </div>
        )}

        {elsewhere.length > 0 && (
          <div className="mt-5 space-y-2">
            <span className={smallLabel}>{t.voicePicturesElsewhere || 'With pictures, not in the call'}</span>
            <div className="flex flex-wrap gap-2">
              {elsewhere.map(([id, entry]) => (
                <button
                  key={id} onClick={() => setEditing(editing === id ? null : id)}
                  className={`flex items-center gap-2 pl-1 pr-2.5 py-1 rounded-xl border bg-zinc-950/60 ${editing === id ? 'border-current-accent' : 'border-zinc-800 hover:border-zinc-600'}`}
                  data-voice-elsewhere={id}
                >
                  {/* Somebody drawn as the pixel avatar has no picture to show here, so it shows the avatar. */}
                  {entry.avatar
                    ? <span className="w-7 h-7 block"><VoicePixel look={entry.look} accent={accent} pixelAvatars={pixelAvatars} /></span>
                    : <StillImg src={entry.quiet || entry.talking || entry.muted} width={28} alt="" className="w-7 h-7 object-contain" />}
                  <span className="text-[11px] font-bold text-zinc-300">{persons[id]?.streamName || entry.name || id}</span>
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Anybody in the server, set up before they join: their pictures, look and name on stream. */}
        {listServerMembers && (
          <div className="mt-5 space-y-2" data-voice-server>
            <span className={smallLabel}>{t.voiceServerTitle || 'Set somebody up before they join'}</span>
            {serverError ? (
              <p className="text-[10px] text-rose-400">{String(t.voiceServerFailed || 'Could not list the server\'s members: {why}').split('{why}').join(serverError)}</p>
            ) : !botConnected ? (
              <p className="text-[10px] text-zinc-600">{t.voiceServerNoBot || 'The server\'s members are listed once the Discord bot is connected.'}</p>
            ) : server === null ? (
              <p className="text-[10px] text-zinc-600">{t.voiceServerLoading || 'Listing the server\'s members…'}</p>
            ) : (
              <>
                <input
                  type="search" value={serverQuery} onChange={(e) => setServerQuery(e.target.value)}
                  placeholder={String(t.voiceServerSearch || 'Search {count} members by name').split('{count}').join(String(server.length))}
                  className="w-full max-w-xs bg-zinc-900 border border-zinc-800 rounded-lg px-3 py-1.5 text-xs text-zinc-200 outline-none focus:border-current-accent"
                  data-voice-server-search
                />
                {serverFound.length === 0 ? (
                  <p className="text-[10px] text-zinc-600">{t.voiceServerNone || 'Nobody in the server by that name.'}</p>
                ) : (
                  <div className="flex flex-wrap gap-2 max-h-64 overflow-y-auto pr-1">
                    {serverFound.slice(0, SERVER_SHOWN).map((p) => (
                      <button
                        key={p.id} onClick={() => setEditing(editing === p.id ? null : p.id)}
                        className={`flex items-center gap-2 pl-1 pr-2.5 py-1 rounded-xl border bg-zinc-950/60 ${editing === p.id ? 'border-current-accent' : 'border-zinc-800 hover:border-zinc-600'}`}
                        data-voice-server-member={p.id}
                      >
                        <img src={p.avatar} alt="" className="w-6 h-6 rounded-full object-cover" />
                        <span className="text-[11px] font-bold text-zinc-300">{persons[p.id]?.streamName || p.name}</span>
                        {/* Set up already, or here now: so a list of everybody still says who is ready. */}
                        {pictures[p.id] && <span className="text-[8px] font-black uppercase tracking-widest text-current-accent">{t.voiceServerSetUp || 'Set up'}</span>}
                        {inCall.has(p.id) && <span className="text-[8px] font-black uppercase tracking-widest text-emerald-400">{t.voiceServerInCall || 'In the call'}</span>}
                      </button>
                    ))}
                  </div>
                )}
                {serverFound.length > SERVER_SHOWN && (
                  <p className="text-[10px] text-zinc-600">{String(t.voiceServerMore || '{count} more — search to find them.').split('{count}').join(String(serverFound.length - SERVER_SHOWN))}</p>
                )}
              </>
            )}
          </div>
        )}

        {editingWho && (
          <div className="mt-5">
            <VoicePicturesEditor
              // Each person's editor starts afresh: a preview left talking, or a picture being chosen, is not carried to the next.
              key={editingWho.id}
              person={{ id: editingWho.id, name: discordNameOf(editingWho as any) }}
              pictures={pictures[editingWho.id]}
              onChange={(entry) => savePictures(editingWho.id, entry)}
              accent={accent}
              streamName={persons[editingWho.id]?.streamName || ''}
              onStreamName={(name) => setPerson(editingWho.id, discordNameOf(editingWho as any), { streamName: name })}
              onClose={() => setEditing(null)}
              listAssets={listAssets}
              uploadAsset={uploadAsset}
              pixelAvatars={pixelAvatars}
              t={t}
            />
          </div>
        )}
      </div>
    </div>
  );
};
