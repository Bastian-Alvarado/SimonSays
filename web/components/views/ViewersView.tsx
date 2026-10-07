/**
 * @license
 * SPDX-License-Identifier: Apache-2.0 AND LicenseRef-Commons-Clause-1.0
 *
 * Viewer counter setup: one number or one per platform, and what it looks like.
 *
 * Server state, like the other overlays — the browser source in OBS and the
 * screen this is configured on are usually different machines.
 */
import React, { useState } from 'react';
import { ThemeConfig } from '../../types';
import { Button } from '../Button';
import { ViewerCount, ViewerConfig } from '../ViewerCount';
import { Copy, ExternalLink, Check, Eye, LayoutGrid, Minus } from 'lucide-react';
import { copyText } from '../../utils';
import { AutoColourRow } from '../AutoSwatch';

interface ViewersViewProps {
  config: ViewerConfig | undefined;
  setViewers: (config: ViewerConfig) => void;
  stats: Record<string, any> | undefined;
  status: Record<string, any> | undefined;
  activeTheme: ThemeConfig;
  t: any;
}

const DEFAULTS: ViewerConfig = {
  mode: 'total',
  showIcon: true,
  showOffline: false,
  platforms: { twitch: true, youtube: true, tiktok: true },
  style: {
    // The colours start automatic. No settingsVersion: the server stamps it.
    fontSize: 28, color: '', accentColor: '',
    background: '', transparent: true,
  },
};

