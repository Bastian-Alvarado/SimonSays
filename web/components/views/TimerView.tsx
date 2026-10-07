/**
 * @license
 * SPDX-License-Identifier: Apache-2.0 AND LicenseRef-Commons-Clause-1.0
 *
 * The run timer's own screen: the clock, the buttons that run it, and how it
 * looks.
 *
 * The buttons are the ones a marathon's tech desk has. Start begins a run and
 * carries on a paused one; Finish freezes the time the runner finished on;
 * Undo finish is there because someone will press Finish early, and the run
 * did not stop just because the button was pressed. Reset is kept apart from
 * the rest, since it is the one that throws a time away.
 */
import React, { useState } from 'react';
import { StopwatchState, ThemeConfig } from '../../types';
import { Stopwatch } from '../Stopwatch';
import { Play, Pause, Flag, Undo2, RotateCcw, Copy, Check, Minus, Plus } from 'lucide-react';
import { copyText } from '../../utils';
import { AutoColourRow } from '../AutoSwatch';

interface Props {
  state: StopwatchState | undefined;
  control: (op: string, value?: any) => void;
  activeTheme: ThemeConfig;
  t: any;
}

/** "1:02:03.4", "12:34", "90" — a time as somebody would type it — in milliseconds. */
export function readTime(raw: string): number | null {
  const parts = raw.trim().split(':').map((p) => p.trim());
  if (!parts.length || parts.length > 3 || parts.some((p) => p === '' || Number.isNaN(Number(p)))) return null;
  const nums = parts.map(Number);
  const [h, m, s] = nums.length === 3 ? nums : nums.length === 2 ? [0, ...nums] : [0, 0, nums[0]];
  return Math.round(((h * 60 + m) * 60 + s) * 1000);
}

