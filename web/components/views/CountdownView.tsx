/**
 * @license
 * SPDX-License-Identifier: Apache-2.0 AND LicenseRef-Commons-Clause-1.0
 *
 * Countdown controls: the clock you point a browser source at.
 *
 * Every button here asks the server to do something; nothing about the timer
 * is held in this screen. Two people on two devices pressing pause see the
 * same thing, and a refresh mid-countdown changes nothing — which is the
 * entire reason the clock is not in the overlay.
 */
import React, { useLayoutEffect, useRef, useState } from 'react';
import { CountdownState, ThemeConfig } from '../../types';
import { Button } from '../Button';
import { Countdown } from '../Countdown';
import { SavedTimers, MAX_TIMERS } from '../SavedTimers';
import { Play, Pause, RotateCcw, Copy, ExternalLink, Check, Minus, Plus } from 'lucide-react';
import { copyText } from '../../utils';
import { AutoColourRow } from '../AutoSwatch';

interface CountdownViewProps {
  state: CountdownState | undefined;
  control: (op: string, value?: any) => void;
  activeTheme: ThemeConfig;
  t: any;
}

/** The presets worth a single tap; anything else goes in the minutes field. */
const QUICK_MINUTES = [1, 3, 5, 10, 15, 30];

/** How big the preview draws the clock, when it has the room. */
const PREVIEW_SCALE = 0.55;

/**
 * The preview's scale, made smaller when the clock would not fit its box.
 *
 * At 0.55 a large clock is wider than a phone: 45:00 at the biggest size ran
 * off both sides, and a long label broke onto two lines. The widest line is
 * measured at the scale it was drawn at and brought back inside the box; with
 * room to spare it stays at 0.55, so the desktop preview is as it was.
 */
