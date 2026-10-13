/**
 * @license
 * SPDX-License-Identifier: Apache-2.0 AND LicenseRef-Commons-Clause-1.0
 *
 * What the dashboard shows when the server wants to know who is there first
 * (server/api/auth.js): sign in with Twitch, as the streamer or as one of
 * their moderators, or with the owner key when Twitch cannot be reached.
 *
 * Twitch's sign-in is the browser-side one the Connections screen already
 * uses, so it comes back to the address the Twitch app has registered — the
 * page's own, without its query. So the query (?mode=dock, say) is kept for
 * the way back, and a `state` marks the token as a sign-in, which the
 * Connections handler leaves alone (hooks/useStreamSystem.ts).
 *
 * The token goes to the server, which asks Twitch whose it is, and answers
 * with a cookie; then the page loads again, signed in.
 */
import React, { useEffect, useState } from 'react';
import { KeyRound, LogIn, ShieldAlert, Loader2 } from 'lucide-react';
import { apiFetch } from '../hooks/useBackend';
import { fill, refusalWords } from '../words';

const STATE = 'signin_state';
const BACK_TO = 'signin_back_to';

async function post(path: string, body: any) {
  const res = await apiFetch(path, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
  const out = await res.json().catch(() => ({}));
  if (!res.ok) {
    const err: any = new Error(out?.error || `HTTP ${res.status}`);
    if (out?.code) err.code = out.code;
    if (out?.vars) err.vars = out.vars;
    throw err;
  }
  return out;
}

/** Back where the sign-in started, signed in: the page loads again with its cookie. */
function goBack() {
  let to = '';
  try { to = sessionStorage.getItem(BACK_TO) || ''; sessionStorage.removeItem(BACK_TO); } catch { /* a browser may refuse */ }
  window.location.replace(to || window.location.pathname + window.location.search);
}

/** Off to Twitch to sign in, and back to this page; also from Settings → Sign-in, before sign-in is switched on. */
export function startTwitchSignIn(config: { clientId: string; scopes: string[] }) {
  const nonce = `signin:${crypto.getRandomValues(new Uint32Array(4)).join('')}`;
  try {
    sessionStorage.setItem(STATE, nonce);
    sessionStorage.setItem(BACK_TO, window.location.pathname + window.location.search);
  } catch { /* a browser may refuse */ }
  const url = new URL('https://id.twitch.tv/oauth2/authorize');
  url.searchParams.set('client_id', config.clientId);
  url.searchParams.set('redirect_uri', window.location.origin + window.location.pathname);
  url.searchParams.set('response_type', 'token');
  url.searchParams.set('scope', (config.scopes || []).join(' '));
  url.searchParams.set('state', nonce);
  // Always asked which account: a moderator on the streamer's computer must not slip in as the streamer.
  url.searchParams.set('force_verify', 'true');
  window.location.assign(url.toString());
}

/** What the sign-in page and Settings → Sign-in ask the server before anyone is signed in. */
export const signInConfig = (): Promise<{ enabled: boolean; clientId: string; scopes: string[]; channel: string }> =>
  apiFetch('/auth/config').then((r) => r.json());

/**
 * Sign this browser in as the owner while sign-in is off — what anybody
 * reaching the app is then anyway — so it can be switched on from here.
 * Switching on ends every other sign-in (server/api/auth.js setEnabled).
 */
export async function claimHere() {
  await post('/auth/claim', {});
  window.location.replace(window.location.pathname + window.location.search);
}

/** Sign this browser out, and load the page again. */
export async function signOutHere() {
  await post('/auth/signout', {}).catch(() => {});
  window.location.replace(window.location.pathname + window.location.search);
}

/** `optional`: sign-in is not switched on, so this page can be left without signing in. */
export const SignInPage = ({ t, refused = false, optional = false }: { t: any; refused?: boolean; optional?: boolean }) => {
  const [config, setConfig] = useState<{ clientId: string; scopes: string[]; channel: string } | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [showKey, setShowKey] = useState(false);
  const [key, setKey] = useState('');
  const inObs = typeof window !== 'undefined' && Boolean((window as any).obsstudio);

  // Back from Twitch with a token meant for this.
  useEffect(() => {
    const hash = new URLSearchParams(window.location.hash.slice(1));
    const token = hash.get('access_token');
    // A refused sign-in comes back with its error, and its state, in the query instead.
    const query = new URLSearchParams(window.location.search);
    const state = hash.get('state') || query.get('state') || '';
    const failed = hash.get('error') || query.get('error');
    let expected = '';
    try { expected = sessionStorage.getItem(STATE) || ''; } catch { /* a browser may refuse */ }
    if (!state.startsWith('signin')) return;
    ['error', 'error_description', 'state'].forEach((k) => query.delete(k));
    window.history.replaceState({}, '', window.location.pathname + (query.toString() ? `?${query}` : ''));
    if (failed || !token) { setError(t.signInCancelled || 'Twitch didn’t finish the sign-in. Try again.'); return; }
    // Only the sign-in this page started: a token handed in by some other page is not ours to use.
    if (!expected || state !== expected) { setError(t.signInStale || 'That sign-in didn’t start here. Try again.'); return; }
    try { sessionStorage.removeItem(STATE); } catch { /* a browser may refuse */ }
    setBusy(true);
    post('/auth/twitch', { token })
      .then(goBack)
      .catch((err) => { setBusy(false); setError(refusalWords(t, err) || String(err?.message || err)); });
  }, [t]);

  useEffect(() => {
    signInConfig().then(setConfig).catch(() => setConfig({ clientId: '', scopes: [], channel: '' }));
  }, []);

  // Sign-in switched off meanwhile: nobody has to sign in, so the page loads again, as the dashboard.
  useEffect(() => {
    if (refused || optional) return undefined;
    const timer = setInterval(() => {
      signInConfig().then((c) => { if (c && c.enabled === false) window.location.reload(); }).catch(() => {});
    }, 15_000);
    return () => clearInterval(timer);
  }, [refused, optional]);

  const twitchSignIn = () => { if (config?.clientId) startTwitchSignIn(config); };

  const keySignIn = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!key.trim()) return;
    setBusy(true);
    setError('');
    try {
      await post('/auth/owner-key', { key: key.trim() });
      goBack();
    } catch (err: any) {
      setBusy(false);
      setError(refusalWords(t, err) || String(err?.message || err));
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center p-6 font-sans" data-sign-in>
      {inObs && <style>{'body, html { background: transparent !important; }'}</style>}
      <div className="max-w-md w-full rounded-3xl border border-zinc-800 bg-zinc-950/95 p-8 space-y-5 text-center shadow-2xl">
        {refused ? (
          <>
            <ShieldAlert size={28} className="mx-auto text-amber-400" />
            <h1 className="text-lg font-black text-white">{t.signInRefusedTitle || 'Not from this address'}</h1>
            <p className="text-xs text-zinc-400 leading-relaxed">{t.signInRefusedHint || 'The app only takes connections from its own address. Open the dashboard at the address the app gave you.'}</p>
          </>
        ) : (
          <>
            <LogIn size={28} className="mx-auto text-current-accent" />
            <h1 className="text-lg font-black text-white">{t.signInTitle || 'Sign in'}</h1>
            <p className="text-xs text-zinc-400 leading-relaxed">
              {config?.channel
                ? fill(t.signInHint || 'Sign in with Twitch: {channel}, or one of {channel}’s moderators.', { channel: config.channel })
                : (t.signInHintNoChannel || 'Sign in with Twitch, as the streamer or one of their moderators.')}
            </p>
            {busy ? (
              <Loader2 className="w-6 h-6 mx-auto text-current-accent animate-spin" />
            ) : (
              <button
                type="button"
                onClick={twitchSignIn}
                disabled={!config?.clientId}
                className="w-full px-4 py-3 rounded-xl bg-[#9146FF] disabled:opacity-40 text-white text-xs font-black uppercase tracking-widest"
                data-sign-in-twitch
              >
                {t.signInTwitch || 'Sign in with Twitch'}
              </button>
            )}
            {config && !config.clientId && <p className="text-[11px] text-zinc-500">{t.signInNoTwitch || 'Twitch isn’t connected on this app yet, so only the owner key works.'}</p>}
            {error && <p className="text-xs text-red-400 leading-relaxed" data-sign-in-error>{error}</p>}
            {showKey ? (
              <form onSubmit={keySignIn} className="space-y-2 text-left">
                <label className="block text-[10px] font-black uppercase tracking-widest text-zinc-500" htmlFor="owner-key">{t.signInKeyLabel || 'Owner key'}</label>
                <input
                  id="owner-key"
                  type="password"
                  autoComplete="current-password"
                  value={key}
                  onChange={(e) => setKey(e.target.value)}
                  className="w-full bg-zinc-900 border border-zinc-800 rounded-xl px-3 py-2 text-sm text-white"
                />
                <p className="text-[11px] text-zinc-500 leading-relaxed">{t.signInKeyHint || 'It’s in Settings → Sign-in, on a device already signed in, or in data/auth_secrets.json where the app runs.'}</p>
                <button type="submit" disabled={busy || !key.trim()} className="w-full px-4 py-2 rounded-xl bg-zinc-800 disabled:opacity-40 text-white text-xs font-black uppercase tracking-widest" data-sign-in-key-go>
                  {t.signInKeyGo || 'Sign in with the key'}
                </button>
              </form>
            ) : (
              <button type="button" onClick={() => setShowKey(true)} className="inline-flex items-center gap-1.5 text-[11px] text-zinc-500 hover:text-zinc-300" data-sign-in-key>
                <KeyRound size={12} /> {t.signInUseKey || 'I’m the streamer and Twitch isn’t working'}
              </button>
            )}
            {optional && !busy && (
              <button type="button" onClick={goBack} className="block mx-auto text-[11px] text-zinc-500 hover:text-zinc-300 underline" data-sign-in-back>
                {t.signInBack || 'Back to the dashboard'}
              </button>
            )}
          </>
        )}
      </div>
    </div>
  );
};
