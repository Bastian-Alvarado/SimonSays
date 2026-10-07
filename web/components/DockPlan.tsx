/**
 * @license
 * SPDX-License-Identifier: Apache-2.0 AND LicenseRef-Commons-Clause-1.0
 *
 * The stream plan, as a panel of the chat dock: where the stream has got to,
 * and the two presses that move it on or take it back.
 *
 * The dock is where the streamer already is while live, and the dock buttons
 * moved the plan without showing it — pressing "Complete current" there was
 * moving a mark you could not see. Here the list is under the buttons, and a
 * step can be picked directly the way the Stream plan screen picks it.
 */
import React, { useEffect, useState } from 'react';
import { Check, Play, Undo2 } from 'lucide-react';
import { formatLength, liveLength, isCounting } from '../../shared/plan-format.js';
import type { Plan } from './views/PlanView';
import { refusalWords } from '../words';
import { withDiscordText } from '../discordEmoji';

interface Props {
  plan?: Plan;
  planGoto: (id: string) => void;
  runDockAction: (ref: string | { id?: string; builtin?: string }) => Promise<any>;
  t: any;
}

export const DockPlan = ({ plan, planGoto, runDockAction, t }: Props) => {
  const items = plan?.items || [];
  const at = items.findIndex((i) => i.id === plan?.currentId);
  const finished = items.length > 0 && at < 0 && items.every((i) => i.done);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  // Half a minute is enough for a time counted in minutes.
  const [now, setNow] = useState(Date.now());
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 30000);
    return () => clearInterval(id);
  }, []);

  // The same presses as the deck's plan buttons, so both say no for the same reasons.
  const press = async (builtin: 'plan_next' | 'plan_back') => {
    setBusy(true);
    setError('');
    try {
      await runDockAction({ builtin });
    } catch (err: any) {
      setError(refusalWords(t, err));
    } finally {
      setBusy(false);
    }
  };

  if (!items.length) {
    return <p className="p-4 text-center text-[11px] text-zinc-500 leading-relaxed">{t.planDockEmpty || 'No plan yet. Build one on the Stream plan screen.'}</p>;
  }

  return (
    <div className="flex flex-col gap-2 p-1" data-plan-dock="list">
      <div className="flex gap-1.5">
        <button
          onClick={() => press('plan_back')}
          disabled={busy || (at < 0 && !finished)}
          className="px-3 py-2 rounded-lg border border-zinc-800 bg-zinc-900 text-zinc-300 text-[10px] font-black uppercase tracking-widest flex items-center gap-1.5 hover:bg-zinc-800 disabled:opacity-30 transition-all"
        >
          <Undo2 size={12} /> {t.planDockBack || 'Go back'}
        </button>
        <button
          onClick={() => press('plan_next')}
          disabled={busy || finished}
          className="flex-1 px-3 py-2 rounded-lg bg-current-accent text-white text-[10px] font-black uppercase tracking-widest flex items-center justify-center gap-1.5 hover:brightness-110 disabled:opacity-30 transition-all"
        >
          <Check size={12} /> {at < 0 && !finished ? (t.planDockStart || 'Start') : (t.planDockNext || 'Complete current')}
        </button>
      </div>
      {error && <p role="alert" className="px-1 text-[10px] font-bold text-red-400">{error}</p>}
      {finished && <p className="px-1 text-[10px] font-bold text-zinc-500">{t.planDockFinished || 'All done for tonight.'}</p>}

      <div className="space-y-1">
        {items.map((item) => {
          const isNow = item.id === plan?.currentId;
          // Time on while live; a step from before that was counted goes by its clock times, as it did.
          const kept = liveLength(item, now);
          const took = isNow && item.startedAt
            ? (kept === null ? formatLength(now - item.startedAt) : kept === 0 && !isCounting(item) ? '' : `${formatLength(kept)}${isCounting(item) ? '' : ' ⏸'}`)
            : item.done && item.startedAt && item.doneAt ? (kept === null ? formatLength(item.doneAt - item.startedAt) : kept > 0 ? formatLength(kept) : '') : '';
          return (
            <div
              key={item.id}
              data-plan-dock="item" data-plan-state={isNow ? 'now' : item.done ? 'done' : 'todo'}
              className={`flex items-center gap-2 rounded-lg px-2 py-1.5 border transition-all ${isNow ? 'border-current-accent bg-current-accent/10' : 'border-transparent'}`}
            >
              <button
                onClick={() => planGoto(item.id)}
                title={t.planGoHere || 'We are on this now'}
                className={`w-6 h-6 shrink-0 rounded-md border flex items-center justify-center transition-all ${
                  isNow ? 'bg-current-accent border-current-accent text-white'
                    : item.done ? 'bg-zinc-900 border-zinc-800 text-zinc-600'
                      : 'bg-zinc-900 border-zinc-700 text-zinc-500 hover:border-zinc-500'
                }`}
              >
                {item.done && !isNow ? <Check size={12} /> : <Play size={11} />}
              </button>
              <span className={`flex-1 min-w-0 truncate text-xs ${item.done && !isNow ? 'text-zinc-600 line-through' : isNow ? 'text-white font-bold' : 'text-zinc-300'}`}>
                {withDiscordText(item.text)}
              </span>
              {took && <span className="shrink-0 text-[10px] font-mono text-zinc-500">{took}</span>}
            </div>
          );
        })}
      </div>
    </div>
  );
};
