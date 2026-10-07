/**
 * @license
 * SPDX-License-Identifier: Apache-2.0 AND LicenseRef-Commons-Clause-1.0
 *
 * The question queue, as a panel of the chat dock: approve or turn down what
 * comes in, put an approved one up, and answer it with "Next question" —
 * without leaving OBS for the Questions screen in the middle of the segment.
 */
import React from 'react';
import { Check, X, Play, Square, SkipForward } from 'lucide-react';
import type { Questions } from './views/QuestionsView';
import { withDiscordText } from '../discordEmoji';

interface Props {
  questions?: Questions;
  setStatus: (id: string, status: string) => void;
  show: (id: string) => void;
  control: (payload: Record<string, any>) => Promise<any>;
  t: any;
}

const small = 'w-7 h-7 shrink-0 rounded-md border flex items-center justify-center transition-all';

export const DockQuestions = ({ questions, setStatus, show, control, t }: Props) => {
  const items = questions?.items || [];
  const approved = items.filter((q) => q.status === 'approved');
  const pending = items.filter((q) => q.status === 'pending');
  const showingId = questions?.showingId || '';

  return (
    <div className="flex flex-col gap-3 p-1" data-questions-dock>
      <button
        onClick={() => control({ op: 'next' }).catch(() => {})}
        disabled={!showingId && approved.length === 0}
        className="w-full px-3 py-2 rounded-lg bg-current-accent text-white text-[10px] font-black uppercase tracking-widest flex items-center justify-center gap-1.5 hover:brightness-110 disabled:opacity-30 transition-all"
      >
        <SkipForward size={12} /> {t.questionsNext || 'Next question'}
      </button>

      <div className="space-y-1">
        <div className="px-1 text-[10px] font-black uppercase tracking-widest text-zinc-500">{t.questionsApproved || 'Ready to read'} ({approved.length})</div>
        {approved.map((q) => {
          const up = q.id === showingId;
          return (
            <div key={q.id} className={`flex items-start gap-2 rounded-lg border px-2 py-1.5 ${up ? 'border-current-accent bg-current-accent/10' : 'border-zinc-800 bg-zinc-900/40'}`}>
              <div className="flex-1 min-w-0">
                <div className="text-[10px] font-black uppercase tracking-widest text-current-accent truncate">{q.user || '—'}</div>
                <div className="text-xs text-zinc-200 break-words">{withDiscordText(q.text, undefined, (q as any).names)}</div>
              </div>
              <button onClick={() => show(up ? '' : q.id)} title={up ? (t.questionsHide || 'Take it off screen') : (t.questionsShow || 'Put it on screen')}
                className={`${small} ${up ? 'bg-current-accent border-current-accent text-white' : 'bg-zinc-900 border-zinc-700 text-zinc-400'}`}>
                {up ? <Square size={11} /> : <Play size={11} />}
              </button>
              <button onClick={() => setStatus(q.id, 'done')} title={t.questionsDone || 'Answered'} className={`${small} bg-zinc-900 border-zinc-800 text-zinc-500 hover:text-zinc-200`}>
                <Check size={11} />
              </button>
            </div>
          );
        })}
      </div>

      <div className="space-y-1">
        <div className="px-1 text-[10px] font-black uppercase tracking-widest text-zinc-500">{t.questionsPending || 'Waiting'} ({pending.length})</div>
        {pending.map((q) => (
          <div key={q.id} className="flex items-start gap-2 rounded-lg border border-zinc-800 bg-zinc-900/40 px-2 py-1.5">
            <div className="flex-1 min-w-0">
              <div className="text-[10px] font-black uppercase tracking-widest text-current-accent truncate">{q.user || '—'}</div>
              <div className="text-xs text-zinc-200 break-words">{withDiscordText(q.text, undefined, (q as any).names)}</div>
            </div>
            <button onClick={() => setStatus(q.id, 'approved')} title={t.questionsApprove || 'Approve'} className={`${small} bg-zinc-900 border-zinc-700 text-zinc-400 hover:text-current-accent hover:border-current-accent`}>
              <Check size={11} />
            </button>
            <button onClick={() => setStatus(q.id, 'rejected')} title={t.questionsReject || 'No'} className={`${small} bg-zinc-900 border-zinc-800 text-zinc-600 hover:text-rose-500`}>
              <X size={11} />
            </button>
          </div>
        ))}
      </div>
    </div>
  );
};
