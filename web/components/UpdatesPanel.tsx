/**
 * @license
 * SPDX-License-Identifier: Apache-2.0 AND LicenseRef-Commons-Clause-1.0
 *
 * Settings → About → Updates: whether a newer version is out, what is new in
 * it, and a button to update (server/engine/updater.js does the work).
 *
 * Only on a copy that updates itself — the public edition, started with
 * npm start. Checking is automatic, once a day; updating is always a press,
 * and a second one to confirm, since the app restarts for a few seconds.
 * While it works, the steps are shown as they go; then the server restarts
 * into the new version and this page, which is the old one, reloads itself.
 */
import React, { useEffect, useState } from 'react';
import { Download, RefreshCw, Check, Loader2, ExternalLink, AlertTriangle } from 'lucide-react';
import { Button } from './Button';
import { VERSION } from '../../shared/version.js';
import { fill, refusalWords } from '../words';

export interface UpdatesState {
  enabled: boolean;
  current: string;
  launcher: boolean;
  checkedAt: number;
  latest: { version: string; name: string; notes: string; url: string; publishedAt: string } | null;
  available: boolean;
  error: { code?: string; message?: string; vars?: Record<string, any> } | null;
  failed: string[];
  rolledBackFrom: string;
  phase: { step: string; version?: string; code?: string; message?: string; vars?: Record<string, any> };
}

/** The steps an update goes through, in order, as the updater names them. */
const STEPS: [string, string, string][] = [
  ['checking', 'updatesStepChecking', 'Asking GitHub'],
  ['downloading', 'updatesStepDownloading', 'Downloading'],
  ['verifying', 'updatesStepVerifying', 'Checking it arrived whole'],
  ['backing-up', 'updatesStepBackingUp', 'Backing up your data'],
  ['unpacking', 'updatesStepUnpacking', 'Unpacking'],
  ['installing', 'updatesStepInstalling', 'Installing what it needs'],
  ['restarting', 'updatesStepRestarting', 'Restarting into the new version'],
];

/** The version this page asked to update to, so it reloads into it — kept across the restart's reconnect. */
const UPDATING_KEY = 'simonsays_updating_to';
const remember = (version: string | null) => {
  try {
    if (version) sessionStorage.setItem(UPDATING_KEY, version);
    else sessionStorage.removeItem(UPDATING_KEY);
  } catch { /* private window: it just won't reload by itself */ }
};
const remembered = () => {
  try { return sessionStorage.getItem(UPDATING_KEY) || ''; } catch { return ''; }
};

/**
 * Once the server that comes back is the version this page updated to, the
 * page reloads to be that version too. Used by the App, so it happens on
 * whichever screen is open. If the new version would not start and the
 * launcher went back, there is nothing to reload into: forgotten.
 */
export function useReloadAfterUpdate(serverVersion: string, updates: UpdatesState | null) {
  useEffect(() => {
    const to = remembered();
    if (!to) return;
    if (serverVersion === to && serverVersion !== VERSION) { remember(null); window.location.reload(); return; }
    if (updates?.rolledBackFrom === to) remember(null);
  }, [serverVersion, updates?.rolledBackFrom]);
}

const when = (at: number | string, language: string) => {
  const d = new Date(at);
  return Number.isNaN(d.getTime()) ? '' : d.toLocaleString(language, { dateStyle: 'medium', timeStyle: 'short' });
};

