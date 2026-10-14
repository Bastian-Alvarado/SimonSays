/**
 * @license
 * SPDX-License-Identifier: Apache-2.0 AND LicenseRef-Commons-Clause-1.0
 *
 * Moderating Twitch chat from the dock and the Chat dock screen (2.0.0):
 *
 *   MessageModMenu  on a Twitch message: delete it, time its sender out,
 *                   ban or unban them
 *   ChatModes       slow mode, emote-only, followers-only, subscribers-only
 *   AutomodQueue    what AutoMod is holding back, to let through or not
 *
 * All of it goes to the server as C2S.TWITCH_MOD (server/engine/twitch-mod.js),
 * which acts as whoever pressed: a moderator with their own Twitch sign-in,
 * so Twitch's own mod log names them, or the channel's login otherwise.
 * Never offered for the broadcaster's own messages, which Twitch would refuse.
 */
import React, { useEffect, useRef, useState } from 'react';
import { Shield, Trash2, Clock, Ban, Undo2, Check, X, ShieldAlert } from 'lucide-react';
import { fill, refusalWords } from '../words';

export type ModAsk = (payload: any) => Promise<any>;

/** How long a timeout from the menu lasts, in seconds. */
const TIMEOUTS = [60, 600, 3600];
const span = (s: number, t: any) => (s < 3600 ? fill(t.modMinutes || '{n} min', { n: Math.round(s / 60) }) : fill(t.modHours || '{n} h', { n: Math.round(s / 3600) }));

/** A message's moderation button and its menu. Only for Twitch messages from somebody the channel can moderate. */
export const MessageModMenu = ({ chat, ask, t }: { chat: any; ask: ModAsk; t: any }) => {
  const [open, setOpen] = useState(false);
  const [said, setSaid] = useState('');
  const box = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!open) return undefined;
    const away = (e: MouseEvent) => { if (box.current && !box.current.contains(e.target as Node)) setOpen(false); };
    document.addEventListener('mousedown', away);
    return () => document.removeEventListener('mousedown', away);
  }, [open]);
  if (chat?.platform !== 'twitch' || !chat.userId || chat.isBroadcaster) return null;

  const run = async (payload: any, done: string, confirmText?: string) => {
    if (confirmText && !window.confirm(confirmText)) return;
    setSaid('');
    try {
      await ask({ ...payload, userId: chat.userId, login: chat.user });
      setSaid(done);
      setTimeout(() => { setOpen(false); setSaid(''); }, 900);
    } catch (err: any) {
      setSaid(refusalWords(t, err) || String(err?.message || err));
    }
  };
  const item = 'w-full flex items-center gap-2 px-3 py-1.5 text-left text-[11px] font-bold text-zinc-300 hover:bg-white/5';

  return (
    <div ref={box} className="relative shrink-0" data-mod-menu>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        title={t.modMenu || 'Moderate'}
        className={`p-1 rounded-md text-zinc-500 hover:text-white hover:bg-white/10 ${open ? 'opacity-100' : 'opacity-0 group-hover:opacity-100 focus:opacity-100 [@media(hover:none)]:opacity-60'}`}
        data-mod-menu-open
      >
        <Shield size={12} />
      </button>
      {open && (
        <div className="absolute right-0 top-full mt-1 z-50 w-48 rounded-xl border border-zinc-800 bg-zinc-950 shadow-2xl overflow-hidden py-1">
          <p className="px-3 py-1 text-[9px] font-black uppercase tracking-widest text-zinc-500 truncate">{chat.user}</p>
          {chat.id && (
            <button type="button" className={item} onClick={() => run({ op: 'delete', msgId: chat.id }, t.modDeleted || 'Deleted')} data-mod-delete>
              <Trash2 size={12} /> {t.modDelete || 'Delete this message'}
            </button>
          )}
          {TIMEOUTS.map((s) => (
            <button key={s} type="button" className={item} onClick={() => run({ op: 'timeout', seconds: s }, t.modTimedOut || 'Timed out')} data-mod-timeout={s}>
              <Clock size={12} /> {fill(t.modTimeoutFor || 'Time out for {span}', { span: span(s, t) })}
            </button>
          ))}
          <button type="button" className={`${item} text-rose-400`} onClick={() => run({ op: 'ban' }, t.modBanned || 'Banned', fill(t.modBanConfirm || 'Ban {name} from the channel?', { name: chat.user }))} data-mod-ban>
            <Ban size={12} /> {t.modBan || 'Ban'}
          </button>
          <button type="button" className={item} onClick={() => run({ op: 'unban' }, t.modUnbanned || 'Unbanned')} data-mod-unban>
            <Undo2 size={12} /> {t.modUnban || 'Unban or end the timeout'}
          </button>
          {said && <p className="px-3 py-1.5 text-[10px] text-zinc-400 border-t border-zinc-800" data-mod-said>{said}</p>}
        </div>
      )}
    </div>
  );
};

