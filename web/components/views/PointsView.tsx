/**
 * @license
 * SPDX-License-Identifier: Apache-2.0 AND LicenseRef-Commons-Clause-1.0
 *
 * Points: a currency apart from XP. What they are called, how they are
 * earned, the shop's rewards (each runs one of your actions), the shop's
 * message in Discord, and who has the most — with giving or taking by hand.
 *
 * Settings are a draft here until saved, as on Levels & XP: a typed number
 * is not a change to the shop until it is meant.
 */
import React, { useEffect, useState } from 'react';
import { Coins, Plus, Trash2, Save, Undo2, Send, Loader2, RefreshCw, ShoppingBag, AlertTriangle, CheckCircle2, Minus } from 'lucide-react';
import { useDragOrder, DragGrip } from '../../hooks/useDragOrder';
import { moveToGap } from '../../../shared/list-order.js';
import { textChannels } from '../DiscordPicks';
import { EmojiField } from '../EmojiField';
import { refusalWords, fill } from '../../words';

interface Item { id: string; name: string; emoji: string; cost: number; actionId: string; input: 'none' | 'optional' | 'required'; cooldownSec: number; perStream: number; liveOnly: boolean; enabled: boolean; description: string }
interface Settings {
  enabled: boolean; name: string; emoji: string;
  earn: Record<string, number>;
  words: { balance: string; shop: string; redeem: string; give: string };
  youtube: boolean; shop: Item[]; discord: { channelId: string; messageId: string };
}
interface Props {
  settings?: Settings;
  control: (op: string, payload?: Record<string, any>) => Promise<any>;
  actions: { id: string; name: string }[];
  channels: { id: string; name: string; type: number }[];
  emojis: any[];
  botConnected: boolean;
  t: any;
}

const box = 'w-full bg-zinc-950 border border-zinc-800 rounded-xl px-3 py-2 text-xs text-white outline-none focus:border-current-accent';
const tag = 'text-[9px] font-black uppercase tracking-widest text-zinc-500';
const smallButton = 'inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border border-zinc-800 bg-zinc-900 text-[10px] font-bold text-zinc-300 hover:text-white hover:border-zinc-600 disabled:opacity-40';
const EARN_FIELDS: [string, string, string][] = [
  ['message', 'pointsEarnMessage', 'Talking'],
  ['messageEverySec', 'pointsEarnEvery', '…at most every (s)'],
  ['stream', 'pointsEarnStream', 'Coming to a stream'],
  ['streakStep', 'pointsEarnStreak', '+ per stream in a row'],
  ['streakMax', 'pointsEarnStreakMax', 'Streak bonus at most'],
  ['follow', 'pointsEarnFollow', 'A follow'],
  ['sub', 'pointsEarnSub', 'A sub (each one gifted too)'],
  ['member', 'pointsEarnMember', 'A YouTube membership'],
  ['perHundredBits', 'pointsEarnBits', 'Each 100 bits'],
  ['perDiamond', 'pointsEarnDiamond', 'Each TikTok diamond'],
  ['superChat', 'pointsEarnSuperChat', 'A Super Chat'],
];
const newItem = (): Item => ({ id: `item-${Date.now().toString(36)}${Math.random().toString(36).slice(2, 5)}`, name: '', emoji: '', cost: 100, actionId: '', input: 'none', cooldownSec: 0, perStream: 0, liveOnly: true, enabled: true, description: '' });

