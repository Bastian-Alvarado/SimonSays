/**
 * @license
 * SPDX-License-Identifier: Apache-2.0 AND LicenseRef-Commons-Clause-1.0
 *
 * The poll: set one up, open it, watch the votes come in, close it.
 *
 * Chat votes from every platform the app reads — a number, an answer, or
 * "!vote 2" — so this is not Twitch's poll with the other chats left out.
 * One poll at a time.
 *
 * What is typed here is the next poll, never the one on screen: the server
 * keeps the two apart (server/engine/polls.js), so the next one can be set up
 * while a result is still up, or while a poll is still running, without
 * touching what viewers see. It is sent as it is committed, so a reload does
 * not lose a poll half set up, and a poll opened from chat shows up here.
 *
 * Below the poll: what happens around it — what the bot says, how long a
 * result stays up, the chat command — and the last few results, to look back
 * at and run again.
 */
import React, { useEffect, useRef, useState } from 'react';
import { BarChart3, Plus, Trash2, Play, Square, RotateCcw, Timer, Users, Check, Settings2, History, CornerUpLeft } from 'lucide-react';
import { Button } from '../Button';
import { CommittedInput } from '../CommittedInput';
import { MAX_OPTIONS, MIN_OPTIONS, MAX_QUESTION, MAX_OPTION, RESULT_SECONDS, DEFAULT_POLL_SETTINGS, cleanOptions, percentOf } from '../../../shared/polls.js';
import { PLATFORMS } from '../../../shared/platforms.js';
import { PollState, pollTimeLeft } from '../PollLayer';
import { formatRemaining } from '../Countdown';

export interface PollSettings {
  resultSeconds: number;
  announceOpen: boolean;
  announceClose: boolean;
  hideVotes: boolean;
  command: { enabled: boolean; trigger: string };
}
export interface PastPoll {
  id: string; question: string; options: string[]; counts: number[]; total: number; leaders: number[];
  byPlatform?: Record<string, number>; closedAt?: number;
}

interface Props {
  poll?: PollState & { draft?: { question: string; options: string[] }; openedAt?: number | null };
  settings?: PollSettings;
  history?: PastPoll[];
  control: (op: string, value?: any) => void;
  players?: { items?: { name: string; state: string }[] };
  language: string;
  t: any;
}

const DURATIONS = [0, 30, 60, 120, 180, 300, 600];

const input = 'w-full bg-zinc-950 border border-zinc-800 rounded-xl px-4 py-2 text-xs text-white outline-none focus:border-current-accent disabled:opacity-50';
const label = 'text-[9px] font-black uppercase tracking-widest text-zinc-500';

/** A platform as the rest of the app names it, in its colour. */
const PlatformChip = ({ platform, n }: { platform: string; n: number }) => {
  const known = (PLATFORMS as any)[platform];
  return (
    <span
      className="px-2 py-0.5 rounded-full bg-zinc-900 border text-[10px] font-bold"
      style={{ color: known?.colour || '#a1a1aa', borderColor: `${known?.colour || '#3f3f46'}55` }}
      data-poll-platform={platform}
    >
      {known?.name || platform} · {n}
    </span>
  );
};

