/**
 * @license
 * SPDX-License-Identifier: Apache-2.0 AND LicenseRef-Commons-Clause-1.0
 *
 * Settings → About → Your things: the folder this copy keeps the streamer's
 * things in, and bringing in an existing SimonSays (server/engine/install.js).
 *
 * Somebody who ran SimonSays from a zip or git copy before pastes that
 * folder; what is in it is shown first — how many layouts, commands and so
 * on, which accounts were signed in — and only then is it brought in, with a
 * second press, since the app restarts for the launcher to copy it. What is
 * here now goes to a backup first. Only on a copy started by the launcher.
 */
import React, { useEffect, useState } from 'react';
import { FolderInput, FolderOpen, Search, Check, AlertTriangle, X, Loader2 } from 'lucide-react';
import { Button } from './Button';
import { fill, refusalWords } from '../words';

interface Where {
  launcher: boolean;
  installed: boolean;
  home: string;
  app: string;
  dataDir: string;
  broughtIn: { ok: boolean; from: string; at: number; backup?: string; error?: string; why?: string } | null;
}
interface Look {
  root: string;
  version: string;
  env: boolean;
  assets: string;
  counts: { layouts: number; commands: number; actions: number; alerts: number };
  accounts: string[];
}

export const BringInPanel = ({ act, language, light, t }: {
  act: (op: 'where' | 'look' | 'bring_in' | 'dismiss', folder?: string) => Promise<any>;
  language: string;
  light: boolean;
  t: any;
}) => {
  const [where, setWhere] = useState<Where | null>(null);
  const [folder, setFolder] = useState('');
  const [look, setLook] = useState<Look | null>(null);
  const [confirming, setConfirming] = useState(false);
  const [busy, setBusy] = useState<'' | 'look' | 'bring'>('');
  const [restarting, setRestarting] = useState(false);
  const [refused, setRefused] = useState('');
  const muted = light ? 'text-zinc-600' : 'text-zinc-400';
  const box = `rounded-2xl border ${light ? 'border-zinc-200' : 'border-white/10'}`;

  useEffect(() => { act('where').then(setWhere).catch(() => setWhere(null)); }, []);
  // Restarting: asked again every few seconds until the server is back and says how it went.
  useEffect(() => {
    if (!restarting) return undefined;
    const before = where?.broughtIn?.at || 0;
    const timer = setInterval(() => {
      act('where').then((w: Where) => {
        if ((w?.broughtIn?.at || 0) === before) return;
        setWhere(w); setRestarting(false); setLook(null); setFolder('');
      }).catch(() => { /* still restarting */ });
    }, 3000);
    return () => clearInterval(timer);
  }, [restarting]);
  if (!where?.launcher) return null;

  const lookNow = async () => {
    setBusy('look'); setRefused(''); setLook(null); setConfirming(false);
    try { setLook(await act('look', folder)); } catch (err: any) { setRefused(refusalWords(t, err)); } finally { setBusy(''); }
  };
  const bringNow = async () => {
    setBusy('bring'); setRefused('');
    try { await act('bring_in', folder); setRestarting(true); } catch (err: any) { setRefused(refusalWords(t, err)); } finally { setBusy(''); setConfirming(false); }
  };
  const dismiss = async () => { try { setWhere(await act('dismiss')); } catch { /* stays */ } };
  const done = where.broughtIn;
  const when = done ? new Date(done.at).toLocaleString(language, { dateStyle: 'medium', timeStyle: 'short' }) : '';
  const counts = look ? [
    [look.counts.layouts, t.bringInLayouts || 'layouts'], [look.counts.commands, t.bringInCommands || 'commands'],
    [look.counts.actions, t.bringInActions || 'actions'], [look.counts.alerts, t.bringInAlerts || 'alerts'],
  ].filter(([n]) => Number(n) > 0).map(([n, w]) => `${n} ${w}`).join(' · ') : '';

  return (
    <div className={`mt-6 pt-6 border-t ${light ? 'border-zinc-200' : 'border-white/10'}`} data-bring-in>
      <h4 className="text-sm font-black uppercase tracking-widest">{t.bringInWhereTitle || 'Your things'}</h4>
      <p className={`mt-2 text-xs ${muted} flex items-start gap-1.5`}>
        <FolderOpen size={14} className="shrink-0 mt-0.5" />
        <span>{t.bringInWhere || 'Your data, pictures and settings are kept in'} <code className="break-all font-mono text-[11px]" data-bring-in-home>{where.home}</code></span>
      </p>
      {where.installed && <p className={`mt-1 text-[11px] ${muted} opacity-70`} data-bring-in-installed>{t.bringInInstalledNote || 'Apart from the program, so reinstalling or uninstalling it keeps them.'}</p>}

      {done && (
        <div className={`mt-4 flex items-start gap-2 ${box} px-4 py-3 text-xs ${done.ok ? 'text-emerald-300 border-emerald-500/30 bg-emerald-500/5' : 'text-amber-300 border-amber-500/30 bg-amber-500/5'}`} data-bring-in-result={done.ok ? 'ok' : done.error}>
          {done.ok ? <Check size={14} className="shrink-0 mt-0.5" /> : <AlertTriangle size={14} className="shrink-0 mt-0.5" />}
          <span className="flex-1 break-words">
            {done.ok
              ? fill(done.backup ? (t.bringInDoneBackup || 'Brought in {from} on {when}. What was here before is kept in {backup}.') : (t.bringInDone || 'Brought in {from} on {when}.'), { from: done.from, when, backup: done.backup || '' })
              : fill(t.bringInFailed || 'Could not bring in {from}: {why}. Nothing here was changed.', {
                from: done.from || '',
                why: done.error === 'not_found' ? (t.refuseInstallNotFound || 'no SimonSays data was found in that folder')
                  : done.error === 'same_place' ? (t.refuseInstallSamePlace || 'that is this copy’s own folder')
                  : done.error === 'stale' ? (t.bringInStale || 'it was asked while an older launcher was running; ask again')
                  : done.why || done.error || '',
              })}
          </span>
          <button onClick={dismiss} className="p-0.5 opacity-60 hover:opacity-100" title={t.close || 'Close'}><X size={12} /></button>
        </div>
      )}

      <h4 className="mt-6 text-sm font-black uppercase tracking-widest">{t.bringInTitle || 'Bring in my existing SimonSays'}</h4>
      <p className={`mt-2 text-xs ${muted}`}>{t.bringInHint || 'Used SimonSays before from a folder of its own (a zip or git copy)? Paste that folder here. Its layouts, commands, accounts, pictures and .env are copied into this one; what is here now is kept in a backup. Close the old copy first.'}</p>
      {restarting ? (
        <p className="mt-4 text-xs flex items-center gap-2" data-bring-in-restarting><Loader2 size={14} className="animate-spin text-current-accent" /> {t.bringInRestarting || 'Restarting to bring it in. This page reconnects by itself.'}</p>
      ) : (
        <>
          <div className="mt-3 flex flex-wrap gap-2">
            <input value={folder} onChange={(e) => { setFolder(e.target.value); setLook(null); setConfirming(false); }} onKeyDown={(e) => { if (e.key === 'Enter' && folder.trim()) lookNow(); }}
              placeholder="C:\Users\you\SimonSays" spellCheck={false}
              className={`flex-1 min-w-[14rem] rounded-xl px-3 py-2 text-xs font-mono border ${light ? 'bg-white border-zinc-300' : 'bg-black/30 border-white/10'}`} data-bring-in-folder />
            <Button size="sm" variant="secondary" onClick={lookNow} disabled={!folder.trim() || !!busy} icon={busy === 'look' ? <Loader2 size={14} className="animate-spin" /> : <Search size={14} />} data-bring-in-look>
              {t.bringInLook || 'Look inside'}
            </Button>
          </div>
          {look && (
            <div className={`mt-4 ${box} bg-current-accent/10 px-4 py-4`} data-bring-in-found>
              <p className="text-sm font-bold break-all">{look.version ? fill(t.bringInFoundVersion || 'SimonSays {version} in {root}', look) : fill(t.bringInFound || 'SimonSays in {root}', look)}</p>
              <p className={`mt-1 text-xs ${muted}`}>{counts || (t.bringInEmpty || 'No layouts, commands, actions or alerts yet.')}</p>
              <p className={`mt-1 text-xs ${muted}`}>
                {look.accounts.length ? fill(t.bringInAccounts || 'Signed in: {list}', { list: look.accounts.join(', ') }) : (t.bringInNoAccounts || 'No accounts signed in.')}
                {' · '}{look.env ? (t.bringInEnv || 'its .env comes too') : (t.bringInNoEnv || 'no .env')}
                {' · '}{look.assets ? (t.bringInAssets || 'its pictures come too') : (t.bringInNoAssets || 'no pictures')}
              </p>
              <div className="mt-4 flex flex-wrap items-center gap-3">
                {!confirming ? (
                  <Button size="sm" onClick={() => setConfirming(true)} icon={<FolderInput size={14} />} data-bring-in-go>{t.bringInGo || 'Bring it in'}</Button>
                ) : (
                  <>
                    <Button size="sm" onClick={bringNow} disabled={busy === 'bring'} icon={<FolderInput size={14} />} data-bring-in-confirm>{t.bringInConfirmGo || 'Bring it in and restart'}</Button>
                    <Button size="sm" variant="ghost" onClick={() => setConfirming(false)}>{t.cancel || 'Cancel'}</Button>
                  </>
                )}
              </div>
              {confirming && <p className={`mt-3 text-xs ${muted}`} data-bring-in-confirm-note>{t.bringInConfirm || 'The app restarts for a few seconds; overlays and docks come back by themselves. Everything here now — layouts, commands, accounts — is replaced by that copy’s, and kept in a backup.'}</p>}
            </div>
          )}
        </>
      )}
      {refused && <p className="mt-3 text-xs text-rose-400" data-bring-in-refused>{refused}</p>}
    </div>
  );
};
