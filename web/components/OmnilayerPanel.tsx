/**
 * @license
 * SPDX-License-Identifier: Apache-2.0 AND LicenseRef-Commons-Clause-1.0
 *
 * Omnilayer on the Layouts screen: putting the layout being edited on
 * stream, and the mode's own settings — which OBS scene it all lives in, how
 * a layout arrives (a cut, or behind a wipe), and a check of what that scene
 * holds. The server does the work (server/engine/omnilayer.js).
 */
import React, { useEffect, useState } from 'react';
import { Check, Layers, Play, Search, Smartphone, Zap } from 'lucide-react';
import { fill, refusalWords } from '../words';
import { SceneTypesManager } from './SceneTypes';
// Stands in for whichever remote player is on screen: no source of its own to look for or hide.
import { ON_SCREEN_SOURCE } from '../../shared/remote-players.js';

export interface OmniState {
  enabled?: boolean;
  scene?: string;
  transition?: 'cut' | 'cover';
  coverMs?: number;
  holdMs?: number;
  live?: string;
  moving?: { phase: string; to?: string } | null;
  problems?: { code: string; source?: string; scene?: string; type?: string; canvas?: string }[];
  /** The scene types (server/engine/scene-types.js): the same list in every profile. */
  types?: { id: string; name: string }[];
  /** OBS's vertical canvas, worked the same way (server/engine/omnilayer.js). */
  vertical?: { enabled?: boolean; canvas?: string; canvasName?: string; scene?: string };
}

/** A scene's check: what it holds, top first. */
interface SceneCheck { scene: string; canvas?: string; items: { name: string; kind: string; enabled: boolean }[]; error?: string }

interface LayoutLike { id: string; name: string; width: number; height: number; layers: any[]; sceneType?: string }

interface Props {
  omni: OmniState | undefined;
  layout: LayoutLike;
  layouts: LayoutLike[];
  obsScenes: string[];
  obsConnected: boolean;
  /** The scene OBS is showing, which may be one of the old bound ones rather than Omnilayer's. */
  currentScene: string;
  /** system.actions.omnilayer: answers, or refuses. */
  run: (payload: any) => Promise<any>;
  t: any;
}

const label = 'text-[8px] font-black uppercase tracking-widest text-zinc-600';
const field = 'w-full bg-zinc-950/60 border border-zinc-800 rounded-md px-1.5 py-1 text-[10px] text-zinc-300 outline-none focus:border-current-accent';

/** What this layout does with the sources Omnilayer looks after: where each goes, and which it hides. */
export function slotSummary(layout: LayoutLike, layouts: LayoutLike[]) {
  const managed = new Set<string>();
  for (const l of layouts) for (const y of l.layers || []) if (y.type === 'source' && y.config?.source && y.config.source !== ON_SCREEN_SOURCE) managed.add(y.config.source);
  const placed = (layout.layers || []).filter((y: any) => y.type === 'source' && y.visible !== false && y.config?.source);
  const here = new Set(placed.map((y: any) => y.config.source));
  return { placed, hidden: [...managed].filter((n) => !here.has(n)) };
}

const problemText = (p: { code: string; source?: string; scene?: string; type?: string; canvas?: string }, t: any) => (
  p.code === 'vertical_canvas_missing' ? fill(t.omniProblemVerticalCanvas || 'OBS has no canvas called “{canvas}” any more, so nothing was moved on the vertical side. Choose it again below.', { canvas: p.canvas })
    : p.code === 'vertical_unreadable' ? (t.omniProblemVerticalUnreadable || 'OBS would not list its canvases, so nothing was moved on the vertical side.')
    : p.code === 'source_missing' && p.canvas === 'vertical' ? fill(t.omniProblemVerticalSource || '“{source}” is not in the vertical scene “{scene}”, so it was not moved there.', { source: p.source, scene: p.scene })
    : p.code === 'no_type_layout' ? fill(t.omniProblemNoType || 'A command asked for “{type}”, and no layout in the overlay profile that is on is that type, so nothing changed.', { type: p.type })
    : p.code === 'obs_offline' ? (t.omniProblemOffline || 'OBS is not connected, so nothing was moved.')
    : p.code === 'obs_slow' ? (t.omniProblemSlow || 'OBS took too long to answer, so the wipe lifted before everything had moved. Check that OBS is still connected.')
    : p.code === 'no_scene' ? (t.omniProblemNoScene || 'No OBS scene to work in: choose one below.')
      : p.code === 'scene_missing' ? fill(t.omniProblemScene || 'OBS has no scene called “{scene}”.', { scene: p.scene })
        : fill(t.omniProblemSource || '“{source}” is not in the scene “{scene}”, so it was not moved.', { source: p.source, scene: p.scene })
);

