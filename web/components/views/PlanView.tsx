/**
 * @license
 * SPDX-License-Identifier: Apache-2.0 AND LicenseRef-Commons-Clause-1.0
 *
 * What the stream is working through.
 *
 * Deliberately not a timetable. Games Done Quick's schedule is times and
 * estimates because a marathon runs to a clock; this is a list of what is
 * coming with a mark against where the stream has got to, because on a
 * one-person stream saying "at 9" and then not doing it at 9 is worse than not
 * saying at all.
 *
 * Moving the mark is one press, and it marks everything above as done: moving
 * on always means the last thing finished, so making that two actions would
 * only be two chances to forget one.
 *
 * A step can also say what the stream becomes when it starts — a Twitch
 * category, a title, a YouTube category — and keeps how long it took, which
 * only this screen and the dock show. A plan for a night that repeats can be
 * saved and loaded again. The server does all of that; see
 * server/engine/plan.js.
 */
import React, { useEffect, useState } from 'react';
import {
  Play, Plus, Trash2, RotateCcw, ListOrdered, Check, ChevronUp, ChevronDown,
  SlidersHorizontal, Search, X, Save, FolderOpen, Gamepad2, Type, Youtube, History, CreditCard,
} from 'lucide-react';
import { Button } from '../Button';
import { CommittedInput } from '../CommittedInput';
import { YOUTUBE_CATEGORIES, youtubeCategoryName } from '../../../shared/youtube-categories.js';
import { formatLength, liveLength, isCounting } from '../../../shared/plan-format.js';
import { landedAt } from '../../../shared/list-order.js';
import { useDragOrder, DragGrip } from '../../hooks/useDragOrder';
import { refusalWords } from '../../words';
import { withDiscordText } from '../../discordEmoji';

export interface PlanItem {
  id: string;
  text: string;
  note?: string;
  done?: boolean;
  /** What the stream becomes when this step starts. Each is optional. */
  game?: { id: string; name: string };
  title?: string;
  youtubeCategory?: string;
  /** What the run card reads while this step is on. */
  card?: { title?: string; platform?: string; year?: string; category?: string; estimate?: string };
  /** When it became current and when it was ticked off. Written by the server. */
  startedAt?: number;
  doneAt?: number;
  /** Time on while live, kept (server/engine/plan.js); counting from `liveFrom` while it is on and live. */
  liveMs?: number;
  liveFrom?: number;
  liveBase?: number;
}
export interface PlanAnswer { enabled: boolean; trigger: string; text: string }
export interface Plan {
  items: PlanItem[];
  currentId?: string;
  showDone?: boolean;
  markers?: boolean;
  answer?: PlanAnswer;
  recapToDiscord?: boolean;
  recap?: { at: number; items: { text: string; ms: number }[] } | null;
}
export interface SavedPlan { id: string; name: string; items: PlanItem[]; savedAt?: number }

interface Props {
  plan: Plan;
  setPlan: (next: Plan) => void;
  /** Move the mark to one item, marking everything before it done. */
  planGoto: (id: string) => void;
  saved: SavedPlan[];
  savedControl: (payload: { op: 'save' | 'load' | 'delete'; name?: string; id?: string }) => Promise<any>;
  searchCategories: (query: string) => Promise<any[] | null>;
  language: string;
  t: any;
}

/** Put values into a sentence: "{time} so far". */
const fill = (text: string, vars: Record<string, string>) =>
  Object.entries(vars).reduce((out, [k, v]) => out.split(`{${k}}`).join(v), String(text));

/*
  Controls a mouse finds on hover. A phone has no hover, so a finger could
  never find them at all — reordering and removing were impossible there. On
  a screen that cannot hover they are simply always shown.
*/
const HOVER_ONLY = '[@media(hover:hover)]:opacity-0 [@media(hover:hover)]:group-hover:opacity-100 [@media(hover:hover)]:group-focus-within:opacity-100';

const label = 'text-[10px] font-black uppercase tracking-widest text-zinc-500';
const field = 'w-full bg-zinc-900 border border-zinc-800 rounded-lg px-3 py-2 text-xs text-zinc-200 outline-none focus:border-current-accent';

