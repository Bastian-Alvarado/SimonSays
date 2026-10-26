/**
 * @license
 * SPDX-License-Identifier: Apache-2.0 AND LicenseRef-Commons-Clause-1.0
 *
 * Settings → Data → Automatic backups (server/engine/auto-backups.js): the
 * data folder, copied whole once a day, before every update, and before a
 * copy is brought in or a backup put back — listed newest first, with one to
 * take now and any to put back. Putting one back restarts the app (the
 * launcher does it while the server is stopped), so it is confirmed first,
 * and what is there now is kept as a backup of its own.
 */
import React, { useEffect, useState } from 'react';
import { History, Loader2, RotateCcw, Check, AlertTriangle, X, Plus } from 'lucide-react';
import { Button } from './Button';
import { fill, refusalWords } from '../words';

interface Backup { name: string; kind: string; at: number; version: string; updateTo: string; bytes: number; restorable: boolean }
interface State { list: Backup[]; dir: string; keep: number; canRestore: boolean; lastDaily: number; restored: { ok: boolean; backup: string; at: number; kept?: string; error?: string; why?: string } | null; busy: boolean }

const KIND_WORDS: Record<string, [string, string]> = {
  daily: ['autoBackupDaily', 'Daily'],
  manual: ['autoBackupManual', 'Taken by you'],
  update: ['autoBackupUpdate', 'Before updating to {version}'],
  'bring-in': ['autoBackupBringIn', 'Before bringing a copy in'],
  restore: ['autoBackupRestore', 'Before putting a backup back'],
};

const mb = (n: number) => `${(n / 1024 / 1024).toFixed(1)} MB`;

