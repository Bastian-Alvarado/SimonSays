/**
 * @license
 * SPDX-License-Identifier: Apache-2.0 AND LicenseRef-Commons-Clause-1.0
 *
 * The first-run setup (3.0.0): over the dashboard on a new install, for the
 * streamer — the language; an existing SimonSays to bring in; who can open
 * the dashboard; and OBS, found from its own settings — then on to the
 * Guides' setup steps for the platforms (server/engine/first-run.js).
 *
 * Every step can be skipped, and so can all of it; it does not come back.
 * The steps about the launcher's copy (bringing one in, the network) are
 * only there when the app was started by the launcher, which can restart it.
 */
import React, { useEffect, useState } from 'react';
import { Languages, FolderInput, Wifi, Monitor, Clapperboard, PartyPopper, Check, Loader2, AlertTriangle, RefreshCw, ArrowLeft, ArrowRight } from 'lucide-react';
import { Button } from './Button';
import { BringInPanel } from './BringInPanel';
import { fill, refusalWords } from '../words';

type Step = 'language' | 'bring' | 'network' | 'obs' | 'done';
interface ObsFound { installed: boolean; found: boolean; enabled: boolean; port: number; password: boolean; status: string; error: string | null }

const ICONS: Record<Step, React.ReactNode> = {
  language: <Languages size={18} />, bring: <FolderInput size={18} />, network: <Wifi size={18} />, obs: <Clapperboard size={18} />, done: <PartyPopper size={18} />,
};

