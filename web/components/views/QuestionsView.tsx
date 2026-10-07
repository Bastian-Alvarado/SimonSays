/**
 * @license
 * SPDX-License-Identifier: Apache-2.0 AND LicenseRef-Commons-Clause-1.0
 *
 * Moderating what viewers have asked.
 *
 * Two piles. What has come in and not been looked at, and what has been
 * approved and is ready to read out. Nothing reaches the screen from the first
 * pile — approving is the gate, and the server refuses to show anything that
 * has not been through it.
 *
 * Laid out for use during the segment rather than before it: the approved pile
 * is on the left where it is glanced at, one press puts a question on screen,
 * the same press on the one already up takes it down, and "Next question"
 * answers the one up and puts up the next. A question can be tidied before it
 * goes up, and added by hand. The rules — the built-in "!pregunta", and what
 * the end of a stream does to the queue — are at the bottom. The server side
 * is server/engine/questions.js.
 */
import React, { useState } from 'react';
import { Check, X, Play, Square, Trash2, MessageCircleQuestion, SkipForward, Pencil, Plus, Settings2 } from 'lucide-react';
import { Button } from '../Button';
import { CommittedInput } from '../CommittedInput';
import { PLATFORMS } from '../../../shared/platforms.js';
import { refusalWords } from '../../words';
import { withDiscordText } from '../../discordEmoji';

export interface Question { id: string; user: string; platform?: string; text: string; at?: number; status?: string }
export interface Questions { items: Question[]; showingId?: string }
export interface QuestionSettings {
  ask: { enabled: boolean; trigger: string; cooldownSeconds: number; reply: boolean; replyText: string };
  atStreamEnd: 'keep' | 'finished' | 'all';
}

interface Props {
  /** Discord channels whose messages are questions, and whether answers go back there (server/engine/discord-questions.js). */
  fromDiscord?: { channelIds: string[]; answer: boolean; mark: boolean };
  setFromDiscord?: (settings: Record<string, any>) => Promise<any>;
  channels?: { id: string; name: string; type: number }[];
  questions: Questions;
  settings?: QuestionSettings;
  setStatus: (id: string, status: string) => void;
  show: (id: string) => void;
  clear: (which?: string) => void;
  /** Add, edit, next, settings: awaited, so a refusal can be shown. */
  control: (payload: Record<string, any>) => Promise<any>;
  language: string;
  t: any;
}

const label = 'text-[10px] font-black uppercase tracking-widest text-zinc-500';
const field = 'w-full bg-zinc-900 border border-zinc-800 rounded-lg px-3 py-2 text-xs text-zinc-200 outline-none focus:border-current-accent';

/**
 * One question: who asked, where from and when, and what they asked — which
 * can be tidied before it goes up. A module-level component, so its own
 * "editing" state survives the screen re-rendering around it.
 */
const QuestionRow = ({ q, highlight, onEdit, language, t, children }: {
  q: Question; highlight?: boolean; onEdit?: (text: string) => void; language: string; t: any; children: React.ReactNode;
}) => {
  const [editing, setEditing] = useState(false);
  const platform = q.platform ? (PLATFORMS as any)[q.platform] : null;
  const when = q.at ? new Date(q.at).toLocaleTimeString(language === 'es' ? 'es' : 'en', { hour: '2-digit', minute: '2-digit' }) : '';
  return (
    <div
      className={`flex items-start gap-3 rounded-xl border p-3 transition-all ${
        highlight ? 'border-current-accent bg-current-accent/5' : 'border-zinc-800 bg-zinc-900/40'
      }`}
      data-question-row={q.id}
    >
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 min-w-0 text-[10px]">
          <span className="font-black uppercase tracking-widest text-current-accent truncate">{q.user || '—'}</span>
          <span className="shrink-0 font-bold" style={{ color: platform?.colour || '#71717a' }}>
            {platform?.name || (t.questionsByHand || 'added here')}
          </span>
          {when && <span className="shrink-0 font-mono text-zinc-600">{when}</span>}
        </div>
        {editing && onEdit ? (
          <CommittedInput
            as="textarea"
            value={q.text}
            autoFocus
            maxLength={280}
            onCommit={(next: string) => { if (next.trim()) onEdit(next); }}
            onBlur={() => setEditing(false)}
            // One line of text, however long: Enter finishes rather than breaking it.
            onKeyDown={(e: any) => { if (e.key === 'Enter') { e.preventDefault(); e.currentTarget.blur(); } }}
            className="w-full mt-1 bg-zinc-950/60 border border-current-accent rounded-lg px-2 py-1.5 text-sm text-zinc-200 outline-none resize-y min-h-[3.5rem]"
          />
        ) : (
          <div className="text-sm text-zinc-200 break-words mt-0.5">{withDiscordText(q.text, undefined, (q as any).names)}</div>
        )}
      </div>
      <div className="flex items-center gap-1 shrink-0">
        {onEdit && !editing && (
          <button onClick={() => setEditing(true)} title={t.questionsEdit || 'Edit'} className="w-8 h-8 rounded-lg border border-zinc-800 bg-zinc-900 text-zinc-500 hover:text-zinc-200 flex items-center justify-center">
            <Pencil size={12} />
          </button>
        )}
        {children}
      </div>
    </div>
  );
};

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