export const AutoBackupsPanel = ({ act, language, light, t }: {
  act: (op: 'list' | 'take' | 'restore' | 'dismiss', name?: string) => Promise<any>;
  language: string;
  light: boolean;
  t: any;
}) => {
  const [state, setState] = useState<State | null>(null);
  const [busy, setBusy] = useState('');
  const [confirming, setConfirming] = useState('');
  const [restarting, setRestarting] = useState(false);
  const [said, setSaid] = useState('');
  const muted = light ? 'text-zinc-600' : 'text-zinc-400';
  const when = (at: number) => new Date(at).toLocaleString(language, { dateStyle: 'medium', timeStyle: 'short' });

  const load = () => act('list').then(setState).catch(() => setState(null));
  useEffect(() => { load(); }, []);
  // Restarting to put one back: asked again until the server is back and says how it went.
  useEffect(() => {
    if (!restarting) return undefined;
    const before = state?.restored?.at || 0;
    const timer = setInterval(() => {
      act('list').then((s: State) => { if ((s?.restored?.at || 0) !== before) { setState(s); setRestarting(false); } }).catch(() => { /* still restarting */ });
    }, 3000);
    return () => clearInterval(timer);
  }, [restarting]);
  if (!state) return null;

  const takeNow = async () => {
    setBusy('take'); setSaid('');
    try { setState(await act('take')); } catch (err: any) { setSaid(refusalWords(t, err)); } finally { setBusy(''); }
  };
  const restore = async (name: string) => {
    setBusy(name); setSaid(''); setConfirming('');
    try { await act('restore', name); setRestarting(true); } catch (err: any) { setSaid(refusalWords(t, err)); } finally { setBusy(''); }
  };
  const dismiss = async () => { try { setState(await act('dismiss')); } catch { /* stays */ } };
  const kindWords = (b: Backup) => fill(t[KIND_WORDS[b.kind]?.[0]] || KIND_WORDS[b.kind]?.[1] || b.kind, { version: b.updateTo });
  const done = state.restored;

  return (
    <div className={`mt-8 pt-6 border-t ${light ? 'border-zinc-200' : 'border-white/10'}`} data-auto-backups>
      <div className="flex flex-wrap items-center gap-3">
        <History size={18} className="text-current-accent" />
        <h4 className="text-sm font-black uppercase tracking-widest flex-1 min-w-[10rem]">{t.autoBackupsTitle || 'Automatic backups'}</h4>
        <Button size="sm" variant="secondary" onClick={takeNow} disabled={!!busy || restarting} icon={busy === 'take' ? <Loader2 size={14} className="animate-spin" /> : <Plus size={14} />} data-auto-backups-take>
          {t.autoBackupsTake || 'Back up now'}
        </Button>
      </div>
      <p className={`mt-2 text-xs ${muted}`}>{fill(t.autoBackupsHint || 'Everything in your data — layouts, commands, accounts, settings — copied once a day and before every update, the newest {keep} of each kept, here on this computer. Pictures you uploaded are not in them.', { keep: state.keep })}</p>
      <p className={`mt-1 text-[11px] ${muted} opacity-70 break-all`}>{state.dir}</p>

      {done && (
        <div className={`mt-4 flex items-start gap-2 rounded-2xl border px-4 py-3 text-xs ${done.ok ? 'text-emerald-300 border-emerald-500/30 bg-emerald-500/5' : 'text-amber-300 border-amber-500/30 bg-amber-500/5'}`} data-auto-backups-restored={done.ok ? 'ok' : done.error}>
          {done.ok ? <Check size={14} className="shrink-0 mt-0.5" /> : <AlertTriangle size={14} className="shrink-0 mt-0.5" />}
          <span className="flex-1 break-words">
            {done.ok
              ? fill(t.autoBackupsRestoredOk || 'Put back the backup from {when}. What was here before is kept as a backup of its own, at the top of the list.', { when: when(state.list.find((b) => b.name === done.backup)?.at || done.at) })
              : fill(t.autoBackupsRestoredFailed || 'That backup could not be put back ({why}). Nothing was changed.', { why: done.error === 'stale' ? (t.bringInStale || 'it was asked while an older launcher was running; ask again') : done.why || done.error || '' })}
          </span>
          <button onClick={dismiss} className="p-0.5 opacity-60 hover:opacity-100" title={t.close || 'Close'}><X size={12} /></button>
        </div>
      )}
      {restarting && <p className="mt-4 text-xs flex items-center gap-2" data-auto-backups-restarting><Loader2 size={14} className="animate-spin text-current-accent" /> {t.autoBackupsRestarting || 'Restarting to put it back. This page reconnects by itself.'}</p>}

      {state.list.length === 0 ? (
        <p className={`mt-4 text-xs ${muted}`} data-auto-backups-none>{t.autoBackupsNone || 'None yet: the first daily one is taken a couple of minutes after the app starts.'}</p>
      ) : (
        <ul className={`mt-4 divide-y ${light ? 'divide-zinc-200' : 'divide-white/5'} rounded-2xl border ${light ? 'border-zinc-200' : 'border-white/10'} max-h-80 overflow-y-auto`}>
          {state.list.map((b) => (
            <li key={b.name} className="flex flex-wrap items-center gap-x-3 gap-y-1 px-4 py-2.5" data-auto-backup={b.kind}>
              <span className="text-xs font-bold min-w-[9rem]">{when(b.at)}</span>
              <span className={`text-xs flex-1 min-w-[8rem] ${muted}`}>{kindWords(b)}{b.version ? ` · ${b.version}` : ''} · {mb(b.bytes)}</span>
              {state.canRestore && b.restorable && (confirming === b.name ? (
                <span className="flex items-center gap-2">
                  <Button size="sm" variant="danger" onClick={() => restore(b.name)} disabled={!!busy || restarting} data-auto-backup-confirm>{t.autoBackupsRestoreGo || 'Put it back and restart'}</Button>
                  <Button size="sm" variant="ghost" onClick={() => setConfirming('')}>{t.cancel || 'Cancel'}</Button>
                </span>
              ) : (
                <button onClick={() => setConfirming(b.name)} disabled={!!busy || restarting} className="text-xs font-bold text-current-accent hover:underline flex items-center gap-1 disabled:opacity-40" data-auto-backup-restore={b.name}>
                  <RotateCcw size={12} /> {t.autoBackupsRestore || 'Put back'}
                </button>
              ))}
            </li>
          ))}
        </ul>
      )}
      {confirming && <p className={`mt-3 text-xs ${muted}`} data-auto-backups-confirm-note>{t.autoBackupsConfirm || 'Everything in your data goes back to how it was then: layouts, commands, accounts and settings made since are replaced. What is here now is kept as a backup first, so this can be undone. The app restarts for a few seconds.'}</p>}
      {!state.canRestore && state.list.length > 0 && <p className={`mt-3 text-[11px] ${muted}`}>{t.autoBackupsNoLauncher || 'To put one back from here, start the app with its launcher (npm start, or the installed SimonSays).'}</p>}
      {said && <p className="mt-3 text-xs text-rose-400" data-auto-backups-refused>{said}</p>}
    </div>
  );
};