/**
 * OBS's vertical canvas — SE.Live's, Aitum Vertical's — worked like the main
 * one: a scene there with the vertical overlay on top and the same sources
 * under it, moved to each layout's vertical boxes as it goes live. A canvas
 * has no scene "on" that the app could switch, which is why it is one scene.
 */
const VerticalCanvas = ({ omni, obsConnected, run, set, t }: { omni: OmniState | undefined; obsConnected: boolean; run: (p: any) => Promise<any>; set: (s: Partial<OmniState>) => void; t: any }) => {
  const v = omni?.vertical || {};
  const [found, setFound] = useState<{ supported: boolean; canvases: { uuid: string; name: string; width: number; height: number; scenes: string[] }[] } | null>(null);
  const [error, setError] = useState('');
  const look = async () => {
    setError('');
    try { setFound(await run({ op: 'canvases' })); } catch (err: any) { setError(refusalWords(t, err) || err?.message || ''); }
  };
  // Asked when it is switched on and OBS is there, so the lists are filled without a press.
  useEffect(() => { if (v.enabled && obsConnected && !found) look(); }, [v.enabled, obsConnected]);
  const setV = (patch: Partial<NonNullable<OmniState['vertical']>>) => set({ vertical: { ...v, ...patch } });
  const canvas = found?.canvases.find((c) => c.uuid === v.canvas) || found?.canvases.find((c) => c.name === v.canvasName) || null;
  const scenes = [...new Set([...(v.scene ? [v.scene] : []), ...(canvas?.scenes || [])])];
  return (
    <div className="space-y-2 pt-2 border-t border-zinc-800/60" data-omnilayer-vertical={v.enabled ? 'on' : 'off'}>
      <div className="flex items-center gap-2">
        <Smartphone size={12} className="text-zinc-500" />
        <span className={`flex-1 ${label}`}>{t.omniVertical || 'Also on OBS’s vertical canvas'}</span>
        <button
          onClick={() => setV({ enabled: !v.enabled })}
          data-omnilayer-vertical-toggle
          className={`px-2.5 py-1 rounded-md text-[8px] font-black uppercase tracking-widest border ${v.enabled ? 'bg-current-accent/10 border-current-accent text-current-accent' : 'border-zinc-800 text-zinc-500'}`}
        >
          {v.enabled ? (t.omniOn || 'On') : (t.omniOff || 'Off')}
        </button>
      </div>
      <p className="text-[9px] text-zinc-600 leading-snug">
        {t.omniVerticalHint || 'For streaming vertical at the same time (Twitch dual format, TikTok). In one scene on the vertical canvas, put the vertical browser source on top and the same game and camera sources under it: going live moves them to each layout’s vertical boxes.'}
      </p>
      {v.enabled && (
        <>
          {error && <p className="text-[9px] text-amber-500">{error}</p>}
          {found && !found.supported && <p className="text-[9px] text-amber-500" data-omnilayer-vertical-unsupported>{t.omniVerticalUnsupported || 'This OBS cannot share its other canvases with the app: it needs OBS 31.1 or newer.'}</p>}
          {found?.supported && found.canvases.length === 0 && <p className="text-[9px] text-amber-500" data-omnilayer-vertical-none>{t.omniVerticalNone || 'OBS has no vertical canvas. Turn on SE.Live’s vertical canvas or the Aitum Vertical plugin, then look again.'}</p>}
          <div className="grid grid-cols-2 gap-2">
            <label className="block">
              <span className={label}>{t.omniVerticalCanvas || 'Canvas'}</span>
              <select
                value={canvas?.uuid || ''}
                onChange={(e) => {
                  const c = found?.canvases.find((x) => x.uuid === e.target.value);
                  setV({ canvas: c?.uuid || '', canvasName: c?.name || '', scene: '' });
                }}
                className={field}
                data-omnilayer-vertical-canvas
              >
                <option value="">{v.canvasName && !canvas ? v.canvasName : (t.omniVerticalPick || 'Pick one…')}</option>
                {(found?.canvases || []).map((c) => <option key={c.uuid} value={c.uuid}>{c.name}{c.width ? ` · ${c.width}×${c.height}` : ''}</option>)}
              </select>
            </label>
            <label className="block">
              <span className={label}>{t.omniVerticalScene || 'Its scene'}</span>
              <select value={v.scene || ''} onChange={(e) => setV({ scene: e.target.value })} className={field} disabled={!canvas && !v.scene} data-omnilayer-vertical-scene>
                <option value="">{t.omniVerticalPick || 'Pick one…'}</option>
                {scenes.map((s) => <option key={s} value={s}>{s}</option>)}
              </select>
            </label>
          </div>
          <button
            onClick={look}
            disabled={!obsConnected}
            className="w-full flex items-center justify-center gap-1.5 px-3 py-1.5 rounded-xl text-[9px] font-black uppercase tracking-widest border border-zinc-800 text-zinc-400 hover:text-white disabled:opacity-40"
          >
            <Search size={12} /> {obsConnected ? (t.omniVerticalLook || 'Look for canvases again') : (t.omniCheckOffline || 'Connect OBS to check the scene')}
          </button>
        </>
      )}
    </div>
  );
};