export const QuestionsView = ({ questions, settings, setStatus, show, clear, control, fromDiscord, setFromDiscord, channels = [], language, t }: Props) => {
  const items = questions?.items || [];
  const pending = items.filter((q) => q.status === 'pending');
  const approved = items.filter((q) => q.status === 'approved');
  const handled = items.filter((q) => q.status === 'done' || q.status === 'rejected');
  const showing = items.find((q) => q.id === questions?.showingId);
  const ask = settings?.ask || { enabled: true, trigger: '!pregunta', cooldownSeconds: 60, reply: true, replyText: '' };
  const atStreamEnd = settings?.atStreamEnd || 'keep';

  const [problem, setProblem] = useState('');
  const [newText, setNewText] = useState('');
  const [newAsker, setNewAsker] = useState('');
  const run = async (payload: Record<string, any>) => {
    setProblem('');
    try {
      return await control(payload);
    } catch (err: any) {
      setProblem(refusalWords(t, err));
      return null;
    }
  };
  const setAsk = (patch: Record<string, any>) => run({ op: 'settings', settings: { ask: { ...ask, ...patch } } });
  /*
    The server tidies these two — "pregunta" becomes "!pregunta", -5 seconds
    becomes 0 — and when the tidied value is the one already saved, nothing
    changes for the field to follow, so it would go on showing what was typed.
    Drawing the field again once the save is back shows what was kept.
  */
  const [triggerDrawn, setTriggerDrawn] = useState(0);
  const [cooldownDrawn, setCooldownDrawn] = useState(0);

  return (
    <div className="animate-fade-in space-y-6 pb-20">
      {/* What is up, and the one press that answers it and brings up the next. */}
      <div className="glass-panel rounded-3xl border border-zinc-800 p-5 flex flex-col sm:flex-row sm:items-center gap-4" data-questions-now>
        <div className="flex-1 min-w-0">
          <div className={label}>{t.questionsOnScreen || 'On screen'}</div>
          <div className="text-sm text-zinc-200 truncate mt-1">
            {showing
              ? <><span className="font-black text-current-accent">{showing.user}</span> · {showing.text}</>
              : <span className="text-zinc-600">{t.questionsNothingOnScreen || 'Nothing on screen.'}</span>}
          </div>
        </div>
        <Button icon={<SkipForward size={14} className="mr-1.5" />} onClick={() => run({ op: 'next' })} disabled={!showing && approved.length === 0}>
          {t.questionsNext || 'Next question'}
        </Button>
      </div>
      {problem && (
        <p role="alert" className="rounded-xl border border-rose-500/40 bg-rose-500/10 px-4 py-2 text-[11px] font-bold text-rose-300">{problem}</p>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Ready to read out. */}
        <div className="glass-panel rounded-3xl border border-zinc-800 p-6 space-y-4">
          <div className="flex items-center gap-3">
            <Check size={16} className="text-current-accent" />
            <span className="text-[11px] font-black uppercase tracking-widest text-zinc-300">
              {t.questionsApproved || 'Ready to read'} ({approved.length})
            </span>
          </div>
          {approved.length === 0 && (
            <p className="text-[10px] text-zinc-600 leading-relaxed">
              {t.questionsNoneApproved || 'Nothing approved yet. Approve one on the right and it can go on screen.'}
            </p>
          )}
          <div className="space-y-2">
            {approved.map((q) => {
              const onScreen = q.id === questions?.showingId;
              return (
                <QuestionRow key={q.id} q={q} highlight={onScreen} onEdit={(text) => run({ op: 'edit', id: q.id, text })} language={language} t={t}>
                  {/* The same press takes it down again. */}
                  <button
                    onClick={() => show(onScreen ? '' : q.id)}
                    title={onScreen ? (t.questionsHide || 'Take it off screen') : (t.questionsShow || 'Put it on screen')}
                    className={`w-8 h-8 rounded-lg border flex items-center justify-center transition-all ${
                      onScreen
                        ? 'bg-current-accent border-current-accent text-white'
                        : 'bg-zinc-900 border-zinc-700 text-zinc-400 hover:border-zinc-500'
                    }`}
                  >
                    {onScreen ? <Square size={13} /> : <Play size={13} />}
                  </button>
                  <button
                    onClick={() => setStatus(q.id, 'done')}
                    title={t.questionsDone || 'Answered'}
                    className="w-8 h-8 rounded-lg border border-zinc-800 bg-zinc-900 text-zinc-500 hover:text-zinc-200 flex items-center justify-center"
                  >
                    <Check size={13} />
                  </button>
                </QuestionRow>
              );
            })}
          </div>
        </div>

        {/* Come in, not looked at. */}
        <div className="glass-panel rounded-3xl border border-zinc-800 p-6 space-y-4">
          <div className="flex items-center gap-3">
            <MessageCircleQuestion size={16} className="text-zinc-500" />
            <span className="text-[11px] font-black uppercase tracking-widest text-zinc-300">
              {t.questionsPending || 'Waiting'} ({pending.length})
            </span>
          </div>
          {pending.length === 0 && (
            <p className="text-[10px] text-zinc-600 leading-relaxed">
              {String(t.questionsNonePending
                || 'Nothing waiting. Viewers ask with {trigger}, or with a command of yours carrying the “Questions: add to queue” step.')
                .split('{trigger}').join(ask.enabled ? ask.trigger : '!…')}
            </p>
          )}
          <div className="space-y-2">
            {pending.map((q) => (
              <QuestionRow key={q.id} q={q} onEdit={(text) => run({ op: 'edit', id: q.id, text })} language={language} t={t}>
                <button
                  onClick={() => setStatus(q.id, 'approved')}
                  title={t.questionsApprove || 'Approve'}
                  className="w-8 h-8 rounded-lg border border-zinc-700 bg-zinc-900 text-zinc-400 hover:text-current-accent hover:border-current-accent flex items-center justify-center"
                >
                  <Check size={13} />
                </button>
                <button
                  onClick={() => setStatus(q.id, 'rejected')}
                  title={t.questionsReject || 'No'}
                  className="w-8 h-8 rounded-lg border border-zinc-800 bg-zinc-900 text-zinc-600 hover:text-rose-500 flex items-center justify-center"
                >
                  <X size={13} />
                </button>
              </QuestionRow>
            ))}
          </div>

          {/* One from somewhere chat cannot see: Discord, a YouTube comment, a list gathered earlier. */}
          <div className="space-y-2 pt-3 border-t border-zinc-800/60" data-questions-add>
            <div className={label}>{t.questionsAddTitle || 'Add a question'}</div>
            <textarea
              value={newText} maxLength={280} rows={2}
              placeholder={t.questionsAddText || 'The question…'}
              onChange={(e) => setNewText(e.target.value.replace(/\n/g, ' '))}
              className={`${field} resize-y`}
            />
            <div className="flex gap-2">
              <input
                value={newAsker} maxLength={60}
                placeholder={t.questionsAddAsker || 'Asked by (optional)'}
                onChange={(e) => setNewAsker(e.target.value)}
                className={field}
              />
              <Button
                size="sm" icon={<Plus size={14} className="mr-1" />} disabled={!newText.trim()}
                onClick={async () => { if (await run({ op: 'add', text: newText, user: newAsker })) { setNewText(''); setNewAsker(''); } }}
              >
                {t.questionsAdd || 'Add'}
              </Button>
            </div>
          </div>
        </div>
      </div>

      {items.length > 0 && (
        <div className="glass-panel rounded-3xl border border-zinc-800 p-6 flex items-center justify-between gap-4">
          <p className="text-[10px] text-zinc-600 leading-relaxed">
            {handled.length} {t.questionsHandled || 'answered or turned down'}.
            {' '}{t.questionsClearHint || 'Clearing keeps anything still waiting or approved.'}
          </p>
          <div className="flex gap-2 shrink-0">
            <Button variant="secondary" size="sm" icon={<Trash2 size={14} />} onClick={() => clear('handled')}>
              {t.questionsClearHandled || 'Clear finished'}
            </Button>
            {/*
              Asks first: it throws away what is waiting and what is approved
              too, and it sits beside a button that keeps both — one slip of
              the finger mid-segment and the queue was gone.
            */}
            <Button
              variant="secondary" size="sm"
              onClick={() => { if (window.confirm(t.questionsClearAllConfirm || 'Clear every question, the waiting and the approved ones too?')) clear(); }}
            >
              {t.questionsClearAll || 'Clear all'}
            </Button>
          </div>
        </div>
      )}

      {/* The rules: how viewers ask, and what the end of a stream does to the queue. */}
      <div className="glass-panel rounded-3xl border border-zinc-800 p-6 space-y-4" data-questions-settings>
        <div className="flex items-center gap-2">
          <Settings2 size={15} className="text-current-accent" />
          <span className="text-[11px] font-black uppercase tracking-widest text-zinc-300">{t.questionsSettings || 'Settings'}</span>
        </div>
        <Toggle
          on={ask.enabled}
          onClick={() => setAsk({ enabled: !ask.enabled })}
          text={`${t.questionsAskToggle || 'Viewers can ask with a chat command'} · ${ask.trigger}`}
          hint={t.questionsAskHint || 'Anything after the command goes into Waiting. Each person can ask once per cooldown, a question already in the queue is not added twice, and a command of your own with the same word answers instead.'}
        />
        {ask.enabled && (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <label className="space-y-1 block">
              <span className={label}>{t.questionsAskTrigger || 'Command'}</span>
              <CommittedInput
                key={triggerDrawn} type="text" value={ask.trigger} maxLength={30}
                onCommit={(v: string) => { setAsk({ trigger: v }).then(() => setTriggerDrawn((n) => n + 1)); }}
                className={field}
              />
            </label>
            <label className="space-y-1 block">
              <span className={label}>{t.questionsAskCooldown || 'Seconds between questions, per person'}</span>
              <CommittedInput
                key={cooldownDrawn} type="number" min={0} max={3600} value={String(ask.cooldownSeconds)}
                onCommit={(v: string) => { setAsk({ cooldownSeconds: Number(v) }).then(() => setCooldownDrawn((n) => n + 1)); }}
                className={field}
              />
            </label>
            <div className="space-y-2 sm:col-span-2">
              <label className="flex items-center gap-2 cursor-pointer w-fit">
                <input type="checkbox" checked={ask.reply} onChange={(e) => setAsk({ reply: e.target.checked })} className="accent-current-accent" />
                <span className={label}>{t.questionsAskReply || 'The bot says it was received'}</span>
              </label>
              {ask.reply && (
                <CommittedInput
                  type="text" value={ask.replyText} maxLength={200}
                  placeholder={t.questionsAskReplyText || 'What the bot says — {user} is who asked'}
                  onCommit={(v: string) => setAsk({ replyText: v })}
                  className={field}
                />
              )}
            </div>
          </div>
        )}
        <div className="space-y-2">
          <div className={label}>{t.questionsStreamEnd || 'When the stream ends'}</div>
          <div className="flex flex-wrap gap-2">
            {(['keep', 'finished', 'all'] as const).map((choice) => (
              <button
                key={choice}
                onClick={() => run({ op: 'settings', settings: { atStreamEnd: choice } })}
                className={`px-3 py-2 rounded-lg text-[10px] font-black uppercase tracking-widest border transition-all ${
                  atStreamEnd === choice ? 'bg-current-accent/10 border-current-accent text-current-accent' : 'bg-zinc-900 border-zinc-800 text-zinc-500 hover:bg-zinc-800'
                }`}
              >
                {choice === 'keep' ? (t.questionsStreamEndKeep || 'Keep everything')
                  : choice === 'finished' ? (t.questionsStreamEndFinished || 'Clear finished ones')
                    : (t.questionsStreamEndAll || 'Clear everything')}
              </button>
            ))}
          </div>
        </div>
        {setFromDiscord && (
          <div className="space-y-2" data-questions-discord>
            <div className={label}>{t.questionsFromDiscord || 'From Discord'}</div>
            <p className="text-[11px] text-zinc-500 leading-relaxed">{t.questionsFromDiscordHint || 'What people post in these channels comes here as a question, marked 📝 in Discord so they know. Answered on stream, the bot replies to it there with a link to the moment in the VOD.'}</p>
            <div className="flex flex-wrap gap-1.5">
              {channels.filter((c) => c.type === 0 || c.type === 5).map((c) => {
                const on = (fromDiscord?.channelIds || []).includes(c.id);
                return (
                  <button key={c.id} onClick={() => setFromDiscord({ channelIds: on ? (fromDiscord?.channelIds || []).filter((x) => x !== c.id) : [...(fromDiscord?.channelIds || []), c.id] })}
                    className={`px-2.5 py-1 rounded-lg text-[10px] font-bold border transition-all ${on ? 'bg-current-accent/10 border-current-accent text-current-accent' : 'bg-zinc-900 border-zinc-800 text-zinc-500 hover:text-zinc-300'}`} data-questions-discord-channel={c.id}>
                    #{c.name}
                  </button>
                );
              })}
            </div>
            <label className="flex items-center gap-2 cursor-pointer">
              <input type="checkbox" checked={fromDiscord?.answer !== false} onChange={(e) => setFromDiscord({ answer: e.target.checked })} className="accent-current-accent" />
              <span className="text-[11px] text-zinc-300">{t.questionsAnswerInDiscord || 'Answered on stream: reply in Discord with the moment in the VOD'}</span>
            </label>
          </div>
        )}
      </div>
    </div>
  );
};