/** The chat's modes, switched from the dock. Read from Twitch when opened, as Twitch's own screens change them too. */
export const ChatModes = ({ ask, t, inline = false }: { ask: ModAsk; t: any; inline?: boolean }) => {
  const [open, setOpen] = useState(inline);
  const [modes, setModes] = useState<any>(null);
  const [said, setSaid] = useState('');
  const box = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!open) return undefined;
    setSaid('');
    ask({ op: 'get-chat-settings' }).then(setModes).catch((err) => setSaid(refusalWords(t, err) || String(err?.message || err)));
    if (inline) return undefined;
    const away = (e: MouseEvent) => { if (box.current && !box.current.contains(e.target as Node)) setOpen(false); };
    document.addEventListener('mousedown', away);
    return () => document.removeEventListener('mousedown', away);
  }, [open, ask, t, inline]);

  const set = async (patch: any) => {
    setSaid('');
    try { setModes(await ask({ op: 'chat-settings', settings: patch })); } catch (err: any) { setSaid(refusalWords(t, err) || String(err?.message || err)); }
  };
  const row = (label: string, on: boolean, flip: () => void, key: string) => (
    <button type="button" onClick={flip} className="w-full flex items-center justify-between gap-3 px-3 py-2 text-left text-[11px] font-bold text-zinc-300 hover:bg-white/5" data-chat-mode={key} data-on={on ? 'on' : 'off'}>
      <span>{label}</span>
      <span className={`w-8 h-4 rounded-full relative transition-colors ${on ? 'bg-current-accent' : 'bg-zinc-700'}`}>
        <span className={`absolute top-0.5 w-3 h-3 rounded-full bg-white transition-all ${on ? 'left-4' : 'left-0.5'}`} />
      </span>
    </button>
  );

  return (
    <div ref={box} className="relative" data-chat-modes={inline ? 'inline' : 'button'}>
      {!inline && (
        <button type="button" onClick={() => setOpen((v) => !v)} title={t.chatModes || 'Chat modes'} className="p-1.5 rounded-lg text-zinc-500 hover:text-white hover:bg-white/10" data-chat-modes-open>
          <Shield size={13} />
        </button>
      )}
      {open && (
        <div className={inline ? 'py-1' : 'absolute right-0 bottom-full mb-2 z-50 w-60 rounded-xl border border-zinc-800 bg-zinc-950 shadow-2xl overflow-hidden py-1'}>
          <p className="px-3 py-1 text-[9px] font-black uppercase tracking-widest text-zinc-500">{t.chatModes || 'Chat modes'}</p>
          {!modes ? (
            <p className="px-3 py-2 text-[11px] text-zinc-500">{said || t.modsLoading || 'Loading…'}</p>
          ) : (
            <>
              {row(fill(t.chatModeSlow || 'Slow mode ({n} s)', { n: modes.slowSeconds || 30 }), Boolean(modes.slow), () => set({ slow: !modes.slow, slowSeconds: modes.slowSeconds || 30 }), 'slow')}
              {row(t.chatModeEmote || 'Emotes only', Boolean(modes.emoteOnly), () => set({ emoteOnly: !modes.emoteOnly }), 'emote')}
              {row(t.chatModeFollowers || 'Followers only', Boolean(modes.followersOnly), () => set({ followersOnly: !modes.followersOnly }), 'followers')}
              {row(t.chatModeSubs || 'Subscribers only', Boolean(modes.subscribersOnly), () => set({ subscribersOnly: !modes.subscribersOnly }), 'subscribers')}
            </>
          )}
          {modes && said && <p className="px-3 py-1.5 text-[10px] text-zinc-400 border-t border-zinc-800">{said}</p>}
        </div>
      )}
    </div>
  );
};

/** What AutoMod is holding back, newest first, to let through or not. Nothing on screen while it holds nothing. */
export const AutomodQueue = ({ held, ask, t }: { held: any[]; ask: ModAsk; t: any }) => {
  const [said, setSaid] = useState('');
  if (!held?.length) return null;
  const decide = async (h: any, allow: boolean) => {
    setSaid('');
    try { await ask({ op: 'automod', msgId: h.msgId, userId: h.userId, login: h.login, allow }); } catch (err: any) { setSaid(refusalWords(t, err) || String(err?.message || err)); }
  };
  return (
    <div className="rounded-2xl border border-amber-500/30 bg-amber-500/5 px-3 py-2 space-y-1.5" data-automod>
      <p className="flex items-center gap-1.5 text-[9px] font-black uppercase tracking-widest text-amber-300">
        <ShieldAlert size={11} /> {fill(held.length === 1 ? (t.automodOne || 'AutoMod is holding 1 message') : (t.automodMany || 'AutoMod is holding {n} messages'), { n: held.length })}
      </p>
      {held.slice(0, 5).map((h) => (
        <div key={h.msgId} className="flex items-start gap-2 text-[11px]" data-automod-held={h.msgId}>
          <p className="flex-1 min-w-0 text-zinc-300 break-words"><span className="font-bold text-zinc-100">{h.name || h.login}:</span> {h.text}{h.reason ? <span className="text-zinc-500"> · {h.reason}</span> : null}</p>
          <button type="button" onClick={() => decide(h, true)} title={t.automodAllow || 'Let it through'} className="p-1 rounded-md text-emerald-400 hover:bg-emerald-500/10" data-automod-allow><Check size={13} /></button>
          <button type="button" onClick={() => decide(h, false)} title={t.automodDeny || 'Keep it out'} className="p-1 rounded-md text-rose-400 hover:bg-rose-500/10" data-automod-deny><X size={13} /></button>
        </div>
      ))}
      {said && <p className="text-[10px] text-zinc-400">{said}</p>}
    </div>
  );
};