export const TimerView: React.FC<Props> = ({ state, control, activeTheme, t }) => {
  const [timeDraft, setTimeDraft] = useState('');
  const [copied, setCopied] = useState(false);
  const mode = state?.mode || 'idle';
  const style = state?.style || ({} as StopwatchState['style']);

  const overlayUrl = typeof window !== 'undefined' ? `${window.location.origin}${window.location.pathname}?mode=timer` : '';

  const setTime = () => {
    const ms = readTime(timeDraft);
    if (ms === null) return;
    control('set', ms);
    setTimeDraft('');
  };

  const button = (label: string, icon: React.ReactNode, onClick: () => void, on: boolean, tone = '') => (
    <button
      onClick={onClick}
      disabled={!on}
      className={`px-5 py-3 rounded-2xl text-[11px] font-black uppercase tracking-widest border transition-all flex items-center gap-2 disabled:opacity-30 ${
        tone || 'bg-zinc-900 border-zinc-800 text-zinc-200 hover:border-current-accent hover:text-current-accent'
      }`}
    >
      {icon} {label}
    </button>
  );

  /*
    Each colour, or automatic: left empty, a look on the layer decides it,
    and without one the clock's own shows. Picking one makes it yours, over
    any look; the cross hands it back.
  */
  const OWN = { color: '#ffffff', pausedColor: '#a1a1aa', finishedColor: '#facc15', background: '#000000' } as const;
  const swatch = (key: 'color' | 'pausedColor' | 'finishedColor' | 'background', label: string) => (
    <AutoColourRow
      name={key}
      label={label}
      value={(style as any)[key]}
      fallback={OWN[key]}
      onChange={(v) => control('setStyle', { [key]: v })}
      onClear={() => control('setStyle', { [key]: '' })}
      t={t}
    />
  );

  return (
    <div className="animate-fade-in space-y-6 pb-20">
      <div className={`glass-panel rounded-[32px] border ${activeTheme.borderClass} ${activeTheme.panelClass} p-8 flex flex-col items-center gap-6`}>
        {/* The clock as it is on stream, a little smaller. */}
        <div className="w-full h-40 rounded-2xl bg-black/40 border border-zinc-800 overflow-hidden" data-timer-preview>
          <Stopwatch state={state} previewScale={0.9} />
        </div>
        <p className="text-[10px] font-black uppercase tracking-widest text-zinc-500" data-timer-mode>
          {({ idle: t.timerIdle || 'Ready', running: t.timerRunning || 'Running', paused: t.timerPaused || 'Paused', finished: t.timerFinished || 'Finished' } as any)[mode]}
        </p>

        <div className="flex flex-wrap items-center justify-center gap-3">
          {mode === 'running'
            ? button(t.timerPause || 'Pause', <Pause size={14} />, () => control('pause'), true)
            : button(mode === 'paused' ? (t.timerResume || 'Resume') : (t.timerStart || 'Start'), <Play size={14} />, () => {
              // From a finish it is a new run from zero, and the time on the clock goes with it.
              if (mode === 'finished' && !window.confirm(t.timerNewRunConfirm || 'Start a new run from 00:00.0? The finished time will be cleared.')) return;
              control('start');
            }, true,
              'bg-current-accent border-transparent text-white shadow-lg')}
          {button(t.timerFinish || 'Finish', <Flag size={14} />, () => control('finish'), mode === 'running' || mode === 'paused')}
          {button(t.timerUndo || 'Undo finish', <Undo2 size={14} />, () => control('undoFinish'), mode === 'finished')}
          <span className="w-px h-8 bg-zinc-800 mx-1" />
          {button(t.timerReset || 'Reset', <RotateCcw size={14} />, () => { if (mode === 'idle' || window.confirm(t.timerResetConfirm || 'Reset the timer to 00:00.0?')) control('reset'); }, true,
            'bg-zinc-900 border-zinc-800 text-zinc-400 hover:border-red-500/60 hover:text-red-400')}
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className={`glass-panel rounded-[32px] border ${activeTheme.borderClass} ${activeTheme.panelClass} p-6 space-y-4`}>
          <h3 className="text-[10px] font-black uppercase tracking-widest text-zinc-500">{t.timerAdjust || 'Correct the time'}</h3>
          <p className="text-[10px] text-zinc-500 leading-relaxed">{t.timerAdjustHint || 'For a run that started before the button was pressed, or a finish pressed late. Works whether it is running or not.'}</p>
          <div className="flex gap-2">
            <input
              value={timeDraft}
              onChange={(e) => setTimeDraft(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter') setTime(); }}
              placeholder="1:23:45.6"
              className="flex-1 bg-zinc-950 border border-zinc-800 rounded-xl px-3 py-2 text-sm font-mono text-white outline-none focus:border-current-accent"
              data-timer-set
            />
            <button
              onClick={setTime}
              disabled={readTime(timeDraft) === null}
              className="px-4 rounded-xl text-[10px] font-black uppercase tracking-widest bg-current-accent text-white disabled:opacity-30"
            >
              {t.timerSet || 'Set'}
            </button>
          </div>
          <div className="flex flex-wrap gap-2">
            {[-10, -1, 1, 10].map((s) => (
              <button
                key={s}
                onClick={() => control('add', s * 1000)}
                className="px-3 py-2 rounded-xl text-[10px] font-black border border-zinc-800 bg-zinc-900 text-zinc-300 hover:border-current-accent flex items-center gap-1"
              >
                {s < 0 ? <Minus size={10} /> : <Plus size={10} />} {Math.abs(s)}s
              </button>
            ))}
          </div>
        </div>

        <div className={`glass-panel rounded-[32px] border ${activeTheme.borderClass} ${activeTheme.panelClass} p-6 space-y-4`}>
          <h3 className="text-[10px] font-black uppercase tracking-widest text-zinc-500">{t.timerLook || 'How it looks'}</h3>
          <label className="block space-y-1">
            <span className="flex justify-between text-[10px] font-black uppercase tracking-widest text-zinc-500">
              {t.timerSize || 'Size'} <span className="font-mono text-current-accent">{style.fontSize || 96}px</span>
            </span>
            <input
              type="range" min={24} max={240} value={style.fontSize || 96}
              onChange={(e) => control('setStyle', { fontSize: Number(e.target.value) })}
              className="w-full accent-current-accent"
            />
          </label>
          {swatch('color', t.timerColourRunning || 'Running')}
          {swatch('pausedColor', t.timerColourPaused || 'Paused')}
          {swatch('finishedColor', t.timerColourFinished || 'Finished')}
          <button
            onClick={() => control('setStyle', { showTenths: style.showTenths === false })}
            className={`w-full px-4 py-2.5 rounded-xl text-[10px] font-black uppercase tracking-widest border flex items-center justify-between ${
              style.showTenths !== false ? 'bg-current-accent/10 border-current-accent text-current-accent' : 'bg-zinc-900 border-zinc-800 text-zinc-500'
            }`}
          >
            <span>{t.timerTenths || 'Show tenths of a second'}</span> {style.showTenths !== false && <Check size={14} />}
          </button>
          <div className="pt-2 border-t border-zinc-800/60 space-y-2">
            <p className="text-[10px] text-zinc-500">{t.timerSourceHint || 'On a layout it is the Timer layer. On its own, as a browser source:'}</p>
            <div className="flex bg-zinc-950 border border-zinc-800 rounded-xl overflow-hidden">
              <input readOnly value={overlayUrl} className="flex-1 bg-transparent px-3 py-2 text-[10px] font-mono text-zinc-400 outline-none" />
              <button onClick={() => { copyText(overlayUrl); setCopied(true); setTimeout(() => setCopied(false), 1500); }} className="px-3 text-zinc-500 hover:text-white">
                {copied ? <Check size={14} /> : <Copy size={14} />}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
