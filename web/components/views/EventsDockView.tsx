/**
 * @license
 * SPDX-License-Identifier: Apache-2.0 AND LicenseRef-Commons-Clause-1.0
 *
 * The Events dock on the dashboard: what viewers have done, this stream's
 * totals, and the line "Thank" says in chat.
 *
 * The list itself is EventFeed, the same one the chat dock's Events tab
 * shows in OBS. This screen adds what is set up once rather than pressed
 * mid-stream: the thank-you line, and emptying the list.
 */
import React from 'react';
import { Trash2, MessageCircleHeart } from 'lucide-react';
import { ThemeConfig } from '../../types';
import { Button } from '../Button';
import { CommittedInput } from '../CommittedInput';
import { EventFeed, EventTotals, ViewerEvent } from '../EventFeed';

interface EventsDockViewProps {
  events: ViewerEvent[];
  totals?: EventTotals;
  settings?: { thanks: string };
  run: (payload: Record<string, any>) => Promise<any>;
  shoutout: (login: string) => Promise<any>;
  clearHistory: () => void;
  activeTheme: ThemeConfig;
  language: string;
  t: any;
}

export const EventsDockView: React.FC<EventsDockViewProps> = ({
  events, totals, settings, run, shoutout, clearHistory, activeTheme, language, t,
}) => (
  <div className="animate-fade-in flex flex-col gap-4 h-[calc(100dvh-12rem)]">
    <div className="flex items-center justify-end">
      {/*
        Asks first: the list is also what the omnibar's Recent slot reads, and
        it cannot be brought back.
      */}
      <Button
        size="sm" variant="outline" icon={<Trash2 size={14} />}
        onClick={() => { if (window.confirm(t.eventsClearConfirm || 'Empty the event list? The omnibar’s Recent slot reads it too.')) clearHistory(); }}
      >
        {t.clear}
      </Button>
    </div>

    <div className={`flex-1 min-h-0 glass-panel rounded-3xl p-4 border flex flex-col ${activeTheme.borderClass} ${activeTheme.panelClass}`}>
      <EventFeed
        events={events || []}
        totals={totals}
        run={run}
        shoutout={shoutout}
        onResetTotals={() => { if (window.confirm(t.eventTotalsResetConfirm || 'Start this stream’s totals from zero?')) run({ op: 'reset_totals' }).catch(() => {}); }}
        language={language}
        t={t}
      />
    </div>

    {/* What "Thank" says. */}
    <div className="glass-panel rounded-2xl border border-zinc-800 p-4 space-y-2" data-events-thanks>
      <div className="flex items-center gap-2">
        <MessageCircleHeart size={14} className="text-current-accent" />
        <span className="text-[10px] font-black uppercase tracking-widest text-zinc-400">{t.eventsThanksLabel || 'What “Thank” says in chat'}</span>
      </div>
      <CommittedInput
        type="text" value={settings?.thanks || ''} maxLength={300}
        onCommit={(v: string) => { run({ op: 'settings', settings: { thanks: v } }).catch(() => {}); }}
        className="w-full bg-zinc-950 border border-zinc-800 rounded-lg px-3 py-2 text-xs text-zinc-200 outline-none focus:border-current-accent"
      />
      <p className="text-[10px] text-zinc-600 leading-relaxed">
        {t.eventsThanksHint || '{user} is who, {what} is what they did — “la raid”, “los 100 bits”. Sent by the bot, for Twitch events.'}
      </p>
    </div>
  </div>
);