export const UpdatesPanel = ({ updates, act, language, light, t }: {
  updates: UpdatesState;
  act: (op: 'check' | 'apply') => Promise<any>;
  language: string;
  light: boolean;
  t: any;
}) => {
  const [checking, setChecking] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const [refused, setRefused] = useState('');
  const step = updates.phase?.step || 'idle';
  const working = STEPS.some(([s]) => s === step);
  const at = STEPS.findIndex(([s]) => s === step);
  const latest = updates.latest;
  const muted = light ? 'text-zinc-600' : 'text-zinc-400';
  // The version that would not start, and the app went back from: said while it is the one on offer, not over a newer one.
  const wentBack = !working && updates.rolledBackFrom && updates.failed.includes(updates.rolledBackFrom)
    && (!latest || latest.version === updates.rolledBackFrom) ? updates.rolledBackFrom : '';

  useEffect(() => { if (!updates.available) setConfirming(false); }, [updates.available]);

  const checkNow = async () => {
    setChecking(true);
    setRefused('');
    try { await act('check'); } catch (err: any) { setRefused(refusalWords(t, err)); } finally { setChecking(false); }
  };

  const updateNow = async () => {
    setConfirming(false);
    setRefused('');
    if (latest) remember(latest.version);
    try {
      // Answered as soon as it starts; the steps come after, as the server publishes them.
      await act('apply');
    } catch (err: any) {
      // Refused: nothing is coming to reload into. Not answered (the socket dropped): it may still be.
      if (err?.code) remember(null);
      setRefused(refusalWords(t, err));
    }
  };

  return (
    <div className={`mt-6 pt-6 border-t ${light ? 'border-zinc-200' : 'border-white/10'}`} data-updates={step}>
      <div className="flex flex-wrap items-center gap-3">
        <h4 className="text-sm font-black uppercase tracking-widest flex-1 min-w-[8rem]">{t.updatesTitle || 'Updates'}</h4>
        <Button size="sm" variant="secondary" onClick={checkNow} disabled={checking || working} icon={<RefreshCw size={14} className={checking ? 'animate-spin' : ''} />} data-updates-check>
          {checking ? (t.updatesCheckingNow || 'Checking…') : (t.updatesCheck || 'Check for updates')}
        </Button>
      </div>
      <p className={`mt-2 text-xs ${muted}`} data-updates-checked={updates.checkedAt || 0}>
        {updates.checkedAt
          ? fill(t.updatesCheckedAt || 'Last checked {when}. It also checks by itself once a day.', { when: when(updates.checkedAt, language) })
          : (t.updatesNeverChecked || 'Not checked yet. It checks by itself once a day.')}
      </p>

      {wentBack && (
        <div className="mt-4 flex items-start gap-2 rounded-2xl border border-amber-500/30 bg-amber-500/5 px-4 py-3 text-xs text-amber-300" data-updates-rolled-back={wentBack}>
          <AlertTriangle size={14} className="shrink-0 mt-0.5" />
          <span>{fill(t.updatesRolledBack || 'Version {version} did not start, so the app went back to {current}. Nothing of yours was lost.', { version: wentBack, current: updates.current })}</span>
        </div>
      )}

      {working ? (
        <div className={`mt-4 rounded-2xl border ${light ? 'border-zinc-200' : 'border-white/10'} bg-current-accent/10 px-4 py-4`} data-updates-working>
          <p className="text-sm font-bold mb-3">{fill(t.updatesAvailable || 'Version {version} is out', { version: updates.phase.version || latest?.version || '' })}</p>
          <ol className="space-y-1.5">
            {STEPS.map(([s, key, fallback], i) => (
              <li key={s} className={`flex items-center gap-2 text-xs ${i < at ? muted : i === at ? 'font-bold' : 'opacity-40'}`} data-updates-step={s}>
                {i < at ? <Check size={14} className="text-emerald-400" /> : i === at ? <Loader2 size={14} className="animate-spin text-current-accent" /> : <span className="w-3.5" />}
                {t[key] || fallback}
              </li>
            ))}
          </ol>
          {step === 'restarting' && <p className={`mt-3 text-xs ${muted}`}>{t.updatesReloadSoon || 'This page reloads itself when the app is back.'}</p>}
        </div>
      ) : updates.available && latest ? (
        <div className={`mt-4 rounded-2xl border ${light ? 'border-zinc-200' : 'border-white/10'} bg-current-accent/10 px-4 py-4`} data-updates-available={latest.version}>
          <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
            <p className="text-base font-black">{fill(t.updatesAvailable || 'Version {version} is out', { version: latest.version })}</p>
            {latest.publishedAt && <span className={`text-xs ${muted}`}>{fill(t.updatesPublished || 'Released {when}', { when: when(latest.publishedAt, language) })}</span>}
          </div>
          {latest.notes && (
            <div className="mt-3">
              <p className="text-[10px] font-black uppercase tracking-widest opacity-60 mb-1">{t.updatesNotes || "What's new"}</p>
              {/* The release's own notes, as text: GitHub's markdown is readable as it is. */}
              <pre className={`whitespace-pre-wrap break-words font-sans text-xs leading-relaxed max-h-56 overflow-y-auto rounded-xl px-3 py-2 ${light ? 'bg-zinc-100 text-zinc-700' : 'bg-black/30 text-zinc-300'}`} data-updates-notes>{latest.notes}</pre>
            </div>
          )}
          <div className="mt-4 flex flex-wrap items-center gap-3">
            {!confirming ? (
              <Button size="sm" onClick={() => { setRefused(''); setConfirming(true); }} disabled={!updates.launcher} icon={<Download size={14} />} data-updates-apply>
                {t.updatesUpdate || 'Update now'}
              </Button>
            ) : (
              <>
                <Button size="sm" onClick={updateNow} icon={<Download size={14} />} data-updates-confirm>{t.updatesConfirmGo || 'Update and restart'}</Button>
                <Button size="sm" variant="ghost" onClick={() => setConfirming(false)}>{t.cancel || 'Cancel'}</Button>
              </>
            )}
            {latest.url && (
              <a href={latest.url} target="_blank" rel="noreferrer" className={`inline-flex items-center gap-1 text-xs ${muted} hover:text-current-accent`}>
                {t.updatesOnGithub || 'See it on GitHub'} <ExternalLink size={12} />
              </a>
            )}
          </div>
          {confirming && <p className={`mt-3 text-xs ${muted}`} data-updates-confirm-note>{t.updatesConfirm || 'The app restarts for a few seconds to update; overlays and docks come back by themselves. Your data is backed up first.'}</p>}
          {!updates.launcher && <p className="mt-3 text-xs text-amber-300" data-updates-no-launcher>{t.updatesNoLauncher || 'To update from here, start the app with npm start.'}</p>}
        </div>
      ) : updates.checkedAt && !updates.error ? (
        <p className="mt-3 text-xs text-emerald-400 flex items-center gap-1.5" data-updates-newest><Check size={14} /> {t.updatesNewest || 'You have the newest version.'}</p>
      ) : null}

      {step === 'failed' && !working && (
        <p className="mt-3 text-xs text-rose-400" data-updates-failed={updates.phase.code}>{fill(t.updatesStopped || 'The update stopped: {why}', { why: refusalWords(t, updates.phase) })}</p>
      )}
      {updates.error && !working && (
        <p className="mt-3 text-xs text-rose-400" data-updates-error={updates.error.code}>{refusalWords(t, updates.error)}</p>
      )}
      {refused && !(step === 'failed' && refused === refusalWords(t, updates.phase)) && <p className="mt-3 text-xs text-rose-400" data-updates-refused>{refused}</p>}
    </div>
  );
};