/** A setting that is on or off, in the look the rest of the app uses. */
const Toggle = ({ on, onClick, text, hint }: { on: boolean; onClick: () => void; text: string; hint?: string }) => (
  <div className="space-y-2">
    <button
      onClick={onClick}
      className={`w-full px-4 py-3 rounded-xl text-[10px] font-black border transition-all uppercase tracking-widest flex items-center justify-between gap-3 text-left ${
        on ? 'bg-current-accent/10 border-current-accent text-current-accent' : 'bg-zinc-900 border-zinc-800 text-zinc-500'
      }`}
    >
      <span>{text}</span>
      {on && <Check size={14} className="shrink-0" />}
    </button>
    {hint && <p className="text-[10px] text-zinc-600 leading-relaxed px-1">{hint}</p>}
  </div>
);

/**
 * What the stream becomes when this step starts.
 *
 * The category is searched and picked rather than typed, because Twitch
 * looks a typed name up and takes whatever comes first — "Among Us" and
 * "Among Us VR" are one guess apart.
 */
const StepAsks = ({ item, onChange, searchCategories, language, t }: {
  item: PlanItem;
  onChange: (patch: Partial<PlanItem>) => void;
  searchCategories: Props['searchCategories'];
  language: string;
  t: any;
}) => {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<any[]>([]);
  const [busy, setBusy] = useState(false);
  // A year that is not one is said out loud and not sent, as on the Game screen.
  const [badYear, setBadYear] = useState('');
  const card = item.card || {};
  const setCard = (patch: Record<string, string>) => onChange({ card: { ...card, ...patch } });
  const setCardYear = (typed: string) => {
    const year = typed.trim();
    if (year && !/^[0-9]{4}$/.test(year)) { setBadYear(year); return; }
    setBadYear('');
    setCard({ year });
  };
  const search = async () => {
    const q = query.trim();
    if (!q) return;
    setBusy(true);
    const found = await searchCategories(q);
    setResults(Array.isArray(found) ? found : []);
    setBusy(false);
  };

  return (
    <div className="mt-2 ml-9 p-3 rounded-xl bg-zinc-950/60 border border-zinc-800 space-y-3" data-plan-asks={item.id}>
      <div className="space-y-1">
        <div className={label}>{t.planWhenStarts || 'When this starts'}</div>
        <p className="text-[10px] text-zinc-600 leading-relaxed">
          {t.planWhenStartsHint || 'Moving the mark here switches the stream to these. Anything left empty stays as it is.'}
        </p>
      </div>

      <div className="space-y-1 relative">
        <div className={label}>{t.planCategory || 'Twitch category'}</div>
        {item.game ? (
          <div className="flex items-center gap-2 text-xs text-zinc-200 bg-zinc-900 border border-zinc-800 rounded-lg px-3 py-2">
            <Gamepad2 size={13} className="text-current-accent shrink-0" />
            <span className="flex-1 truncate">{item.game.name}</span>
            <button onClick={() => onChange({ game: undefined })} title={t.planClear || 'Clear'} className="text-zinc-500 hover:text-white">
              <X size={13} />
            </button>
          </div>
        ) : (
          <div className="flex gap-2">
            <input
              type="text"
              value={query}
              placeholder={t.planCategorySearch || 'Search a game or category…'}
              onChange={(e) => setQuery(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter') search(); }}
              className={field}
            />
            <button
              onClick={search}
              disabled={busy || !query.trim()}
              className="px-3 rounded-lg border border-zinc-800 bg-zinc-900 text-zinc-400 hover:text-white disabled:opacity-40"
            >
              <Search size={13} />
            </button>
          </div>
        )}
        {results.length > 0 && !item.game && (
          <div className="absolute top-full left-0 w-full mt-1 bg-zinc-900 border border-zinc-800 rounded-xl shadow-xl z-20 max-h-52 overflow-y-auto">
            {results.map((g) => (
              <button
                key={g.id}
                onClick={() => { onChange({ game: { id: String(g.id), name: g.name } }); setResults([]); setQuery(''); }}
                className="w-full text-left px-3 py-2 text-xs text-zinc-200 hover:bg-zinc-800 flex items-center gap-2"
              >
                {g.box_art_url && (
                  <img src={String(g.box_art_url).replace('{width}', '40').replace('{height}', '52')} className="w-5 h-7 object-cover rounded" alt="" />
                )}
                <span className="truncate">{g.name}</span>
              </button>
            ))}
          </div>
        )}
      </div>

      <div className="space-y-1">
        <div className={label}>{t.planTitle || 'Stream title, on Twitch and YouTube'}</div>
        <CommittedInput
          type="text"
          value={item.title || ''}
          placeholder={t.planTitleHint || 'Leave empty to keep the title'}
          onCommit={(next) => onChange({ title: next || undefined })}
          className={field}
        />
      </div>

      <div className="space-y-1">
        <div className={label}>{t.planYoutubeCategory || 'YouTube category'}</div>
        <select
          value={item.youtubeCategory || ''}
          onChange={(e) => onChange({ youtubeCategory: e.target.value || undefined })}
          className={field}
        >
          <option value="">{t.planKeep || 'Don’t change'}</option>
          {YOUTUBE_CATEGORIES.map((c) => (
            <option key={c.id} value={c.id}>{language === 'es' ? c.es : c.en}</option>
          ))}
        </select>
      </div>

      {/*
        The run card while this step is on. The Twitch category fills in the
        title by itself; the rest is what only somebody who knows the game can
        say, which is why it belongs to the step rather than to the moment.
      */}
      <div className="space-y-2 pt-3 border-t border-zinc-800/70" data-plan-card={item.id}>
        <div className={label}>{t.planCard || 'Run card'}</div>
        <p className="text-[10px] text-zinc-600 leading-relaxed">
          {t.planCardHint || 'What the run card says while this step is on: the title (the Twitch category if left empty), platform, year, category and estimate. Leave it all empty and the card follows the Twitch category as usual.'}
        </p>
        <div className="grid grid-cols-2 gap-2">
          <label className="col-span-2 space-y-1">
            <span className={label}>{t.runTitle || 'Title'}</span>
            <CommittedInput type="text" value={card.title || ''} placeholder={item.game?.name || 'Dark Souls'} onCommit={(v) => setCard({ title: v })} className={field} />
          </label>
          <label className="space-y-1">
            <span className={label}>{t.runPlatform || 'Platform'}</span>
            <CommittedInput type="text" value={card.platform || ''} placeholder="NES" onCommit={(v) => setCard({ platform: v })} className={field} />
          </label>
          <label className="space-y-1">
            <span className={label}>{t.runYear || 'Year'}</span>
            <CommittedInput type="text" value={card.year || ''} placeholder="1988" onCommit={setCardYear} className={`${field} ${badYear ? 'border-rose-500/70' : ''}`} />
          </label>
          <label className="space-y-1">
            <span className={label}>{t.runCategory || 'Category'}</span>
            <CommittedInput type="text" value={card.category || ''} placeholder="Any%" onCommit={(v) => setCard({ category: v })} className={field} />
          </label>
          <label className="space-y-1">
            <span className={label}>{t.runEstimate || 'Estimate'}</span>
            <CommittedInput type="text" value={card.estimate || ''} placeholder="30:00" onCommit={(v) => setCard({ estimate: v })} className={field} />
          </label>
        </div>
        {badYear && (
          <p role="alert" className="text-[10px] font-bold text-rose-400 leading-snug">
            {String(t.runYearInvalid || '“{typed}” is not a year, so it was not saved. Four digits, like 1996.').split('{typed}').join(badYear)}
          </p>
        )}
      </div>
    </div>
  );
};

export const PlanView = ({ plan, setPlan, planGoto, saved, savedControl, searchCategories, language, t }: Props) => {
  const items = plan?.items || [];
  const answer: PlanAnswer = { enabled: true, trigger: '!plan', text: '', ...(plan?.answer || {}) };
  const [typed, setTyped] = useState('');
  const [open, setOpen] = useState<string | null>(null);
  const [removed, setRemoved] = useState<{ item: PlanItem; index: number } | null>(null);
  const [saveName, setSaveName] = useState('');
  const [savedError, setSavedError] = useState('');

  // A running step's time moves on screen; half a minute is enough for minutes.
  const [now, setNow] = useState(Date.now());
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 30000);
    return () => clearInterval(id);
  }, []);

  // An undo is offered for long enough to notice the mistake, and then goes.
  useEffect(() => {
    if (!removed) return undefined;
    const id = setTimeout(() => setRemoved(null), 8000);
    return () => clearTimeout(id);
  }, [removed]);

  const save = (next: Partial<Plan>) => setPlan({ ...plan, items, ...next });
  const add = () => {
    const text = typed.trim();
    if (!text) return;
    save({ items: [...items, { id: Math.random().toString(36).slice(2, 11), text }] });
    setTyped('');
  };
  const edit = (id: string, patch: Partial<PlanItem>) =>
    save({ items: items.map((i) => (i.id === id ? { ...i, ...patch } : i)) });
  const remove = (id: string) => {
    const index = items.findIndex((i) => i.id === id);
    if (index < 0) return;
    setRemoved({ item: items[index], index });
    save({ items: items.filter((i) => i.id !== id) });
  };
  const undo = () => {
    if (!removed) return;
    const next = [...items];
    next.splice(Math.min(removed.index, next.length), 0, removed.item);
    save({ items: next });
    setRemoved(null);
  };
  const moveTo = (from: number, to: number) => {
    if (from === to || from < 0 || to < 0 || from >= items.length || to >= items.length) return;
    const next = [...items];
    const [moving] = next.splice(from, 1);
    next.splice(to, 0, moving);
    save({ items: next });
  };
  // Dragged by its grip — with a finger as well as a mouse — or moved a step at a time by the arrows.
  const stepOrder = useDragOrder(({ from, gap }) => moveTo(from, landedAt(from, gap)));

  /*
    Anything to go back from. A finished plan has nothing current — the mark
    has moved past the last step — so asking only about the current step hid
    the way back at exactly the moment it was wanted.
  */
  const started = Boolean(plan?.currentId) || items.some((i) => i.done);

  const clock = (at: number) => new Date(at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  /*
    How long a step has been on, counted only while live: between streams it
    waits, and a step carried on into the next stream carries on from its
    time. A step from before that was counted goes by its clock times.
  */
  const took = (item: PlanItem) => {
    if (!item.startedAt) return '';
    const kept = liveLength(item, now);
    if (item.id === plan?.currentId) {
      if (kept === null) return fill(t.planRunningFor || '{time} so far', { time: formatLength(now - item.startedAt) });
      if (isCounting(item)) return fill(t.planRunningFor || '{time} so far', { time: formatLength(kept) });
      return kept > 0
        ? fill(t.planPausedFor || '{time} so far · paused until you go live', { time: formatLength(kept) })
        : (t.planWaitingLive || 'Counts once you go live');
    }
    if (item.done && item.doneAt) return kept === null ? formatLength(item.doneAt - item.startedAt) : kept > 0 ? formatLength(kept) : '';
    return '';
  };

  const saveAs = async () => {
    setSavedError('');
    try {
      await savedControl({ op: 'save', name: saveName.trim() });
      setSaveName('');
    } catch (err: any) {
      setSavedError(refusalWords(t, err));
    }
  };
  const load = async (entry: SavedPlan) => {
    if (items.length && !window.confirm(fill(t.planLoadConfirm || 'Replace tonight’s plan with “{name}”?', { name: entry.name }))) return;
    setSavedError('');
    try { await savedControl({ op: 'load', id: entry.id }); } catch (err: any) { setSavedError(refusalWords(t, err)); }
  };
  const forget = async (entry: SavedPlan) => {
    if (!window.confirm(fill(t.planForgetConfirm || 'Forget the saved plan “{name}”?', { name: entry.name }))) return;
    try { await savedControl({ op: 'delete', id: entry.id }); } catch (err: any) { setSavedError(refusalWords(t, err)); }
  };

  const recap = plan?.recap?.items?.length ? plan.recap : null;

  return (
    <div className="animate-fade-in space-y-6 pb-20 max-w-3xl">
      <div className="glass-panel rounded-3xl border border-zinc-800 p-6 space-y-5">
        <div className="flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <ListOrdered size={18} className="text-current-accent" />
            <span className="text-[11px] font-black uppercase tracking-widest text-zinc-300">
              {items.length === 0
                ? (t.planEmpty || 'Nothing planned yet')
                : `${items.length} ${t.planThings || 'things'}`}
            </span>
          </div>
          {started && (
            <Button
              variant="secondary"
              size="sm"
              icon={<RotateCcw size={14} />}
              onClick={() => save({ currentId: '', items: items.map((i) => ({ ...i, done: false })) })}
            >
              {t.planReset || 'Back to the start'}
            </Button>
          )}
        </div>

        <div ref={stepOrder.listRef} className={`relative space-y-2 ${stepOrder.held ? 'select-none' : ''}`}>
          {stepOrder.line}
          {items.map((item, index) => {
            const isNow = item.id === plan?.currentId;
            const time = took(item);
            const hasAsks = Boolean(item.game || item.title || item.youtubeCategory || item.card);
            const cardLine = item.card ? [item.card.title, item.card.platform, item.card.year, item.card.category, item.card.estimate].filter(Boolean).join(' · ') : '';
            return (
              <div
                key={item.id}
                data-plan-row={item.id}
                {...stepOrder.row(item.id)}
                className={`group rounded-xl border px-2 py-1.5 transition-all ${
                  isNow ? 'border-current-accent bg-current-accent/5' : 'border-transparent hover:border-zinc-800'
                } ${stepOrder.held === item.id ? 'opacity-40' : ''}`}
              >
                <div className="flex items-center gap-2">
                  <DragGrip grip={stepOrder.grip(item.id)} title={t.planDrag || 'Drag to reorder'} className="-ml-2 -my-1" />

                  {/* One press: this is what we are on now, everything above is done. */}
                  <button
                    onClick={() => planGoto(item.id)}
                    title={t.planGoHere || 'We are on this now'}
                    className={`w-7 h-7 shrink-0 rounded-lg border flex items-center justify-center transition-all ${
                      isNow
                        ? 'bg-current-accent border-current-accent text-white'
                        : item.done
                          ? 'bg-zinc-900 border-zinc-800 text-zinc-600'
                          : 'bg-zinc-900 border-zinc-700 text-zinc-500 hover:border-zinc-500'
                    }`}
                  >
                    {item.done && !isNow ? <Check size={14} /> : <Play size={13} />}
                  </button>

                  <div className="flex-1 min-w-0">
                    <CommittedInput
                      type="text"
                      value={item.text}
                      onCommit={(next) => edit(item.id, { text: next })}
                      className={`w-full bg-transparent border-none outline-none text-sm py-0.5 ${
                        item.done && !isNow ? 'text-zinc-600 line-through' : 'text-zinc-200'
                      }`}
                    />
                    <CommittedInput
                      type="text"
                      value={item.note || ''}
                      placeholder={t.planNoteHint || 'a note, if it needs one'}
                      onCommit={(next) => edit(item.id, { note: next })}
                      className="w-full bg-transparent border-none outline-none text-[11px] text-zinc-500 py-0.5"
                    />
                    {(hasAsks || time) && (
                      <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-[10px] text-zinc-500 py-0.5">
                        {time && (
                          <span className={isNow ? 'text-current-accent font-bold' : ''} title={item.startedAt ? fill(t.planStartedAt || 'Started at {clock}', { clock: clock(item.startedAt) }) : undefined}>
                            {time}
                          </span>
                        )}
                        {item.game && <span className="flex items-center gap-1"><Gamepad2 size={11} /> {item.game.name}</span>}
                        {item.title && <span className="flex items-center gap-1 min-w-0"><Type size={11} /> <span className="truncate max-w-[14rem]">{item.title}</span></span>}
                        {item.youtubeCategory && <span className="flex items-center gap-1"><Youtube size={11} /> {youtubeCategoryName(item.youtubeCategory, language === 'es' ? 'es' : 'en')}</span>}
                        {cardLine && <span className="flex items-center gap-1 min-w-0"><CreditCard size={11} /> <span className="truncate max-w-[16rem]">{cardLine}</span></span>}
                      </div>
                    )}
                  </div>

                  <div className={`flex items-center transition-opacity ${HOVER_ONLY}`}>
                    <button
                      onClick={() => setOpen(open === item.id ? null : item.id)}
                      title={t.planWhenStarts || 'When this starts'}
                      className={`p-1.5 ${open === item.id || hasAsks ? 'text-current-accent' : 'text-zinc-600 hover:text-zinc-300'}`}
                    >
                      <SlidersHorizontal size={14} />
                    </button>
                    <button onClick={() => moveTo(index, index - 1)} disabled={index === 0} title={t.planMoveUp || 'Move up'} className="p-1 text-zinc-600 hover:text-zinc-300 disabled:opacity-25"><ChevronUp size={14} /></button>
                    <button onClick={() => moveTo(index, index + 1)} disabled={index === items.length - 1} title={t.planMoveDown || 'Move down'} className="p-1 text-zinc-600 hover:text-zinc-300 disabled:opacity-25"><ChevronDown size={14} /></button>
                    <button onClick={() => remove(item.id)} title={t.planRemove || 'Remove'} className="p-1.5 text-zinc-600 hover:text-rose-500"><Trash2 size={14} /></button>
                  </div>
                </div>

                {open === item.id && (
                  <StepAsks
                    item={item}
                    onChange={(patch) => edit(item.id, patch)}
                    searchCategories={searchCategories}
                    language={language}
                    t={t}
                  />
                )}
              </div>
            );
          })}
        </div>

        {removed && (
          <div className="flex items-center justify-between gap-3 rounded-xl border border-zinc-800 bg-zinc-900/80 px-4 py-2 text-xs text-zinc-300" data-plan-undo>
            <span className="truncate">{fill(t.planRemoved || 'Removed “{text}”', { text: removed.item.text })}</span>
            <button onClick={undo} className="shrink-0 text-[10px] font-black uppercase tracking-widest text-current-accent hover:brightness-125">
              {t.planUndo || 'Undo'}
            </button>
          </div>
        )}

        <div className="flex gap-2">
          <input
            type="text"
            value={typed}
            placeholder={t.planAddHint || 'Elden Ring, chat and questions, ranked…'}
            onChange={(e) => setTyped(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter') add(); }}
            className="flex-1 bg-zinc-900 border border-zinc-800 rounded-xl px-4 py-2.5 text-sm text-zinc-200 outline-none focus:border-current-accent"
          />
          <Button icon={<Plus size={16} />} onClick={add} disabled={!typed.trim()}>
            {t.add || 'Add'}
          </Button>
        </div>
      </div>

      {recap && (
        <div className="glass-panel rounded-3xl border border-zinc-800 p-6 space-y-3" data-plan-recap>
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <History size={16} className="text-current-accent" />
              <span className="text-[11px] font-black uppercase tracking-widest text-zinc-300">{t.planRecap || 'Last stream'}</span>
            </div>
            <span className="text-[10px] text-zinc-500">{new Date(recap.at).toLocaleDateString()}</span>
          </div>
          <p className="text-[10px] text-zinc-600">{t.planRecapHint || 'How long each step took. Only you see this.'}</p>
          <div className="space-y-1">
            {recap.items.map((r, n) => (
              <div key={n} className="flex items-center justify-between gap-3 text-xs">
                <span className="truncate text-zinc-300">{withDiscordText(r.text)}</span>
                <span className="shrink-0 font-mono text-zinc-500">{formatLength(r.ms)}</span>
              </div>
            ))}
            <div className="flex items-center justify-between gap-3 text-xs pt-1 border-t border-zinc-800">
              <span className="font-black uppercase tracking-widest text-[10px] text-zinc-500">{t.planRecapTotal || 'Total'}</span>
              <span className="shrink-0 font-mono text-zinc-300">{formatLength(recap.items.reduce((sum, r) => sum + r.ms, 0))}</span>
            </div>
          </div>
        </div>
      )}

      <div className="glass-panel rounded-3xl border border-zinc-800 p-6 space-y-4">
        <div className={label}>{t.planSettings || 'While streaming'}</div>
        <Toggle
          on={plan?.showDone !== false}
          onClick={() => save({ showDone: plan?.showDone === false })}
          text={t.planShowDone || 'Keep finished things on screen, crossed out'}
          hint={t.planShowDoneHint || 'Applies where the whole list is shown, and to the one crossed-off line an overlay keeps above what is next. Someone arriving late can see what they missed, which is half the reason to put a plan on screen at all.'}
        />
        <Toggle
          on={plan?.markers !== false}
          onClick={() => save({ markers: plan?.markers === false })}
          text={t.planMarkers || 'A stream marker at each step'}
          hint={t.planMarkersHint || 'Named after the step, so the VOD has chapters. Only while live.'}
        />
        <Toggle
          on={answer.enabled}
          onClick={() => save({ answer: { ...answer, enabled: !answer.enabled } })}
          text={`${t.planAnswer || 'Answer in chat'} · ${answer.trigger}`}
          hint={t.planAnswerHint}
        />
        {answer.enabled && (
          <div className="grid grid-cols-[8rem_1fr] gap-2 pl-1">
            <div className="space-y-1">
              <div className={label}>{t.planAnswerTrigger || 'Command'}</div>
              <CommittedInput type="text" value={answer.trigger} onCommit={(next) => save({ answer: { ...answer, trigger: next } })} className={field} />
            </div>
            <div className="space-y-1">
              <div className={label}>{t.planAnswerText || 'Reply'}</div>
              <CommittedInput type="text" value={answer.text} onCommit={(next) => save({ answer: { ...answer, text: next } })} className={field} />
            </div>
          </div>
        )}
        <Toggle
          on={plan?.recapToDiscord === true}
          onClick={() => save({ recapToDiscord: plan?.recapToDiscord !== true })}
          text={t.planRecapDiscord || 'Post a recap in Discord when the stream ends'}
          hint={t.planRecapDiscordHint || 'In the Go live channel: each step and how long it took.'}
        />
      </div>

      <div className="glass-panel rounded-3xl border border-zinc-800 p-6 space-y-4" data-plan-saved>
        <div className="flex items-center gap-2">
          <FolderOpen size={16} className="text-current-accent" />
          <span className="text-[11px] font-black uppercase tracking-widest text-zinc-300">{t.planSavedTitle || 'Saved plans'}</span>
        </div>
        <p className="text-[10px] text-zinc-600 leading-relaxed">
          {t.planSavedHint || 'Save tonight’s plan to load it again on a night like it. Loading one replaces the plan and starts it from the top.'}
        </p>
        <div className="flex gap-2">
          <input
            type="text"
            value={saveName}
            maxLength={60}
            placeholder={t.planSaveName || 'Name this plan…'}
            onChange={(e) => setSaveName(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter' && saveName.trim() && items.length) saveAs(); }}
            className={field}
          />
          <Button icon={<Save size={14} />} size="sm" onClick={saveAs} disabled={!saveName.trim() || !items.length}>
            {t.planSave || 'Save'}
          </Button>
        </div>
        {savedError && <p role="alert" className="text-[10px] font-bold text-red-400">{savedError}</p>}
        {saved.length > 0 && (
          <div className="space-y-1.5">
            {saved.map((entry) => (
              <div key={entry.id} className="flex items-center gap-2 rounded-xl border border-zinc-800 bg-zinc-900/60 px-3 py-2">
                <div className="flex-1 min-w-0">
                  <div className="text-xs text-zinc-200 truncate">{entry.name}</div>
                  <div className="text-[10px] text-zinc-500">{entry.items.length} {t.planSteps || 'steps'}</div>
                </div>
                <button onClick={() => load(entry)} className="px-3 py-1.5 rounded-lg text-[10px] font-black uppercase tracking-widest bg-current-accent/10 border border-current-accent text-current-accent hover:bg-current-accent/20">
                  {t.planLoad || 'Load'}
                </button>
                <button onClick={() => forget(entry)} title={t.planForget || 'Forget'} className="p-1.5 text-zinc-600 hover:text-rose-500">
                  <Trash2 size={14} />
                </button>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};
