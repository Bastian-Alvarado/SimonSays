/**
 * @license
 * SPDX-License-Identifier: Apache-2.0 AND LicenseRef-Commons-Clause-1.0
 *
 * Settings → Sign-in (server/api/auth.js).
 *
 * The streamer's: switch sign-in on or off, see and change the owner key and
 * the page key, and sign out. A moderator sees only who they are signed in
 * as, and signing out.
 *
 * Switching on is offered only to somebody signed in — with Twitch or the
 * owner key — never merely because sign-in is off, so it can never lock out
 * the one who switched it on; the server refuses it the same way.
 */
import React, { useEffect, useState } from 'react';
import { ShieldCheck, LogIn, LogOut, KeyRound, Eye, EyeOff, Copy, RefreshCw } from 'lucide-react';
import { Button } from './Button';
import { copyText } from '../utils';
import { fill, refusalWords } from '../words';
import { startTwitchSignIn, signInConfig, signOutHere, claimHere } from './SignInPage';
import type { Me } from '../hooks/useBackend';

interface Props {
  auth: {
    me: Me | null;
    state: { enabled: boolean; ownerKey: string; pageKey: string } | null;
    control: (payload: any) => Promise<any>;
  };
  light: boolean;
  panelClass: string;
  t: any;
}

const KeyRow = ({ label, hint, value, onNew, t }: { label: string; hint: string; value: string; onNew?: () => void; t: any }) => {
  const [shown, setShown] = useState(false);
  const [copied, setCopied] = useState(false);
  return (
    <div className="space-y-1.5">
      <div className="flex items-center gap-2">
        <KeyRound size={14} className="text-current-accent" />
        <span className="text-xs font-black uppercase tracking-widest text-zinc-400">{label}</span>
      </div>
      <div className="flex flex-wrap items-center gap-2">
        <code className="flex-1 min-w-[10rem] text-[11px] font-mono bg-zinc-900/70 border border-zinc-800 rounded-xl px-3 py-2 text-zinc-300 break-all">
          {shown ? value : '•'.repeat(24)}
        </code>
        <button type="button" onClick={() => setShown((s) => !s)} className="p-2 rounded-lg bg-zinc-800 text-zinc-300 hover:text-white" title={shown ? t.signInHideKey || 'Hide' : t.signInShowKey || 'Show'}>
          {shown ? <EyeOff size={14} /> : <Eye size={14} />}
        </button>
        <button type="button" onClick={() => { copyText(value); setCopied(true); setTimeout(() => setCopied(false), 1500); }} className="p-2 rounded-lg bg-zinc-800 text-zinc-300 hover:text-white" title={t.copy || 'Copy'}>
          {copied ? <span className="text-[10px] font-bold px-1">{t.copied || 'Copied'}</span> : <Copy size={14} />}
        </button>
        {onNew && (
          <button type="button" onClick={onNew} className="p-2 rounded-lg bg-zinc-800 text-zinc-300 hover:text-white" title={t.signInNewKey || 'Make a new one'}>
            <RefreshCw size={14} />
          </button>
        )}
      </div>
      <p className="text-[11px] text-zinc-500 leading-relaxed">{hint}</p>
    </div>
  );
};