export const PointsView = ({ settings, control, actions, channels, emojis, botConnected, t }: Props) => {
  const [draft, setDraft] = useState<Settings | null>(settings || null);
  const [dirty, setDirty] = useState(false);
  const [busy, setBusy] = useState('');
  const [result, setResult] = useState<{ ok: boolean; text: string } | null>(null);
  const [board, setBoard] = useState<{ richest: any[]; log: any[] }>({ richest: [], log: [] });
  const [amounts, setAmounts] = useState<Record<string, string>>({});
  useEffect(() => { if (!dirty && settings) setDraft(settings); }, [settings, dirty]);
  const loadBoard = () => control('board', { limit: 50 }).then((b) => setBoard(b || { richest: [], log: [] })).catch(() => {});
  useEffect(() => { loadBoard(); }, []);

  const change = (patch: Partial<Settings>) => { if (draft) { setDraft({ ...draft, ...patch }); setDirty(true); } };
  const setItems = (fn: (items: Item[]) => Item[]) => change({ shop: fn(draft?.shop || []) });
  const order = useDragOrder(({ from, gap }) => setItems((items) => moveToGap(items, from, gap)));
  const say = (ok: boolean, text: string) => setResult({ ok, text });

  const save = async () => {
    if (!draft) return;
    setBusy('save');
    try {
      await control('settings', { settings: draft });
      setDirty(false);
      say(true, t.pointsSaved || 'Saved.');
    } catch (err: any) { say(false, refusalWords(t, err) || String(err?.message || err)); }
    finally { setBusy(''); }
  };
  const postShop = async () => {
    setBusy('post');
    try {
      if (dirty) { await control('settings', { settings: draft }); setDirty(false); }
      const r = await control('post_shop', { channelId: draft?.discord.channelId });
      say(true, r?.done === 'updated' ? (t.pointsShopUpdated || 'The shop in Discord was updated.') : (t.pointsShopPosted || 'The shop was posted in Discord.'));
    } catch (err: any) { say(false, refusalWords(t, err) || String(err?.message || err)); }
    finally { setBusy(''); }
  };
  const give = async (uid: string, sign: 1 | -1) => {
    const n = Math.abs(Math.round(Number(amounts[uid] || 0)));
    if (!n) return;
    try {
      await control('give', { uid, amount: sign * n });
      setAmounts((a) => ({ ...a, [uid]: '' }));
      loadBoard();
    } catch (err: any) { say(false, refusalWords(t, err) || String(err?.message || err)); }
  };

  if (!draft) return <div className="text-xs text-zinc-500 p-8">{t.pointsLoading || 'Loading…'}</div>;
  const unit = `${draft.emoji ? `${draft.emoji} ` : ''}${draft.name}`;

  return (
    <div className="animate-fade-in space-y-6 pb-20" data-points>
      <div className="glass-panel rounded-3xl border border-zinc-800 p-6 space-y-5">
        <div className="flex items-center gap-3">
          <Coins size={16} className="text-current-accent" />
          <span className="text-[11px] font-black uppercase tracking-widest text-zinc-300 flex-1">{t.pointsNav || 'Points'}</span>
          <div onClick={() => change({ enabled: !draft.enabled })} className={`w-12 h-7 rounded-full p-1 cursor-pointer transition-colors ${draft.enabled ? 'bg-current-accent' : 'bg-zinc-700'}`} data-points-toggle>
            <div className={`w-5 h-5 bg-white rounded-full shadow-md transform transition-transform ${draft.enabled ? 'translate-x-5' : ''}`} />
          </div>
        </div>
        <p className="text-[11px] text-zinc-500 leading-relaxed">{t.pointsHint || 'A currency apart from XP: XP makes levels and only goes up; points are earned the same way and spent in the shop, on rewards that run one of your actions. One balance per person, whatever platforms they are on.'}</p>

        <div className="grid grid-cols-1 sm:grid-cols-[1fr_auto] gap-3 items-end">
          <label className="space-y-1 block"><span className={tag}>{t.pointsName || 'What they are called'}</span>
            <input value={draft.name} onChange={(e) => change({ name: e.target.value.slice(0, 24) })} className={box} data-points-name /></label>
          <div className="space-y-1"><span className={tag}>{t.pointsEmoji || 'Emoji'}</span>
            <div><EmojiField value={draft.emoji} onChange={(emoji) => change({ emoji })} customEmojis={emojis} t={t} /></div></div>
        </div>

        <div className="space-y-2">
          <span className={tag}>{t.pointsEarning || 'Earned for'}</span>
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-2" data-points-earn>
            {EARN_FIELDS.map(([key, word, fallback]) => (
              <label key={key} className="bg-zinc-950/50 border border-zinc-800 rounded-xl px-3 py-2 flex items-center gap-2">
                <span className="text-[10px] text-zinc-400 flex-1 leading-tight">{t[word] || fallback}</span>
                <input type="number" min={0} value={draft.earn[key] ?? 0} onChange={(e) => change({ earn: { ...draft.earn, [key]: Number(e.target.value) } })} className="w-16 bg-zinc-900 border border-zinc-800 rounded-lg px-2 py-1 text-[11px] text-white text-right" />
              </label>
            ))}
          </div>
        </div>

        <div className="space-y-2">
          <span className={tag}>{t.pointsWords || 'In chat'}</span>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
            {(['balance', 'shop', 'redeem', 'give'] as const).map((k) => (
              <label key={k} className="space-y-1 block">
                <span className="text-[10px] text-zinc-500">{{ balance: t.pointsWordBalance || 'Balance', shop: t.pointsWordShop || 'The shop', redeem: t.pointsWordRedeem || 'Buy', give: t.pointsWordGive || 'Give (mods)' }[k]}</span>
                <input value={draft.words[k]} onChange={(e) => change({ words: { ...draft.words, [k]: e.target.value } })} className={`${box} font-mono`} />
              </label>
            ))}
          </div>
          <label className="flex items-center gap-2 cursor-pointer">
            <input type="checkbox" checked={draft.youtube} onChange={(e) => change({ youtube: e.target.checked })} className="accent-current-accent" />
            <span className="text-[11px] text-zinc-400">{t.pointsYoutube || 'Answer on YouTube too (each answer uses some of YouTube\'s daily allowance)'}</span>
          </label>
          <p className="text-[10px] text-zinc-600">{fill(t.pointsChatHow || 'In any chat: {balance} for a balance, {shop} for the list, {redeem} 2 or {redeem} TTS hello to buy. Moderators: {give} @name 100.', { balance: draft.words.balance, shop: draft.words.shop, redeem: draft.words.redeem, give: draft.words.give })}</p>
        </div>
      </div>

      {/* The shop. */}
      <div className="glass-panel rounded-3xl border border-zinc-800 p-6 space-y-4" data-points-shop>
        <div className="flex items-center gap-3">
          <ShoppingBag size={16} className="text-current-accent" />
          <span className="text-[11px] font-black uppercase tracking-widest text-zinc-300 flex-1">{t.pointsShop || 'The shop'}</span>
          <button onClick={() => setItems((items) => [...items, newItem()])} disabled={draft.shop.length >= 24} className={smallButton} data-points-add><Plus size={11} /> {t.pointsAddItem || 'Add a reward'}</button>
        </div>
        {draft.shop.length === 0 && <p className="text-[11px] text-zinc-600 italic">{t.pointsNoItems || 'No rewards yet. Each reward runs one of your actions — make the action first (a sound, a TTS message, an overlay effect).'}</p>}
        <div ref={order.listRef} className="relative space-y-2">
          {order.line}
          {draft.shop.map((it, i) => {
            const set = (patch: Partial<Item>) => setItems((items) => items.map((x) => (x.id === it.id ? { ...x, ...patch } : x)));
            return (
              <div key={it.id} {...order.row(it.id)} className={`bg-zinc-950/50 border border-zinc-800 rounded-2xl p-3 space-y-2 ${order.held === it.id ? 'opacity-40' : ''} ${it.enabled ? '' : 'opacity-60'}`} data-points-item={it.id}>
                <div className="flex items-center gap-2 flex-wrap sm:flex-nowrap">
                  {draft.shop.length > 1 && <DragGrip grip={order.grip(it.id)} title={t.pointsDrag || 'Drag to change the order'} />}
                  <span className="text-[10px] font-black text-zinc-500 w-4">{i + 1}</span>
                  <EmojiField size="sm" value={it.emoji} onChange={(emoji) => set({ emoji })} customEmojis={emojis} t={t} />
                  <input value={it.name} onChange={(e) => set({ name: e.target.value.slice(0, 40) })} placeholder={t.pointsItemName || 'Name'} className={`${box} sm:w-48`} />
                  <label className="flex items-center gap-1.5 shrink-0">
                    <input type="number" min={1} value={it.cost} onChange={(e) => set({ cost: Number(e.target.value) })} className="w-20 bg-zinc-900 border border-zinc-800 rounded-lg px-2 py-1.5 text-[11px] text-white text-right" />
                    <span className="text-[10px] text-zinc-500">{draft.emoji || draft.name}</span>
                  </label>
                  <select value={it.actionId} onChange={(e) => set({ actionId: e.target.value })} className={`${box} ${!it.actionId ? 'border-amber-500/40' : ''}`}>
                    <option value="">{t.pointsPickAction || 'Runs which action?'}</option>
                    {actions.map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}
                  </select>
                  <button onClick={() => setItems((items) => items.filter((x) => x.id !== it.id))} className="p-1.5 text-zinc-500 hover:text-rose-400"><Trash2 size={12} /></button>
                </div>
                <div className="flex items-center gap-3 flex-wrap pl-6">
                  <select value={it.input} onChange={(e) => set({ input: e.target.value as Item['input'] })} className="bg-zinc-900 border border-zinc-800 rounded-lg px-2 py-1 text-[10px] text-zinc-300">
                    <option value="none">{t.pointsInputNone || 'No words'}</option>
                    <option value="optional">{t.pointsInputOptional || 'Words if they like'}</option>
                    <option value="required">{t.pointsInputRequired || 'Words needed'}</option>
                  </select>
                  <label className="flex items-center gap-1 text-[10px] text-zinc-500">{t.pointsCooldown || 'Wait between (s)'}
                    <input type="number" min={0} value={it.cooldownSec} onChange={(e) => set({ cooldownSec: Number(e.target.value) })} className="w-16 bg-zinc-900 border border-zinc-800 rounded px-1.5 py-0.5 text-[10px] text-white text-right" /></label>
                  <label className="flex items-center gap-1 text-[10px] text-zinc-500">{t.pointsPerStream || 'Per stream (0: any)'}
                    <input type="number" min={0} value={it.perStream} onChange={(e) => set({ perStream: Number(e.target.value) })} className="w-14 bg-zinc-900 border border-zinc-800 rounded px-1.5 py-0.5 text-[10px] text-white text-right" /></label>
                  <label className="flex items-center gap-1 cursor-pointer text-[10px] text-zinc-400"><input type="checkbox" checked={it.liveOnly} onChange={(e) => set({ liveOnly: e.target.checked })} className="accent-current-accent" /> {t.pointsLiveOnly || 'Only while live'}</label>
                  <label className="flex items-center gap-1 cursor-pointer text-[10px] text-zinc-400"><input type="checkbox" checked={it.enabled} onChange={(e) => set({ enabled: e.target.checked })} className="accent-current-accent" /> {t.pointsItemOn || 'On'}</label>
                </div>
                <input value={it.description} onChange={(e) => set({ description: e.target.value.slice(0, 200) })} placeholder={t.pointsItemDescription || 'A line about it (shown in Discord, and as the box\'s label when it asks for words)'} className={`${box} ml-6 w-[calc(100%-1.5rem)]`} />
              </div>
            );
          })}
        </div>

        <div className="flex items-center gap-2 flex-wrap pt-2 border-t border-zinc-800/60">
          <span className={tag}>{t.pointsDiscord || 'In Discord'}</span>
          <select value={draft.discord.channelId} onChange={(e) => change({ discord: { ...draft.discord, channelId: e.target.value } })} className="bg-zinc-950 border border-zinc-800 rounded-lg px-2 py-1.5 text-[11px] text-zinc-200 max-w-[220px]" data-points-channel>
            <option value="">{t.discordSendPickChannel || 'Choose a channel'}</option>
            {textChannels(channels).map((c) => <option key={c.id} value={c.id}>#{c.name}</option>)}
          </select>
          <button onClick={postShop} disabled={!!busy || !botConnected || !draft.discord.channelId} className={smallButton} data-points-post>
            {busy === 'post' ? <Loader2 size={11} className="animate-spin" /> : <Send size={11} />} {settings?.discord.messageId && settings.discord.channelId === draft.discord.channelId ? (t.pointsShopUpdate || 'Update the shop') : (t.pointsShopPost || 'Post the shop')}
          </button>
          <span className="text-[10px] text-zinc-600">{t.pointsDiscordHint || 'A button for each reward; one that asks for words opens a box for them.'}</span>
        </div>
      </div>

      <div className="flex items-center gap-2 justify-end sticky bottom-4 z-10">
        {result && <span className={`text-[11px] flex items-center gap-1 mr-auto ${result.ok ? 'text-emerald-400' : 'text-rose-400'}`} data-points-result>{result.ok ? <CheckCircle2 size={12} /> : <AlertTriangle size={12} />} {result.text}</span>}
        {dirty && <button onClick={() => { setDraft(settings || null); setDirty(false); }} className={smallButton}><Undo2 size={11} /> {t.pointsDiscard || 'Undo changes'}</button>}
        <button onClick={save} disabled={!dirty || !!busy} className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-current-accent text-white text-[11px] font-black disabled:opacity-40" data-points-save>
          {busy === 'save' ? <Loader2 size={12} className="animate-spin" /> : <Save size={12} />} {t.pointsSave || 'Save'}
        </button>
      </div>

      {/* Who has the most, and giving or taking by hand. */}
      <div className="glass-panel rounded-3xl border border-zinc-800 p-6 space-y-3" data-points-board>
        <div className="flex items-center gap-3">
          <Coins size={16} className="text-current-accent" />
          <span className="text-[11px] font-black uppercase tracking-widest text-zinc-300 flex-1">{t.pointsRichest || 'Who has the most'}</span>
          <button onClick={loadBoard} className={smallButton}><RefreshCw size={11} /></button>
        </div>
        {board.richest.length === 0 && <p className="text-[11px] text-zinc-600 italic">{t.pointsNobody || 'Nobody has points yet.'}</p>}
        <div className="divide-y divide-zinc-800/60">
          {board.richest.map((p, i) => (
            <div key={p.uid} className="flex items-center gap-3 py-2" data-points-person={p.uid}>
              <span className="text-[10px] font-mono text-zinc-600 w-6">#{i + 1}</span>
              {p.avatar ? <img src={p.avatar} alt="" className="w-6 h-6 rounded-full" /> : <div className="w-6 h-6 rounded-full bg-zinc-800" />}
              <span className="text-xs font-bold text-white flex-1 truncate">{p.name}</span>
              <span className="text-xs font-mono text-amber-300">{Number(p.points).toLocaleString()} {unit}</span>
              <input value={amounts[p.uid] || ''} onChange={(e) => setAmounts((a) => ({ ...a, [p.uid]: e.target.value.replace(/[^\d]/g, '') }))} placeholder="100" className="w-16 bg-zinc-900 border border-zinc-800 rounded px-1.5 py-1 text-[10px] text-white text-right" />
              <button onClick={() => give(p.uid, 1)} className="p-1 text-zinc-500 hover:text-emerald-400" title={t.pointsGive || 'Give'}><Plus size={12} /></button>
              <button onClick={() => give(p.uid, -1)} className="p-1 text-zinc-500 hover:text-rose-400" title={t.pointsTake || 'Take'}><Minus size={12} /></button>
            </div>
          ))}
        </div>
        {board.log.length > 0 && (
          <details className="pt-2">
            <summary className="text-[10px] text-zinc-500 cursor-pointer">{t.pointsLog || 'Recent changes'}</summary>
            <div className="mt-2 space-y-1 max-h-64 overflow-y-auto">
              {board.log.map((l, i) => (
                <div key={i} className="flex items-center gap-2 text-[10px]">
                  <span className="text-zinc-600 font-mono w-28 shrink-0">{new Date(l.at).toLocaleString()}</span>
                  <span className="text-zinc-300 truncate flex-1">{l.name}</span>
                  <span className={l.delta > 0 ? 'text-emerald-400' : 'text-rose-400'}>{l.delta > 0 ? '+' : ''}{l.delta}</span>
                  <span className="text-zinc-500 truncate w-32">{l.why}</span>
                </div>
              ))}
            </div>
          </details>
        )}
      </div>
    </div>
  );
};