export const OmnilayerPanel = ({ omni, layout, layouts, obsScenes, obsConnected, currentScene, run, t }: Props) => {
  const [busy, setBusy] = useState(false);
  const [check, setCheck] = useState<(SceneCheck & { vertical?: SceneCheck }) | null>(null);
  const on = Boolean(omni?.enabled);
  // The layout Omnilayer shows — but only on stream while OBS is on its scene.
  const chosen = on && omni?.live === layout.id;
  // OBS on another scene, one of the old bound ones: that scene's layout is on stream, and "Go live" switches OBS over.
  const elsewhere = Boolean(on && omni?.scene && currentScene && currentScene !== omni.scene);
  const isLive = chosen && !elsewhere;
  const { placed, hidden } = slotSummary(layout, layouts);
  const set = (settings: Partial<OmniState>) => run({ op: 'set', settings }).catch(() => {});
  const go = async (transition?: 'cut') => {
    setBusy(true);
    try { await run({ op: 'go', layoutId: layout.id, transition }); } catch { /* the state says what happened */ }
    setBusy(false);
  };
  const inspect = async () => setCheck(await run({ op: 'inspect' }).catch((err: any) => ({ scene: omni?.scene || '', items: [], error: refusalWords(t, err) || err?.message })));

  // Every source some layout gives a box, which the scene has to hold.
  const managed = new Set<string>();
  for (const l of layouts) for (const y of l.layers || []) if (y.type === 'source' && y.config?.source && y.config.source !== ON_SCREEN_SOURCE) managed.add(y.config.source);
  const missing = check ? [...managed].filter((n) => !check.items.some((i) => i.name === n)) : [];
  const overlayOnTop = check?.items[0]?.kind === 'browser_source';
  // The vertical scene holds what the layouts' vertical boxes place: the sources of slots not kept to the horizontal side.
  const managedVertical = new Set<string>();
  for (const l of layouts) for (const y of l.layers || []) if (y.type === 'source' && y.only !== 'horizontal' && y.config?.source && y.config.source !== ON_SCREEN_SOURCE) managedVertical.add(y.config.source);
  const vcheck = check?.vertical;
  const missingVertical = vcheck ? [...managedVertical].filter((n) => !vcheck.items.some((i) => i.name === n)) : [];

  return (
    <div className="glass-panel rounded-3xl border border-zinc-800 p-5 space-y-3" data-omnilayer-panel>
      <div className="flex items-center gap-2">
        <Layers size={13} className="text-current-accent" />
        <span className="flex-1 text-[9px] font-black uppercase tracking-widest text-zinc-500">Omnilayer</span>
        <button
          onClick={() => set({ enabled: !on })}
          data-omnilayer-toggle
          className={`px-2.5 py-1 rounded-md text-[8px] font-black uppercase tracking-widest border ${on ? 'bg-current-accent/10 border-current-accent text-current-accent' : 'border-zinc-800 text-zinc-500'}`}
        >
          {on ? (t.omniOn || 'On') : (t.omniOff || 'Off')}
        </button>
      </div>
      <p className="text-[9px] text-zinc-600 leading-snug">
        {t.omniHint || 'The whole stream in one OBS scene: the overlay on top, the game and camera underneath. Going live with a layout switches the overlay and moves them to its OBS source boxes.'}
      </p>

      {on && (
        <div className="space-y-2 pt-1">
          <div className="flex items-center gap-2">
            {isLive
              ? <span className="text-[9px] font-black uppercase tracking-widest text-current-accent flex items-center gap-1" data-omnilayer-live><Check size={11} /> {t.omniLiveNow || 'Live now'}</span>
              : <span className="text-[9px] text-zinc-500">{t.omniNotLive || 'Not live'}</span>}
          </div>
          {elsewhere && (
            <p className="text-[9px] text-zinc-500 leading-snug" data-omnilayer-elsewhere>
              {fill(t.omniElsewhere || 'OBS is showing “{current}”, not “{scene}”. Going live switches it over.', { current: currentScene, scene: omni?.scene })}
            </p>
          )}
          <div className="flex gap-2">
            <button
              onClick={() => go()}
              disabled={busy}
              data-omnilayer-go
              className="flex-1 flex items-center justify-center gap-1.5 px-3 py-2 rounded-xl text-[9px] font-black uppercase tracking-widest bg-current-accent text-white disabled:opacity-50"
            >
              <Play size={12} /> {isLive ? (t.omniPlaceAgain || 'Place sources again') : (t.omniGoLive || 'Go live')}
            </button>
            {/* The wipe is for a change of layout; the one already chosen just has OBS switched to it. */}
            {!chosen && omni?.transition === 'cover' && (
              <button
                onClick={() => go('cut')}
                disabled={busy}
                title={t.omniCutHint || 'Straight away, without the wipe'}
                className="flex items-center gap-1 px-3 py-2 rounded-xl text-[9px] font-black uppercase tracking-widest border border-zinc-800 text-zinc-400 hover:text-white disabled:opacity-50"
              >
                <Zap size={12} /> {t.omniCut || 'Cut'}
              </button>
            )}
          </div>
          <div className="text-[9px] text-zinc-500 space-y-0.5" data-omnilayer-slots>
            {placed.length === 0 && hidden.length === 0 && <p>{t.omniNoSlots || 'No OBS source boxes on any layout yet. Add an “OBS source” layer where the game or camera goes.'}</p>}
            {placed.map((y: any) => (
              <p key={y.uid}>{fill(t.omniPlaced || '{source}: {w}×{h} at {x}, {y}', { source: y.config.source, w: y.width, h: y.height, x: y.x, y: y.y })}</p>
            ))}
            {hidden.map((n) => <p key={n} className="text-zinc-600">{fill(t.omniHidden || '{source}: hidden', { source: n })}</p>)}
          </div>
          {(omni?.problems || []).map((p, i) => <p key={i} className="text-[9px] text-amber-500 leading-snug">{problemText(p, t)}</p>)}
        </div>
      )}

      <div className="space-y-2 pt-2 border-t border-zinc-800/60">
        <label className="block">
          <span className={label}>{t.omniScene || 'Its OBS scene'}</span>
          <select value={omni?.scene || ''} onChange={(e) => set({ scene: e.target.value })} className={field}>
            <option value="">{t.omniSceneAny || 'Whichever scene OBS has on'}</option>
            {[...new Set([...(omni?.scene ? [omni.scene] : []), ...obsScenes])].map((s) => <option key={s} value={s}>{s}</option>)}
          </select>
        </label>
        <div className="grid grid-cols-2 gap-2">
          <label className="block">
            <span className={label}>{t.omniTransition || 'Switching'}</span>
            <select value={omni?.transition || 'cover'} onChange={(e) => set({ transition: e.target.value as any })} className={field}>
              <option value="cover">{t.omniCover || 'Behind a wipe'}</option>
              <option value="cut">{t.omniCutOption || 'A cut'}</option>
            </select>
          </label>
          {(omni?.transition || 'cover') === 'cover' && (
            <label className="block">
              <span className={label}>{fill(t.omniWipeMs || 'Wipe: {ms} ms', { ms: omni?.coverMs ?? 450 })}</span>
              <input type="range" min={150} max={1500} step={50} value={omni?.coverMs ?? 450} onChange={(e) => set({ coverMs: Number(e.target.value) })} className="w-full accent-current-accent" />
            </label>
          )}
        </div>
        <button
          onClick={inspect}
          disabled={!obsConnected}
          className="w-full flex items-center justify-center gap-1.5 px-3 py-2 rounded-xl text-[9px] font-black uppercase tracking-widest border border-zinc-800 text-zinc-400 hover:text-white disabled:opacity-40"
        >
          <Search size={12} /> {obsConnected ? (t.omniCheck || 'Check the scene') : (t.omniCheckOffline || 'Connect OBS to check the scene')}
        </button>
        {check && (
          <div className="text-[9px] space-y-1" data-omnilayer-check>
            {check.error && <p className="text-amber-500">{check.error}</p>}
            <p className="text-zinc-500">{fill(t.omniCheckHolds || '“{scene}” holds, top first:', { scene: check.scene })}</p>
            {check.items.map((i) => <p key={i.name} className="text-zinc-400 pl-2">{i.name}{i.enabled ? '' : ` (${t.omniHiddenNow || 'hidden'})`}</p>)}
            {check.items.length > 0 && !overlayOnTop && <p className="text-amber-500">{t.omniCheckTop || 'The overlay’s browser source should be at the top, over the game and camera.'}</p>}
            {missing.map((n) => <p key={n} className="text-amber-500">{fill(t.omniCheckMissing || '“{source}” has a box on a layout but is not in this scene.', { source: n })}</p>)}
            {vcheck && (
              <div className="pt-2 space-y-1" data-omnilayer-check-vertical>
                {vcheck.error && <p className="text-amber-500">{vcheck.error === 'vertical_canvas_missing' ? problemText({ code: 'vertical_canvas_missing', canvas: omni?.vertical?.canvasName }, t) : vcheck.error}</p>}
                <p className="text-zinc-500">{fill(t.omniCheckHoldsVertical || 'On the vertical canvas, “{scene}” holds, top first:', { scene: vcheck.scene })}</p>
                {vcheck.items.map((i) => <p key={i.name} className="text-zinc-400 pl-2">{i.name}{i.enabled ? '' : ` (${t.omniHiddenNow || 'hidden'})`}</p>)}
                {vcheck.items.length > 0 && vcheck.items[0]?.kind !== 'browser_source' && <p className="text-amber-500">{t.omniCheckTopVertical || 'The vertical overlay’s browser source should be at the top there, over the game and camera.'}</p>}
                {missingVertical.map((n) => <p key={n} className="text-amber-500">{fill(t.omniCheckMissingVertical || '“{source}” has a box on a layout’s vertical side but is not in the vertical scene.', { source: n })}</p>)}
              </div>
            )}
          </div>
        )}
        <VerticalCanvas omni={omni} obsConnected={obsConnected} run={run} set={set} t={t} />
      </div>

      <SceneTypesManager types={omni?.types || []} layouts={layouts} run={run} t={t} />
    </div>
  );
};