export const SignInPanel = ({ auth, light, panelClass, t }: Props) => {
  const { me, state } = auth;
  const [note, setNote] = useState('');
  const [busy, setBusy] = useState(false);
  const [twitchApp, setTwitchApp] = useState<{ clientId: string; scopes: string[] } | null>(null);
  useEffect(() => { signInConfig().then(setTwitchApp).catch(() => setTwitchApp(null)); }, []);
  if (!me) return null;

  const owner = me.role === 'owner';
  const signedIn = me.via !== 'open';
  // A sign-in with the owner key has no Twitch name to say.
  const who = me.name || me.login;

  const act = async (payload: any, done?: string) => {
    setBusy(true);
    setNote('');
    try {
      await auth.control(payload);
      if (done) setNote(done);
    } catch (err: any) {
      setNote(refusalWords(t, err) || String(err?.message || err));
    } finally {
      setBusy(false);
    }
  };

  const toggle = () => {
    if (!state) return;
    if (!state.enabled && !window.confirm(t.signInEnableConfirm || 'Switch sign-in on?\n\nFrom then on only you and your Twitch moderators can open the dashboard and the docks. Everybody else signed in signs in again, and the owner key changes. Pages in OBS need links with the page key: copy them again from their screens if you copied them before this update.')) return;
    if (state.enabled && !window.confirm(t.signInDisableConfirm || 'Switch sign-in off?\n\nAnybody who can reach this app’s address will have all of it again.')) return;
    act({ op: 'enable', on: !state.enabled });
  };

  const newKey = (which: 'pageKey' | 'ownerKey') => {
    const ask = which === 'pageKey'
      ? (t.signInNewPageKeyConfirm || 'Make a new page key?\n\nEvery page in OBS stops showing until you paste its new link.')
      : (t.signInNewOwnerKeyConfirm || 'Make a new owner key?\n\nThe old one stops working at once, wherever it is saved.');
    if (window.confirm(ask)) act({ op: 'new-key', which }, t.signInNewKeyDone || 'Done: the old one no longer works.');
  };

  return (
    <section className={`glass-panel p-6 sm:p-8 rounded-[40px] border ${panelClass}`} data-settings-sign-in>
      <div className="flex items-center gap-3 mb-6">
        <ShieldCheck className="text-current-accent" />
        <h3 className="text-xl font-extrabold uppercase tracking-tight">{t.signInSection || 'Sign-in'}</h3>
      </div>

      <div className="space-y-6">
        {/* Who this is. */}
        <div className="flex flex-wrap items-center gap-3">
          <p className={`text-sm flex-1 min-w-[12rem] ${light ? 'text-zinc-700' : 'text-zinc-300'}`} data-sign-in-who={me.role}>
            {signedIn && !who
              ? (t.signInYouKey || 'Signed in on this browser, as the streamer.')
              : signedIn
              ? fill(owner ? (t.signInYouOwner || 'Signed in as {who}, the streamer.') : (t.signInYouMod || 'Signed in as {who}, a moderator.'), { who })
              : (t.signInYouOpen || 'Not signed in: with sign-in off, nobody has to.')}
          </p>
          {signedIn ? (
            <Button size="sm" variant="outline" onClick={() => signOutHere()} icon={<LogOut size={14} />} data-sign-in-out>{t.signInSignOut || 'Sign out'}</Button>
          ) : (
            <>
              {twitchApp?.clientId && (
                <Button size="sm" onClick={() => startTwitchSignIn(twitchApp)} icon={<LogIn size={14} />} data-sign-in-start>{t.signInTwitch || 'Sign in with Twitch'}</Button>
              )}
              {owner && state && !state.enabled && (
                <Button size="sm" variant="outline" disabled={busy} onClick={() => { setBusy(true); claimHere().catch((err) => { setBusy(false); setNote(refusalWords(t, err) || String(err?.message || err)); }); }} icon={<KeyRound size={14} />} data-sign-in-claim>
                  {t.signInClaim || 'Sign in on this browser'}
                </Button>
              )}
            </>
          )}
        </div>

        {owner && state && (
          <>
            {/* On or off. */}
            <div className={`rounded-3xl border p-5 ${light ? 'bg-zinc-50 border-zinc-200' : 'bg-zinc-900/50 border-zinc-800'}`}>
              <div className="flex flex-wrap items-center gap-4">
                <div className="flex-1 min-w-[12rem]">
                  <p className={`font-bold ${light ? 'text-zinc-900' : 'text-white'}`} data-sign-in-state={state.enabled ? 'on' : 'off'}>
                    {state.enabled ? (t.signInOn || 'Sign-in is on') : (t.signInOff || 'Sign-in is off')}
                  </p>
                  <p className="text-xs text-zinc-500 leading-relaxed mt-1">
                    {state.enabled
                      ? (t.signInOnHint || 'Only you and your Twitch moderators can open the dashboard and the docks; pages in OBS show with the page key in their links.')
                      : (t.signInOffHint || 'Anybody who can reach this app’s address — on your network, or through a public address — has all of it.')}
                  </p>
                </div>
                <Button onClick={toggle} disabled={busy || (!state.enabled && !signedIn)} data-sign-in-toggle>
                  {state.enabled ? (t.signInTurnOff || 'Switch off') : (t.signInTurnOn || 'Switch on')}
                </Button>
              </div>
              {!state.enabled && !signedIn && (
                <p className="text-[11px] text-amber-300/90 mt-3" data-sign-in-first>{t.signInFirstHint || 'Sign in first — with Twitch, or on this browser — so switching it on can’t lock you out.'}</p>
              )}
            </div>

            {/* Only to a sign-in of your own: with sign-in off, everybody would see it (server/api/auth.js authState). */}
            {state.ownerKey && (
              <KeyRow
                label={t.signInOwnerKey || 'Owner key'}
                hint={t.signInOwnerKeyHint || 'Your way in when Twitch isn’t: type it on the sign-in page. Keep it to yourself.'}
                value={state.ownerKey}
                onNew={() => newKey('ownerKey')}
                t={t}
              />
            )}
            <KeyRow
              label={t.signInPageKey || 'Page key'}
              hint={t.signInPageKeyHint || 'In every link to a page OBS shows, so it can draw the stream without signing in. It lets a page show the stream, nothing else.'}
              value={state.pageKey}
              onNew={signedIn ? () => newKey('pageKey') : undefined}
              t={t}
            />
          </>
        )}

        {note && <p className="text-xs font-bold text-zinc-400 bg-zinc-900/60 border border-zinc-800 rounded-2xl px-4 py-3" data-sign-in-note>{note}</p>}
      </div>
    </section>
  );
};