/** A setting that is on or off, in the look the rest of the app uses. */
const Toggle = ({ on, onClick, text, hint }: { on: boolean; onClick: () => void; text: string; hint?: string }) => (
  <div className="space-y-1.5">
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

export const PollsView = ({ poll, settings, history = [], control, players, language, t }: Props) => {
  const mode = poll?.mode || 'idle';
  const open = mode === 'open';
  const draft = poll?.draft || { question: poll?.question || '', options: poll?.options || [] };
  const s = settings || DEFAULT_POLL_SETTINGS;

  const [question, setQuestion] = useState(draft.question || '');
  const [options, setOptions] = useState<string[]>(draft.options?.length ? draft.options : ['', '']);

  /*
    The server's copy wins whenever it changes underneath — a poll opened
    from chat, a past poll brought back, or set up on another screen. Keyed on
    what it says, so the echo of this screen's own save does not reset the
    cursor.
  */
  const serverKey = JSON.stringify([draft.question, draft.options]);
  const lastServerKey = useRef(serverKey);
  useEffect(() => {
    if (serverKey === lastServerKey.current) return;
    lastServerKey.current = serverKey;
    // Our own save coming back cleaned — blank rows dropped — is not news.
    if (question.trim() === (draft.question || '') && JSON.stringify(cleanOptions(options)) === JSON.stringify(draft.options || [])) return;
    setQuestion(draft.question || '');
    setOptions(draft.options?.length ? draft.options : ['', '']);
  }, [serverKey]);

  // Enter on the last answer makes a new one and puts the cursor in it.
  const answerRefs = useRef<(HTMLInputElement | null)[]>([]);
  const [focusAnswer, setFocusAnswer] = useState<number | null>(null);
  useEffect(() => {
    if (focusAnswer === null) return;
    answerRefs.current[focusAnswer]?.focus();
    setFocusAnswer(null);
  }, [focusAnswer, options.length]);

  // Ticking only while there is a clock to watch.
  const [, tick] = useState(0);
  useEffect(() => {
    if (!open || !poll?.endsAt) return undefined;
    const id = setInterval(() => tick((n) => n + 1), 500);
    return () => clearInterval(id);
  }, [open, poll?.endsAt]);

  const saveDraft = (next: { question?: string; options?: string[]; durationMs?: number; rules?: any }) => control('setDraft', next);
  const setSettings = (patch: Partial<PollSettings>) => control('settings', patch);

  const clean = cleanOptions(options);
  const ready = Boolean(question.trim()) && clean.length >= MIN_OPTIONS;
  const rules = { numbers: true, words: true, change: true, ...(poll?.rules || {}) };
  const counts = poll?.counts || [];
  const total = poll?.total || 0;
  const leaders = new Set(poll?.leaders || []);
  const left = pollTimeLeft(poll);
  const stillIn = (players?.items || []).filter((p) => p.state === 'in').map((p) => p.name);
  // "Open again" only when what is set up is what just ran.
  const sameAsLast = question.trim() === (poll?.question || '') && JSON.stringify(clean) === JSON.stringify(poll?.options || []);

  const setOption = (i: number, text: string) => setOptions(options.map((o, j) => (j === i ? text : o)));
  const commitOptions = (next = options) => saveDraft({ options: next });
  const addAnswer = () => {
    if (options.length >= MAX_OPTIONS) return;
    setOptions([...options, '']);
    setFocusAnswer(options.length);
  };

  const status = open
    ? `${t.pollOpen || 'Open'}${left !== null ? ` · ${formatRemaining(left)}` : ''}`
    : mode === 'closed' ? (t.pollClosedLabel || 'Poll closed') : (t.pollReady || 'Not running');
  const when = (at?: number) => (at ? new Date(at).toLocaleString(language === 'es' ? 'es' : 'en', { weekday: 'short', hour: '2-digit', minute: '2-digit' }) : '');
  const votesWord = (n: number) => `${n} ${n === 1 ? (t.pollVote || 'vote') : (t.pollVotes || 'votes')}`;

  return (
    <div className="animate-fade-in space-y-6 pb-20">
      <div className="glass-panel rounded-3xl border border-zinc-800 p-6 space-y-4">
        <div className="flex flex-wrap items-center gap-3">
          <BarChart3 size={16} className="text-current-accent" />
          <span className="text-[11px] font-black uppercase tracking-widest text-zinc-300">{t.pollsNav || 'Polls'}</span>
          <span
            className={`px-2 py-0.5 rounded-full text-[9px] font-black uppercase tracking-widest ${
              open ? 'bg-emerald-500/15 text-emerald-400' : mode === 'closed' ? 'bg-amber-500/15 text-amber-400' : 'bg-zinc-800 text-zinc-500'
            }`}
            data-poll-status={mode}
          >
            {status}
          </span>
          <div className="ml-auto flex flex-wrap gap-2">
            {!open && (
              <Button
                size="sm" icon={<Play size={14} />} disabled={!ready}
                onClick={() => control('open', { question, options: clean })}
              >
                {mode === 'closed' && sameAsLast ? (t.pollOpenAgain || 'Open again') : (t.pollOpenButton || 'Open poll')}
              </Button>
            )}
            {open && (
              <>
                <Button size="sm" variant="secondary" icon={<Timer size={14} />} onClick={() => control('add', 30000)}>+30s</Button>
                <Button size="sm" icon={<Square size={14} />} onClick={() => control('close')}>{t.pollCloseButton || 'Close now'}</Button>
              </>
            )}
            <Button size="sm" variant="secondary" icon={<RotateCcw size={14} />} disabled={mode === 'idle'} onClick={() => control('reset')}>
              {t.pollClear || 'Clear from screen'}
            </Button>
          </div>
        </div>

        {/* What is typed here is the next poll; the one running keeps its own. */}
        {mode !== 'idle' && (
          <p className="text-[10px] text-zinc-500 leading-relaxed" data-poll-draft-note>
            {t.pollDraftNote || 'Set up the next poll here — the one on screen keeps its question and answers until you open this one.'}
          </p>
        )}

        <input
          value={question}
          onChange={(e) => setQuestion(e.target.value)}
          onBlur={() => saveDraft({ question })}
          maxLength={MAX_QUESTION}
          placeholder={t.pollQuestionPlaceholder || 'The question — "Who is the impostor?"'}
          className={`${input} text-sm font-bold`}
        />

        <div className="space-y-2">
          {options.map((o, i) => (
            <div key={i} className="flex items-center gap-2">
              <span className="w-6 text-right text-[11px] font-black text-zinc-500 tabular-nums">{i + 1}</span>
              <input
                ref={(el) => { answerRefs.current[i] = el; }}
                value={o}
                onChange={(e) => setOption(i, e.target.value)}
                onBlur={() => commitOptions()}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && i === options.length - 1 && o.trim()) addAnswer();
                  else if (e.key === 'Enter') answerRefs.current[i + 1]?.focus();
                }}
                maxLength={MAX_OPTION}
                placeholder={`${t.pollAnswer || 'Answer'} ${i + 1}`}
                className={input}
                data-poll-answer={i}
              />
              <button
                onClick={() => { const next = options.filter((_, j) => j !== i); setOptions(next.length ? next : ['']); commitOptions(next); }}
                disabled={options.length <= MIN_OPTIONS}
                title={t.pollRemoveAnswer || 'Remove answer'}
                className="p-1.5 text-zinc-600 hover:text-rose-500 disabled:opacity-30 disabled:hover:text-zinc-600"
              >
                <Trash2 size={14} />
              </button>
            </div>
          ))}
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <Button size="sm" variant="secondary" icon={<Plus size={14} />} disabled={options.length >= MAX_OPTIONS} onClick={addAnswer}>
            {t.pollAddAnswer || 'Add answer'}
          </Button>
          {stillIn.length >= MIN_OPTIONS && (
            <Button
              size="sm" variant="secondary" icon={<Users size={14} />}
              onClick={() => { const next = stillIn.slice(0, MAX_OPTIONS); setOptions(next); commitOptions(next); }}
            >
              {t.pollFromPlayers || 'Answers from the players still in'}
            </Button>
          )}
          <label className="ml-auto flex items-center gap-2">
            <span className={label}>{t.pollDuration || 'Runs for'}</span>
            <select
              value={Math.round((poll?.durationMs ?? 60000) / 1000)}
              onChange={(e) => saveDraft({ durationMs: Number(e.target.value) * 1000 })}
              className="bg-zinc-950 border border-zinc-800 rounded-lg px-2 py-1 text-[11px] text-zinc-200 outline-none"
            >
              {DURATIONS.map((sec) => (
                <option key={sec} value={sec}>
                  {sec === 0 ? (t.pollNoLimit || 'Until I close it') : sec < 60 ? `${sec}s` : `${sec / 60} min`}
                </option>
              ))}
            </select>
          </label>
        </div>

        <div className="flex flex-wrap gap-x-5 gap-y-2 pt-1">
          {([
            ['numbers', t.pollRuleNumbers || 'A number on its own is a vote — "2"'],
            ['words', t.pollRuleWords || 'An answer on its own is a vote — "red"'],
            ['change', t.pollRuleChange || 'Viewers can change their vote'],
          ] as const).map(([key, text]) => (
            <label key={key} className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox" checked={rules[key] !== false}
                onChange={(e) => control('setDraft', { rules: { [key]: e.target.checked } })}
                className="accent-current-accent"
              />
              <span className="text-[10px] text-zinc-400">{text}</span>
            </label>
          ))}
        </div>
        <p className="text-[10px] text-zinc-600 leading-relaxed">
          {t.pollHowTo || 'Chat votes on every platform at once — Twitch, YouTube, TikTok and Discord. "!vote 2" or "!voto red" always counts; one vote per person on each platform. Add a Poll layer to a layout to show it on stream.'}
        </p>
      </div>

      {mode !== 'idle' && (
        <div className="glass-panel rounded-3xl border border-zinc-800 p-6 space-y-3" data-poll-results>
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-sm font-bold text-zinc-200 flex-1 min-w-0">{poll?.question}</span>
            <span className="text-[11px] font-black text-zinc-300 tabular-nums">{votesWord(total)}</span>
          </div>
          {(poll?.options || []).map((o, i) => {
            const n = counts[i] || 0;
            const pct = percentOf(n, total);
            const ahead = leaders.has(i);
            return (
              <div key={i} className={`relative overflow-hidden rounded-xl border ${ahead ? 'border-current-accent' : 'border-zinc-800'} bg-zinc-950/60`}>
                <div className="absolute inset-y-0 left-0 bg-current-accent transition-all duration-500" style={{ width: `${pct}%`, opacity: 0.25 }} />
                <div className="relative flex items-center gap-3 px-3 py-2">
                  <span className="w-5 text-[11px] font-black text-zinc-500 tabular-nums">{i + 1}</span>
                  <span className={`flex-1 min-w-0 truncate text-xs ${ahead ? 'font-black text-white' : 'font-bold text-zinc-300'}`}>{o}</span>
                  <span className="text-[11px] text-zinc-400 tabular-nums">{n}</span>
                  <span className="w-10 text-right text-[11px] font-black text-zinc-200 tabular-nums">{pct}%</span>
                </div>
              </div>
            );
          })}
          {Object.keys(poll?.byPlatform || {}).length > 0 && (
            <div className="flex flex-wrap gap-2 pt-1">
              {Object.entries(poll?.byPlatform || {}).map(([platform, n]) => <PlatformChip key={platform} platform={platform} n={n} />)}
            </div>
          )}
        </div>
      )}

      {/* What happens around a poll. */}
      <div className="glass-panel rounded-3xl border border-zinc-800 p-6 space-y-4" data-poll-settings>
        <div className="flex items-center gap-2">
          <Settings2 size={15} className="text-current-accent" />
          <span className="text-[11px] font-black uppercase tracking-widest text-zinc-300">{t.pollSettings || 'Around the poll'}</span>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <Toggle
            on={s.announceOpen} onClick={() => setSettings({ announceOpen: !s.announceOpen })}
            text={t.pollAnnounceOpen || 'The bot says when a poll opens'}
            hint={t.pollAnnounceOpenHint || 'The question, the numbered answers and how to vote, in Twitch chat.'}
          />
          <Toggle
            on={s.announceClose} onClick={() => setSettings({ announceClose: !s.announceClose })}
            text={t.pollAnnounceClose || 'The bot says who won'}
            hint={t.pollAnnounceCloseHint || 'The winner with its votes and percentage — or the tie — when the poll closes.'}
          />
          <Toggle
            on={s.hideVotes} onClick={() => setSettings({ hideVotes: !s.hideVotes })}
            text={t.pollHideVotes || 'Keep votes out of the chat on stream'}
            hint={t.pollHideVotesHint || 'Votes still count and still show in the dock; the chat viewers see just leaves them out.'}
          />
          <Toggle
            on={s.command.enabled} onClick={() => setSettings({ command: { ...s.command, enabled: !s.command.enabled } })}
            text={`${t.pollCommandToggle || 'Mods can open one from chat'} · ${s.command.trigger}`}
            hint={String(t.pollCommandHint || '{trigger} Question | answer | answer opens that poll, {trigger} alone opens the one set up here, and {trigger} cerrar closes it. A command of your own with the same word answers instead.').split('{trigger}').join(s.command.trigger)}
          />
        </div>
        <div className="flex flex-wrap items-end gap-4">
          <label className="space-y-1 block">
            <span className={label}>{t.pollResultStays || 'The result stays on screen'}</span>
            <select
              value={s.resultSeconds}
              onChange={(e) => setSettings({ resultSeconds: Number(e.target.value) })}
              className="block bg-zinc-950 border border-zinc-800 rounded-lg px-2 py-1.5 text-[11px] text-zinc-200 outline-none"
              data-poll-result-seconds
            >
              {RESULT_SECONDS.map((sec) => (
                <option key={sec} value={sec}>{sec === 0 ? (t.pollResultUntilCleared || 'Until I clear it') : `${sec}s`}</option>
              ))}
            </select>
          </label>
          {s.command.enabled && (
            <label className="space-y-1 block">
              <span className={label}>{t.pollCommandWord || 'Command'}</span>
              <CommittedInput
                key={s.command.trigger} type="text" value={s.command.trigger} maxLength={30}
                onCommit={(v: string) => setSettings({ command: { ...s.command, trigger: v } })}
                className="block w-40 bg-zinc-950 border border-zinc-800 rounded-lg px-2 py-1.5 text-[11px] text-zinc-200 outline-none focus:border-current-accent"
              />
            </label>
          )}
        </div>
      </div>

      {/* The last few results. */}
      {history.length > 0 && (
        <div className="glass-panel rounded-3xl border border-zinc-800 p-6 space-y-3" data-poll-history>
          <div className="flex items-center gap-2">
            <History size={15} className="text-current-accent" />
            <span className="text-[11px] font-black uppercase tracking-widest text-zinc-300 flex-1">{t.pollHistory || 'Past polls'}</span>
            <button
              onClick={() => { if (window.confirm(t.pollHistoryClearConfirm || 'Forget every past poll?')) control('history_clear'); }}
              className="text-[9px] font-black uppercase tracking-widest text-zinc-500 hover:text-zinc-200"
            >
              {t.pollHistoryClear || 'Forget all'}
            </button>
          </div>
          {history.map((h) => {
            const winners = (h.leaders || []).map((i) => h.options[i]);
            const top = h.leaders?.length ? h.counts[h.leaders[0]] : 0;
            return (
              <div key={h.id} className="flex items-start gap-3 rounded-xl border border-zinc-800 bg-zinc-900/40 p-3" data-poll-past={h.id}>
                <div className="flex-1 min-w-0 space-y-1">
                  <div className="flex items-center gap-2 min-w-0">
                    <span className="text-xs font-bold text-zinc-200 truncate">{h.question}</span>
                    <span className="shrink-0 text-[10px] font-mono text-zinc-600">{when(h.closedAt)}</span>
                  </div>
                  <div className="text-[11px] text-zinc-400">
                    {!h.total
                      ? (t.pollNoVotes || 'No votes')
                      : winners.length > 1
                        ? `${t.pollTie || 'Tie'}: ${winners.join(' / ')} · ${votesWord(top)} · ${votesWord(h.total)} ${t.pollInAll || 'in all'}`
                        : `${winners[0]} · ${votesWord(top)} (${percentOf(top, h.total)}%) · ${votesWord(h.total)} ${t.pollInAll || 'in all'}`}
                  </div>
                  {Object.keys(h.byPlatform || {}).length > 1 && (
                    <div className="flex flex-wrap gap-1.5 pt-0.5">
                      {Object.entries(h.byPlatform || {}).map(([platform, n]) => <PlatformChip key={platform} platform={platform} n={n} />)}
                    </div>
                  )}
                </div>
                <button
                  onClick={() => control('history_use', h.id)}
                  title={t.pollUseAgain || 'Use again'}
                  className="shrink-0 flex items-center gap-1 px-2 py-1.5 rounded-lg border border-zinc-800 bg-zinc-900 text-[9px] font-black uppercase tracking-widest text-zinc-400 hover:text-current-accent hover:border-current-accent"
                >
                  <CornerUpLeft size={12} /> {t.pollUseAgain || 'Use again'}
                </button>
                <button
                  onClick={() => control('history_delete', h.id)}
                  title={t.pollForget || 'Forget this one'}
                  className="shrink-0 p-1.5 text-zinc-600 hover:text-rose-500"
                >
                  <Trash2 size={13} />
                </button>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};
