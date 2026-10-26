/**
 * @license
 * SPDX-License-Identifier: Apache-2.0 AND LicenseRef-Commons-Clause-1.0
 *
 * Settings → About → Who can open the dashboard: only this computer, or
 * every device on the network as well — what the first-run setup asks
 * (server/engine/first-run.js), changed later. It is HOST in the .env, read
 * at start, so changing it restarts the app; only with the launcher.
 */
import React, { useEffect, useState } from 'react';
import { Monitor, Wifi, Loader2, Check } from 'lucide-react';
import { refusalWords } from '../words';

export const NetworkPanel = ({ act, light, t }: {
  act: (op: 'state' | 'network', more?: Record<string, any>) => Promise<any>;
  light: boolean;
  t: any;
}) => {
  const [open, setOpen] = useState<boolean | null>(null);
  const [launcher, setLauncher] = useState(false);
  const [busy, setBusy] = useState(false);
  const [said, setSaid] = useState('');
  const muted = light ? 'text-zinc-600' : 'text-zinc-400';
  useEffect(() => { act('state').then((s) => { setOpen(Boolean(s?.network?.open)); setLauncher(Boolean(s?.launcher)); }).catch(() => setOpen(null)); }, []);
  if (open === null || !launcher) return null;

  const choose = async (next: boolean) => {
    if (next === open || busy) return;
    setBusy(true); setSaid('');
    try {
      await act('network', { open: next });
      const until = Date.now() + 60_000;
      while (Date.now() < until) {
        await new Promise((r) => setTimeout(r, 2500));
        try { const s = await act('state'); if (Boolean(s?.network?.open) === next) { setOpen(next); break; } } catch { /* restarting */ }
      }
    } catch (err: any) {
      setSaid(refusalWords(t, err));
    } finally {
      setBusy(false);
    }
  };
  const option = (on: boolean) => `flex-1 min-w-[12rem] text-left rounded-2xl border px-4 py-3 transition-colors ${on ? 'border-current-accent bg-current-accent/10' : light ? 'border-zinc-200 hover:border-zinc-400' : 'border-white/10 hover:border-white/25'}`;

  return (
    <div className={`mt-6 pt-6 border-t ${light ? 'border-zinc-200' : 'border-white/10'}`} data-network-panel={open ? 'open' : 'closed'}>
      <h4 className="text-sm font-black uppercase tracking-widest">{t.firstRunNetworkTitle || 'Who can open the dashboard?'}</h4>
      <div className="mt-3 flex flex-wrap gap-3">
        <button onClick={() => choose(false)} disabled={busy} className={option(!open)} data-network-choice="closed">
          <span className="flex items-center gap-2 text-sm font-bold">{!open ? <Check size={14} className="text-current-accent" /> : <Monitor size={14} />} {t.firstRunNetworkClosed || 'Only this computer'}</span>
        </button>
        <button onClick={() => choose(true)} disabled={busy} className={option(open)} data-network-choice="open">
          <span className="flex items-center gap-2 text-sm font-bold">{open ? <Check size={14} className="text-current-accent" /> : <Wifi size={14} />} {t.firstRunNetworkOpen || 'Also my phone and other devices on my network'}</span>
        </button>
      </div>
      <p className={`mt-2 text-xs ${muted}`}>{open ? (t.firstRunNetworkOpenHint || '') : (t.firstRunNetworkClosedHint || '')}</p>
      {busy && <p className="mt-2 text-xs flex items-center gap-2"><Loader2 size={14} className="animate-spin text-current-accent" /> {t.firstRunRestarting || 'Restarting with that setting. This page reconnects by itself.'}</p>}
      {said && <p className="mt-2 text-xs text-rose-400">{said}</p>}
    </div>
  );
};