export const FirstRun = ({ act, installAct, language, setLanguage, onFinish, t }: {
  act: (op: 'state' | 'done' | 'obs_find' | 'obs_use' | 'network', more?: Record<string, any>) => Promise<any>;
  installAct: (op: 'where' | 'look' | 'bring_in' | 'dismiss', folder?: string) => Promise<any>;
  language: string;
  setLanguage: (lang: any) => void;
  /** Finished or skipped: to the setup steps, or to the dashboard. */
  onFinish: (toSetupSteps: boolean) => void;
  t: any;
}) => {
  const [launcher, setLauncher] = useState(false);
  const [network, setNetwork] = useState<{ open: boolean } | null>(null);
  const [at, setAt] = useState(0);
  const [obs, setObs] = useState<ObsFound | null>(null);
  const [busy, setBusy] = useState('');
  const [said, setSaid] = useState('');
  const [restarting, setRestarting] = useState(false);

  useEffect(() => {
    installAct('where').then((w) => {
      setLauncher(Boolean(w?.launcher));
      // Started in the language chosen in the installer; changed here as any other time.
      if ((w?.language === 'en' || w?.language === 'es') && w.language !== language) setLanguage(w.language);
    }).catch(() => setLauncher(false));
    act('state').then((s) => setNetwork(s?.network || null)).catch(() => { /* asked again on its step */ });
  }, []);

  const steps: Step[] = ['language', ...(launcher ? (['bring', 'network'] as Step[]) : []), 'obs', 'done'];
  const step = steps[Math.min(at, steps.length - 1)];
  const go = (by: number) => { setSaid(''); setAt((i) => Math.max(0, Math.min(steps.length - 1, i + by))); };

  const lookForObs = async () => {
    setBusy('obs'); setSaid('');
    try { setObs(await act('obs_find')); } catch (err: any) { setSaid(refusalWords(t, err)); } finally { setBusy(''); }
  };
  useEffect(() => { if (step === 'obs' && !obs) lookForObs(); }, [step]);
  const useObs = async () => {
    setBusy('use'); setSaid('');
    try { setObs(await act('obs_use')); } catch (err: any) { setSaid(refusalWords(t, err)); } finally { setBusy(''); }
  };

  const chooseNetwork = async (open: boolean) => {
    if (network?.open === open) { go(1); return; }
    setBusy('network'); setSaid('');
    try {
      await act('network', { open });
      setRestarting(true);
      // Back after the restart: asked until it answers with the new setting.
      const until = Date.now() + 60_000;
      while (Date.now() < until) {
        await new Promise((r) => setTimeout(r, 2500));
        try { const s = await act('state'); if (s?.network?.open === open) { setNetwork(s.network); break; } } catch { /* restarting */ }
      }
      setRestarting(false);
      go(1);
    } catch (err: any) {
      setSaid(refusalWords(t, err));
    } finally {
      setBusy('');
    }
  };

  const finish = async (toSetupSteps: boolean) => {
    try { await act('done'); } catch { /* it asks again next time */ }
    onFinish(toSetupSteps);
  };

  const card = 'rounded-2xl border border-white/10 bg-white/[0.03] px-4 py-4';
  const muted = 'text-zinc-400';
  const option = (on: boolean) => `w-full text-left rounded-2xl border px-4 py-4 transition-colors ${on ? 'border-current-accent bg-current-accent/10' : 'border-white/10 hover:border-white/25 bg-white/[0.03]'}`;

  return (
    <div className="fixed inset-0 z-[70] bg-black/80 backdrop-blur-sm flex items-center justify-center p-4 overflow-y-auto" data-first-run={step}>
      <div className="w-full max-w-xl rounded-[32px] border border-white/10 bg-zinc-950 text-zinc-100 shadow-2xl p-6 sm:p-8 my-auto">
        <div className="flex items-center gap-3">
          <span className="text-current-accent">{ICONS[step]}</span>
          <p className="flex-1 text-[10px] font-black uppercase tracking-widest text-zinc-500">
            {fill(t.firstRunStepOf || 'Setting up · {n} of {total}', { n: Math.min(at, steps.length - 1) + 1, total: steps.length })}
          </p>
          {step !== 'done' && <button onClick={() => finish(false)} className="text-[10px] font-bold uppercase tracking-widest text-zinc-500 hover:text-white" data-first-run-skip-all>{t.firstRunSkipAll || 'Skip setup'}</button>}
        </div>
        <div className="mt-3 flex gap-1.5">{steps.map((s, i) => <span key={s} className={`h-1 flex-1 rounded-full ${i <= at ? 'bg-current-accent' : 'bg-white/10'}`} />)}</div>

        {step === 'language' && (
          <div className="mt-6">
            <h2 className="text-2xl font-black tracking-tight">{t.firstRunWelcome || 'Welcome to SimonSays'}</h2>
            <p className={`mt-2 text-sm ${muted}`}>{t.firstRunWelcomeHint || 'A few questions to get it ready, a minute or two. Every one can be skipped and changed later.'}</p>
            <p className="mt-6 text-[10px] font-black uppercase tracking-widest text-zinc-500">{t.firstRunLanguage || 'Language'}</p>
            <div className="mt-2 grid grid-cols-2 gap-3">
              {[['en', 'English'], ['es', 'Español']].map(([code, name]) => (
                <button key={code} onClick={() => setLanguage(code)} className={option(language === code)} data-first-run-lang={code}>
                  <span className="flex items-center gap-2 text-sm font-bold">{language === code && <Check size={14} className="text-current-accent" />}{name}</span>
                </button>
              ))}
            </div>
          </div>
        )}

        {step === 'bring' && (
          <div className="mt-6">
            <h2 className="text-2xl font-black tracking-tight">{t.firstRunBringTitle || 'Used SimonSays before?'}</h2>
            <p className={`mt-2 text-sm ${muted}`}>{t.firstRunBringHint || 'If you ran it from a folder of its own, bring that copy in: everything you made comes with it. New to it? Go on.'}</p>
            <BringInPanel act={installAct} language={language} light={false} t={t} />
          </div>
        )}

        {step === 'network' && (
          <div className="mt-6">
            <h2 className="text-2xl font-black tracking-tight">{t.firstRunNetworkTitle || 'Who can open the dashboard?'}</h2>
            <p className={`mt-2 text-sm ${muted}`}>{t.firstRunNetworkHint || 'OBS on this computer reaches the overlays either way.'}</p>
            <div className="mt-4 space-y-3">
              <button onClick={() => chooseNetwork(false)} disabled={!!busy} className={option(network?.open === false)} data-first-run-network="closed">
                <span className="flex items-center gap-2 text-sm font-bold"><Monitor size={15} /> {t.firstRunNetworkClosed || 'Only this computer'}</span>
                <span className={`block mt-1 text-xs ${muted}`}>{t.firstRunNetworkClosedHint || 'Recommended to start. Nobody else on your network can open it.'}</span>
              </button>
              <button onClick={() => chooseNetwork(true)} disabled={!!busy} className={option(network?.open === true)} data-first-run-network="open">
                <span className="flex items-center gap-2 text-sm font-bold"><Wifi size={15} /> {t.firstRunNetworkOpen || 'Also my phone and other devices on my network'}</span>
                <span className={`block mt-1 text-xs ${muted}`}>{t.firstRunNetworkOpenHint || 'For a dock on your phone, or your moderators at home. Windows may ask whether to let Node.js through its firewall: allow it on private networks. Until you switch sign-in on (Settings → Sign-in, once Twitch is connected), anybody on your network can open it.'}</span>
              </button>
            </div>
            {restarting && <p className="mt-4 text-xs flex items-center gap-2"><Loader2 size={14} className="animate-spin text-current-accent" /> {t.firstRunRestarting || 'Restarting with that setting. This page reconnects by itself.'}</p>}
          </div>
        )}

        {step === 'obs' && (
          <div className="mt-6">
            <h2 className="text-2xl font-black tracking-tight">{t.firstRunObsTitle || 'OBS'}</h2>
            <p className={`mt-2 text-sm ${muted}`}>{t.firstRunObsHint || 'SimonSays talks to OBS through OBS’s own WebSocket server: to switch scenes, show and hide sources, and show the overlays.'}</p>
            <div className={`mt-4 ${card} text-sm`} data-first-run-obs={obs ? (obs.status === 'connected' ? 'connected' : !obs.installed ? 'missing' : !obs.found || !obs.enabled ? 'off' : 'found') : 'looking'}>
              {!obs ? (
                <p className="flex items-center gap-2"><Loader2 size={14} className="animate-spin" /> {t.firstRunObsLooking || 'Looking for OBS…'}</p>
              ) : obs.status === 'connected' ? (
                <p className="flex items-center gap-2 text-emerald-300"><Check size={15} /> {t.firstRunObsConnected || 'Connected to OBS.'}</p>
              ) : !obs.installed ? (
                <p>{t.firstRunObsMissing || 'OBS was not found on this computer. Install it from obsproject.com and open it once, then look again — or skip this and set OBS up later on the Connections screen.'}</p>
              ) : !obs.found || !obs.enabled ? (
                <p>{t.firstRunObsOff || 'OBS is here, but its WebSocket server is off. In OBS: Tools → WebSocket Server Settings → tick “Enable WebSocket server” → Apply. Then look again.'}</p>
              ) : (
                <>
                  <p className="font-bold">{fill(obs.password ? (t.firstRunObsFoundPassword || 'OBS’s WebSocket server is on, port {port}, with a password.') : (t.firstRunObsFound || 'OBS’s WebSocket server is on, port {port}.'), { port: obs.port })}</p>
                  <p className={`mt-2 text-xs ${muted}`}>{t.firstRunObsConsent || 'Use these settings: SimonSays reads the port and password from OBS’s own settings file, here on this computer, and keeps them as its OBS connection. Nothing is sent anywhere.'}</p>
                  {obs.error && <p className="mt-2 text-xs text-amber-300 flex items-start gap-1.5"><AlertTriangle size={13} className="shrink-0 mt-0.5" /> {fill(t.firstRunObsNotReached || 'Could not reach OBS: {why}. Is OBS open?', { why: obs.error })}</p>}
                  <div className="mt-3"><Button size="sm" onClick={useObs} disabled={!!busy} icon={busy === 'use' ? <Loader2 size={14} className="animate-spin" /> : <Check size={14} />} data-first-run-obs-use>{t.firstRunObsUse || 'Use these settings'}</Button></div>
                </>
              )}
            </div>
            {obs && obs.status !== 'connected' && (
              <button onClick={lookForObs} disabled={!!busy} className="mt-3 text-xs font-bold text-current-accent hover:underline flex items-center gap-1.5" data-first-run-obs-again>
                <RefreshCw size={12} className={busy === 'obs' ? 'animate-spin' : ''} /> {t.firstRunObsAgain || 'Look again'}
              </button>
            )}
          </div>
        )}

        {step === 'done' && (
          <div className="mt-6">
            <h2 className="text-2xl font-black tracking-tight">{t.firstRunDoneTitle || 'Ready'}</h2>
            <p className={`mt-2 text-sm ${muted}`}>{t.firstRunDoneHint || 'Next, the setup steps: connect Twitch, YouTube, TikTok and Discord, one at a time, each with what to click. You can come back to them any time under Guides.'}</p>
            <div className="mt-6 flex flex-wrap gap-3">
              <Button onClick={() => finish(true)} icon={<ArrowRight size={15} />} data-first-run-to-steps>{t.firstRunToSteps || 'Open the setup steps'}</Button>
              <Button variant="ghost" onClick={() => finish(false)} data-first-run-to-dashboard>{t.firstRunToDashboard || 'Go to the dashboard'}</Button>
            </div>
          </div>
        )}

        {said && <p className="mt-4 text-xs text-rose-400" data-first-run-refused>{said}</p>}

        {step !== 'done' && (
          <div className="mt-8 flex items-center gap-3">
            {at > 0 && <Button variant="ghost" size="sm" onClick={() => go(-1)} disabled={!!busy} icon={<ArrowLeft size={14} />}>{t.firstRunBack || 'Back'}</Button>}
            <span className="flex-1" />
            <Button size="sm" onClick={() => go(1)} disabled={!!busy || restarting} icon={<ArrowRight size={14} />} data-first-run-next>
              {step === 'obs' && obs?.status !== 'connected' ? (t.firstRunSkipStep || 'Skip for now') : (t.firstRunNext || 'Next')}
            </Button>
          </div>
        )}
      </div>
    </div>
  );
};