export const ViewersView: React.FC<ViewersViewProps> = ({ config, setViewers, stats, status, activeTheme, t }) => {
  const [copied, setCopied] = useState(false);
  const cfg: ViewerConfig = {
    ...DEFAULTS,
    ...(config || {}),
    platforms: { ...DEFAULTS.platforms, ...(config?.platforms || {}) },
    style: { ...DEFAULTS.style, ...(config?.style || {}) },
  };

  const patch = (next: Partial<ViewerConfig>) => setViewers({ ...cfg, ...next });
  const patchStyle = (next: Partial<ViewerConfig['style']>) => patch({ style: { ...cfg.style, ...next } });

  const overlayUrl = typeof window !== 'undefined'
    ? `${window.location.origin}${window.location.pathname}?mode=viewers`
    : '';

  const copyUrl = () => {
    copyText(overlayUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };

  return (
    <div className="animate-fade-in space-y-8 pb-20">
      

      {/* The same component the browser source renders. */}
      <div className={`glass-panel rounded-3xl border ${activeTheme.borderClass} overflow-hidden`}>
        <div
          className="relative flex items-center justify-center"
          style={{
            minHeight: 160,
            backgroundImage: 'linear-gradient(45deg, #18181b 25%, transparent 25%), linear-gradient(-45deg, #18181b 25%, transparent 25%), linear-gradient(45deg, transparent 75%, #18181b 75%), linear-gradient(-45deg, transparent 75%, #18181b 75%)',
            backgroundSize: '20px 20px',
            backgroundPosition: '0 0, 0 10px, 10px -10px, -10px 0px',
            backgroundColor: '#09090b',
          }}
        >
          <ViewerCount config={cfg} stats={stats} status={status} t={t} />
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-6">
          {/* ------------------------------------------------------- shape */}
          <div>
            <h3 className="text-[10px] font-black uppercase tracking-widest text-zinc-500 mb-2">{t.viewersMode}</h3>
            <div className="grid grid-cols-2 gap-3">
              {([
                ['total', t.viewersModeTotal, <Eye size={16} key="e" />],
                ['platforms', t.viewersModePlatforms, <LayoutGrid size={16} key="g" />],
              ] as const).map(([mode, label, icon]) => (
                <button
                  key={mode}
                  onClick={() => patch({ mode: mode as ViewerConfig['mode'] })}
                  className={`px-4 py-3 rounded-2xl text-[10px] font-black uppercase tracking-widest border transition-all flex items-center justify-center gap-2 ${
                    cfg.mode === mode ? 'bg-current-accent/10 border-current-accent text-current-accent' : 'bg-zinc-900 border-zinc-800 text-zinc-500'
                  }`}
                >
                  {icon} {label}
                </button>
              ))}
            </div>
          </div>

          {cfg.mode === 'total' && (
            <button
              onClick={() => patch({ showIcon: !cfg.showIcon })}
              className={`w-full px-3 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest border transition-all flex items-center justify-between ${
                cfg.showIcon ? 'bg-current-accent/10 border-current-accent text-current-accent' : 'bg-zinc-900 border-zinc-800 text-zinc-500'
              }`}
            >
              <span>{t.viewersShowIcon}</span>
              {cfg.showIcon ? <Check size={14} /> : <Minus size={14} />}
            </button>
          )}

          {/* ---------------------------------------------------- platforms */}
          <div>
            <h3 className="text-[10px] font-black uppercase tracking-widest text-zinc-500 mb-2">{t.viewersPlatforms}</h3>
            <div className="grid grid-cols-3 gap-3">
              {(['twitch', 'youtube', 'tiktok'] as const).map((p) => (
                <button
                  key={p}
                  onClick={() => patch({ platforms: { ...cfg.platforms, [p]: !cfg.platforms[p] } })}
                  className={`px-4 py-3 rounded-2xl text-[10px] font-black uppercase tracking-widest border transition-all flex items-center justify-between ${
                    cfg.platforms[p] ? 'bg-current-accent/10 border-current-accent text-current-accent' : 'bg-zinc-900 border-zinc-800 text-zinc-500'
                  }`}
                >
                  <span>{p}</span>
                  {cfg.platforms[p] ? <Check size={14} /> : <Minus size={14} />}
                </button>
              ))}
            </div>
            <button
              onClick={() => patch({ showOffline: !cfg.showOffline })}
              className={`w-full mt-3 px-3 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest border transition-all flex items-center justify-between ${
                cfg.showOffline ? 'bg-current-accent/10 border-current-accent text-current-accent' : 'bg-zinc-900 border-zinc-800 text-zinc-500'
              }`}
            >
              <span>{t.viewersShowOffline}</span>
              {cfg.showOffline ? <Check size={14} /> : <Minus size={14} />}
            </button>
            <p className="text-[10px] text-zinc-600 mt-1">{t.viewersShowOfflineHint}</p>
          </div>
        </div>

        {/* ------------------------------------------------------------ look */}
        <div className="space-y-4">
          <h3 className="text-[10px] font-black uppercase tracking-widest text-zinc-500">{t.omnibarStyle}</h3>
          <div className="bg-zinc-900/40 border border-zinc-800 rounded-2xl p-4 space-y-4">
            <div className="space-y-2">
              <div className="flex justify-between items-center">
                <label className="text-[9px] font-black uppercase tracking-widest text-zinc-500">{t.countdownSize}</label>
                <span className="text-[10px] font-black font-mono text-current-accent">{cfg.style.fontSize}px</span>
              </div>
              <input
                type="range" min={10} max={120}
                value={cfg.style.fontSize}
                onChange={(e) => patchStyle({ fontSize: Number(e.target.value) })}
                className="w-full h-1.5 bg-zinc-800 rounded-lg appearance-none cursor-pointer accent-current-accent"
              />
            </div>

            {/*
              Each colour, or automatic: left empty, a look on the counter
              decides it, and without one the counter's own shows. Picking one
              makes it yours, over any look; the cross hands it back. The
              background only once Transparent is off.
            */}
            {([
              ['color', t.omnibarTextColor, '#ffffff'],
              ['accentColor', t.omnibarAccentColor, '#f43f5e'],
              ['background', t.omnibarBackground, '#0b0b0e'],
            ] as const).map(([key, label, own]) => (
              <AutoColourRow
                key={key}
                name={key}
                label={label}
                value={(cfg.style as any)[key]}
                fallback={own}
                onChange={(v) => patchStyle({ [key]: v } as any)}
                onClear={() => patchStyle({ [key]: '' } as any)}
                muted={key === 'background' && cfg.style.transparent}
                t={t}
              />
            ))}

            <button
              onClick={() => patchStyle({ transparent: !cfg.style.transparent })}
              className={`w-full px-3 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest border transition-all flex items-center justify-between ${
                cfg.style.transparent ? 'bg-current-accent/10 border-current-accent text-current-accent' : 'bg-zinc-900 border-zinc-800 text-zinc-500'
              }`}
            >
              <span>{t.omnibarTransparent}</span>
              {cfg.style.transparent ? <Check size={14} /> : <Minus size={14} />}
            </button>
          </div>

          <div className="bg-zinc-900/40 border border-zinc-800 rounded-2xl p-4">
            <label className="text-[9px] font-black uppercase tracking-widest text-zinc-500 mb-2 block">{t.omnibarUrl}</label>
            <code className="text-[10px] text-current-accent font-mono break-all block mb-3">{overlayUrl}</code>
            <div className="flex gap-2">
              <Button size="sm" variant="outline" className="flex-1" icon={<Copy size={12} />} onClick={copyUrl}>
                {copied ? t.copied : t.copyIt}
              </Button>
              <Button
                size="sm" variant="outline" className="flex-1" icon={<ExternalLink size={12} />}
                onClick={() => window.open(overlayUrl, '_blank', 'width=400,height=160')}
              >
                {t.popout}
              </Button>
            </div>
            <p className="text-[9px] text-zinc-600 mt-3 leading-relaxed">{t.viewersUrlHint}</p>
          </div>
        </div>
      </div>
    </div>
  );
};
