/**
 * @license
 * SPDX-License-Identifier: Apache-2.0 AND LicenseRef-Commons-Clause-1.0
 *
 * Settings → About: the details a bug report needs, copied for the streamer to
 * paste into the report themselves. The server writes them
 * (server/engine/diagnostics.js) with keys, the streamer's account names and
 * folders taken out; this page adds its own version, language and browser, and
 * shows the whole text before anybody pastes it anywhere. A warning can still
 * name a viewer, so the text can be changed here and copied again. Nothing is
 * sent.
 *
 * Copying: the clipboard API is there only on a secure page (https, or this
 * same computer), and a dashboard opened at its LAN address is neither, so the
 * old select-and-copy is the second try. A browser may also refuse both once
 * the click is a moment old (the details are fetched first), so the text
 * stays on screen with a Copy button of its own, a fresh click, and can be
 * selected by hand.
 */
import React, { useState } from 'react';
import { ClipboardCopy, Check, ExternalLink, AlertTriangle, Loader2 } from 'lucide-react';
import { Button } from './Button';
import { VERSION } from '../../shared/version.js';
import { UPDATE_REPO } from '../../shared/edition.js';
import { apiFetch } from '../hooks/useBackend';
import { refusalWords } from '../words';

interface BugReportPanelProps {
  language: string;
  light: boolean;
  t: any;
}

/** The old way: a hidden text box, selected and copied. Works on a page that is not secure. */
function copyOld(text: string): boolean {
  const box = document.createElement('textarea');
  box.value = text;
  box.setAttribute('readonly', '');
  box.style.position = 'fixed';
  box.style.opacity = '0';
  document.body.appendChild(box);
  box.select();
  let ok = false;
  try { ok = document.execCommand('copy'); } catch { ok = false; }
  box.remove();
  return ok;
}

async function copyText(text: string): Promise<boolean> {
  try {
    if (navigator.clipboard && window.isSecureContext) {
      await navigator.clipboard.writeText(text);
      return true;
    }
  } catch { /* the old way, below */ }
  return copyOld(text);
}

export const BugReportPanel: React.FC<BugReportPanelProps> = ({ language, light, t }) => {
  const [text, setText] = useState('');
  const [state, setState] = useState<'idle' | 'busy' | 'copied' | 'select' | 'edited' | 'failed'>('idle');
  const [error, setError] = useState('');
  const muted = light ? 'text-zinc-600' : 'text-zinc-400';

  const gather = async () => {
    setState('busy');
    setError('');
    try {
      const res = await apiFetch('/api/diagnostics');
      const body = await res.json().catch(() => ({}));
      if (!res.ok || typeof body.text !== 'string') throw body;
      // Never the address it was opened at: that can be the streamer's own web address.
      const here = ['localhost', '127.0.0.1', '[::1]'].includes(window.location.hostname) ? 'on the same computer' : 'from another device';
      const full = `${body.text}\n\nPage: version ${VERSION}, ${language === 'es' ? 'Spanish' : 'English'}, opened ${here}\nBrowser: ${navigator.userAgent}`;
      setText(full);
      setState((await copyText(full)) ? 'copied' : 'select');
    } catch (err: any) {
      setError(refusalWords(t, err) || t.bugReportFailed || 'The server did not send the details.');
      setState('failed');
    }
  };

  const copyAgain = async () => setState((await copyText(text)) ? 'copied' : 'select');
  // While new details are fetched, the old ones are not shown under a word that is no longer true.
  const shown = state === 'copied' || state === 'select' || state === 'edited';

  return (
    <div className={`mt-6 pt-6 border-t ${light ? 'border-zinc-200' : 'border-white/10'}`} data-bug-report={state}>
      <h4 className="text-sm font-black uppercase tracking-widest">{t.bugReportTitle || 'Report a problem'}</h4>
      <p className={`mt-2 text-xs ${muted}`}>
        {t.bugReportNote || 'Copies what a bug report needs: the version, your system, which platforms are connected and the latest errors, with keys, passwords and your accounts’ names taken out. Nothing is sent anywhere. Read it before you paste it, and change anything you would rather not share.'}
      </p>
      <div className="mt-4 flex flex-wrap items-center gap-3">
        <Button size="sm" onClick={gather} disabled={state === 'busy'} icon={state === 'busy' ? <Loader2 size={14} className="animate-spin" /> : <ClipboardCopy size={14} />} data-bug-report-copy>
          {state === 'busy' ? (t.bugReportBusy || 'Getting the details…') : (t.bugReportCopy || 'Copy details for a bug report')}
        </Button>
        {UPDATE_REPO ? (
          <a href={`https://github.com/${UPDATE_REPO}/issues/new/choose`} target="_blank" rel="noopener noreferrer" className="flex items-center gap-1.5 text-xs font-bold text-current-accent hover:underline" data-bug-report-open>
            <ExternalLink size={14} /> {t.bugReportOpen || 'Report it on GitHub'}
          </a>
        ) : null}
      </div>

      {state === 'failed' && (
        <div className="mt-4 flex items-start gap-2 rounded-2xl border border-amber-500/30 bg-amber-500/5 px-4 py-3 text-xs text-amber-300" data-bug-report-failed>
          <AlertTriangle size={14} className="shrink-0 mt-0.5" />
          <span>{error}</span>
        </div>
      )}

      {text && shown && (
        <div className="mt-4">
          <div className="flex flex-wrap items-center gap-3 mb-2">
            {state === 'copied' ? (
              <p className="flex items-center gap-1.5 text-xs font-bold text-emerald-400 flex-1 min-w-[12rem]" data-bug-report-copied>
                <Check size={14} /> {t.bugReportCopied || 'Copied. Paste it into your bug report.'}
              </p>
            ) : state === 'edited' ? (
              <p className={`text-xs ${muted} flex-1 min-w-[12rem]`} data-bug-report-edited>
                {t.bugReportEdited || 'Changed. Press Copy to copy the new text.'}
              </p>
            ) : (
              <p className={`text-xs ${muted} flex-1 min-w-[12rem]`} data-bug-report-select>
                {t.bugReportSelect || 'Your browser did not let the page copy it. Press Copy, or select the text below and copy it.'}
              </p>
            )}
            <Button size="sm" variant="secondary" onClick={copyAgain} icon={<ClipboardCopy size={14} />}>{t.bugReportCopyAgain || 'Copy'}</Button>
          </div>
          {/* Changeable: a viewer a warning happened to name can be taken out before it is copied again. */}
          <textarea
            value={text}
            rows={12}
            spellCheck={false}
            onChange={(e) => { setText(e.target.value); setState('edited'); }}
            className={`w-full rounded-2xl border px-4 py-3 font-mono text-[11px] leading-relaxed resize-y ${light ? 'border-zinc-200 bg-zinc-50 text-zinc-800' : 'border-white/10 bg-black/40 text-zinc-300'}`}
            data-bug-report-text
          />
        </div>
      )}
    </div>
  );
};