function usePreviewFit(deps: unknown[]) {
  const box = useRef<HTMLDivElement>(null);
  const [scale, setScale] = useState(PREVIEW_SCALE);
  const drawnAt = useRef(PREVIEW_SCALE);
  useLayoutEffect(() => {
    const el = box.current;
    if (!el) return undefined;
    const fit = () => {
      const parts = [...el.querySelectorAll('[data-countdown="digits"], [data-countdown="label"]')] as HTMLElement[];
      const widest = Math.max(0, ...parts.map((p) => p.scrollWidth));
      if (!widest) return;
      const natural = widest * (PREVIEW_SCALE / drawnAt.current);
      const room = el.clientWidth - 48;
      const next = natural > room ? Math.max(0.12, PREVIEW_SCALE * (room / natural)) : PREVIEW_SCALE;
      if (Math.abs(next - drawnAt.current) > 0.004) { drawnAt.current = next; setScale(next); }
    };
    fit();
    const watch = new ResizeObserver(fit);
    watch.observe(el);
    return () => watch.disconnect();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);
  return { box, scale };
}

export const CountdownView: React.FC<CountdownViewProps> = ({ state, control, activeTheme, t }) => {
  const [copied, setCopied] = useState(false);
  const [labelDraft, setLabelDraft] = useState<string | null>(null);
  /*
    The minutes being typed, sent when they are done: on Enter or on leaving
    the box. Sent on every keystroke, typing 15 put 1:00 on stream on the way,
    and emptying the box to type a new number set the clock to nothing.
  */
  const [minutesDraft, setMinutesDraft] = useState<string | null>(null);
  const commitMinutes = () => {
    if (minutesDraft === null) return;
    const n = Number(minutesDraft);
    if (Number.isFinite(n) && n >= 1) control('setDuration', Math.min(720, n) * 60000);
    setMinutesDraft(null);
  };

  const running = state?.mode === 'running';
  const paused = state?.mode === 'paused';

  const overlayUrl = typeof window !== 'undefined'
    ? `${window.location.origin}${window.location.pathname}?mode=countdown`
    : '';

  const copyUrl = () => {
    copyText(overlayUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };

  const minutes = Math.round((state?.durationMs ?? 0) / 60000);
  // Refitted when what decides its width changes: the size, the words, and how many digits the time has.
  const digitCount = String(Math.floor(Math.max(state?.durationMs ?? 0, state?.remainingMs ?? 0) / 60000)).length;
  const preview = usePreviewFit([state?.style?.fontSize, state?.label, state?.style?.showLabel, digitCount]);

  return (
    <div className="animate-fade-in space-y-8 pb-20">
      

      {/* Same component the browser source renders, at a size that fits here. */}
      <div className={`glass-panel rounded-3xl border ${activeTheme.borderClass} overflow-hidden`}>
        <div
          ref={preview.box}
          // Room above for the state in the corner, so a wide label never runs under it.
          className="cd-preview relative flex items-center justify-center pt-7 pb-4 overflow-hidden"
          style={{
            minHeight: 220,
            backgroundImage: 'linear-gradient(45deg, #18181b 25%, transparent 25%), linear-gradient(-45deg, #18181b 25%, transparent 25%), linear-gradient(45deg, transparent 75%, #18181b 75%), linear-gradient(-45deg, transparent 75%, #18181b 75%)',
            backgroundSize: '20px 20px',
            backgroundPosition: '0 0, 0 10px, 10px -10px, -10px 0px',
            backgroundColor: '#09090b',
          }}
        >
          {/* One line for the label here, so it can be measured and fitted rather than broken in two. */}
          <style>{'.cd-preview [data-countdown="label"] { white-space: nowrap; }'}</style>
          <Countdown state={state} previewScale={preview.scale} t={t} />
          <span className="absolute top-3 right-4 text-[9px] font-black uppercase tracking-widest text-zinc-600">
            {state?.mode === 'running' ? t.countdownRunning
              : state?.mode === 'paused' ? t.countdownPaused
                : state?.mode === 'finished' ? t.countdownFinished : t.countdownIdle}
          </span>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-6">
          <SavedTimers
            presets={(state as any)?.presets || []}
            activeId={(state as any)?.activeId || ''}
            live={{ durationMs: state?.durationMs, label: state?.label, style: state?.style }}
            control={control}
            max={MAX_TIMERS}
            t={t}
          />

          {/* ------------------------------------------------------ transport */}
          <div className="flex flex-wrap gap-3">
            <Button
              className="flex-1 min-w-[140px]"
              icon={running ? <Pause size={16} /> : <Play size={16} />}
              onClick={() => control(running ? 'pause' : 'start')}
            >
              {running ? t.countdownPause : paused ? t.countdownResume : t.countdownStart}
            </Button>
            <Button variant="outline" className="flex-1 min-w-[140px]" icon={<RotateCcw size={16} />} onClick={() => control('reset')}>
              {t.countdownReset}
            </Button>
          </div>

          {/* Adjusting on the fly, which is what a setup timer is actually for. */}
          <div>
            <h3 className="text-[10px] font-black uppercase tracking-widest text-zinc-500 mb-2">{t.countdownAdjust}</h3>
            <div className="flex flex-wrap gap-2">
              {[-60000, -30000, 30000, 60000, 300000].map((delta) => (
                <button
                  key={delta}
                  onClick={() => control('add', delta)}
                  className="px-3 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest border border-zinc-800 bg-zinc-900 text-zinc-400 hover:border-current-accent hover:text-current-accent transition-all flex items-center gap-1"
                >
                  {delta < 0 ? <Minus size={11} /> : <Plus size={11} />}
                  {Math.abs(delta) >= 60000 ? `${Math.abs(delta) / 60000}m` : `${Math.abs(delta) / 1000}s`}
                </button>
              ))}
            </div>
          </div>

          {/* ------------------------------------------------------- duration */}
          <div>
            <h3 className="text-[10px] font-black uppercase tracking-widest text-zinc-500 mb-2">{t.countdownDuration}</h3>
            <div className="flex flex-wrap gap-2 mb-3">
              {QUICK_MINUTES.map((m) => (
                <button
                  key={m}
                  onClick={() => control('setDuration', m * 60000)}
                  className={`px-4 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest border transition-all ${
                    minutes === m ? 'bg-current-accent/10 border-current-accent text-current-accent' : 'bg-zinc-900 border-zinc-800 text-zinc-500'
                  }`}
                >
                  {m}m
                </button>
              ))}
            </div>
            <div className="flex items-center gap-2">
              <input
                type="number"
                min={1}
                max={720}
                value={minutesDraft ?? (minutes || '')}
                onChange={(e) => setMinutesDraft(e.target.value)}
                onBlur={commitMinutes}
                onKeyDown={(e) => { if (e.key === 'Enter') (e.target as HTMLInputElement).blur(); if (e.key === 'Escape') setMinutesDraft(null); }}
                className="w-28 bg-zinc-950 border border-zinc-800 rounded-xl px-3 py-2 text-xs font-mono text-white outline-none focus:border-current-accent"
              />
              <span className="text-[10px] font-black uppercase tracking-widest text-zinc-600">{t.countdownMinutes}</span>
            </div>
            {running && <p className="text-[10px] text-zinc-600 mt-2">{t.countdownDurationHint}</p>}
          </div>

          {/* ---------------------------------------------------------- label */}
          <div>
            <h3 className="text-[10px] font-black uppercase tracking-widest text-zinc-500 mb-2">{t.countdownLabel}</h3>
            <input
              value={labelDraft ?? state?.label ?? ''}
              onChange={(e) => setLabelDraft(e.target.value)}
              onBlur={() => { if (labelDraft !== null) { control('setLabel', labelDraft); setLabelDraft(null); } }}
              onKeyDown={(e) => { if (e.key === 'Enter') (e.target as HTMLInputElement).blur(); if (e.key === 'Escape') setLabelDraft(null); }}
              placeholder={t.countdownLabelPlaceholder}
              className="w-full bg-zinc-950 border border-zinc-800 rounded-xl px-4 py-2 text-xs text-white outline-none focus:border-current-accent"
            />
            <p className="text-[10px] text-zinc-600 mt-1">{t.countdownLabelHint}</p>
          </div>
        </div>

        {/* ------------------------------------------------------------ look */}
        <div className="space-y-4">
          <h3 className="text-[10px] font-black uppercase tracking-widest text-zinc-500">{t.omnibarStyle}</h3>
          <div className="bg-zinc-900/40 border border-zinc-800 rounded-2xl p-4 space-y-4">
            <div className="space-y-2">
              <div className="flex justify-between items-center">
                <label className="text-[9px] font-black uppercase tracking-widest text-zinc-500">{t.countdownSize}</label>
                <span className="text-[10px] font-black font-mono text-current-accent">{state?.style?.fontSize ?? 96}px</span>
              </div>
              <input
                type="range" min={24} max={300}
                value={state?.style?.fontSize ?? 96}
                onChange={(e) => control('setStyle', { ...state?.style, fontSize: Number(e.target.value) })}
                className="w-full h-1.5 bg-zinc-800 rounded-lg appearance-none cursor-pointer accent-current-accent"
              />
            </div>

            {/*
              Each colour, or automatic: left empty, a look on the layer
              decides it, and without one the clock's own shows. Picking one
              makes it yours, over any look; the cross hands it back.
            */}
            {([['color', t.countdownColor, '#ffffff'], ['labelColor', t.countdownLabelColor, '#f43f5e']] as const).map(([key, label, own]) => (
              <AutoColourRow
                key={key}
                name={key}
                label={label}
                value={(state?.style as any)?.[key]}
                fallback={own}
                onChange={(v) => control('setStyle', { ...state?.style, [key]: v })}
                onClear={() => control('setStyle', { ...state?.style, [key]: '' })}
                t={t}
              />
            ))}

            <button
              onClick={() => control('setStyle', { ...state?.style, showLabel: !(state?.style?.showLabel !== false) })}
              className={`w-full px-3 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest border transition-all flex items-center justify-between ${
                state?.style?.showLabel !== false ? 'bg-current-accent/10 border-current-accent text-current-accent' : 'bg-zinc-900 border-zinc-800 text-zinc-500'
              }`}
            >
              <span>{t.countdownShowLabel}</span>
              {state?.style?.showLabel !== false ? <Check size={14} /> : <Minus size={14} />}
            </button>
          </div>

          <div className="bg-zinc-900/40 border border-zinc-800 rounded-2xl p-4">
            <label className="text-[9px] font-black uppercase tracking-widest text-zinc-500 mb-2 block">{t.countdownUrl}</label>
            <code className="text-[10px] text-current-accent font-mono break-all block mb-3">{overlayUrl}</code>
            <div className="flex gap-2">
              <Button size="sm" variant="outline" className="flex-1" icon={<Copy size={12} />} onClick={copyUrl}>
                {copied ? t.copied : t.copyIt}
              </Button>
              <Button
                size="sm" variant="outline" className="flex-1" icon={<ExternalLink size={12} />}
                onClick={() => window.open(overlayUrl, '_blank', 'width=600,height=300')}
              >
                {t.popout}
              </Button>
            </div>
            <p className="text-[9px] text-zinc-600 mt-3 leading-relaxed">{t.countdownUrlHint}</p>
          </div>
        </div>
      </div>
    </div>
  );
};
