/**
 * @license
 * SPDX-License-Identifier: Apache-2.0 AND LicenseRef-Commons-Clause-1.0
 *
 * The viewer counter, as every surface renders it.
 *
 * Two shapes: one total with an eye, or a line per platform. Shared by the
 * live overlay and the editor preview so the two cannot drift.
 *
 * A count of zero on a live channel is real information and is shown. A
 * platform that is not connected at all is a different thing entirely, and is
 * left out unless asked for — an overlay reading "TikTok 0" while you only
 * stream to Twitch is clutter rather than data.
 */
import React from 'react';
import { Eye } from 'lucide-react';

// Declared here rather than imported: every file in this codebase that needs a
// platform mark defines its own, and one more consistent copy beats being the
// only file that reaches for a shared module nothing else uses.
const TwitchIcon = ({ size = 24, className = '' }: { size?: number, className?: string }) => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className} width={size} height={size}><path d="M21 2H3v16h5v4l4-4h5l4-4V2zm-10 9V7m5 4V7" /></svg>
);
const YouTubeIcon = ({ size = 24, className = '' }: { size?: number, className?: string }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor" className={className} xmlns="http://www.w3.org/2000/svg"><path d="M23.498 6.186a3.016 3.016 0 0 0-2.122-2.136C19.505 3.545 12 3.545 12 3.545s-7.505 0-9.377.505A3.017 3.017 0 0 0 .502 6.186C0 8.07 0 12 0 12s0 3.93.502 5.814a3.016 3.016 0 0 0 2.122 2.136c1.871.505 9.376.505 9.376.505s7.505 0 9.377-.505a3.015 3.015 0 0 0 2.122-2.136C24 15.93 24 12 24 12s0-3.93-.502-5.814zM9.545 15.568V8.432L15.818 12l-6.273 3.568z" /></svg>
);
const TikTokIcon = ({ size = 24, className = '' }: { size?: number, className?: string }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor" className={className} xmlns="http://www.w3.org/2000/svg"><path d="M19.589 6.686a4.793 4.793 0 0 1-3.77-4.245V2h-3.445v13.672a2.896 2.896 0 0 1-5.201 1.743l-.002-.001.002.001a2.895 2.895 0 0 1 3.183-4.51v-3.5a6.329 6.329 0 0 0-5.394 10.692 6.33 6.33 0 0 0 10.857-4.424V8.687a8.182 8.182 0 0 0 4.773 1.526V6.79a4.831 4.831 0 0 1-1.003-.104z" /></svg>
);

export interface ViewerConfig {
  mode: 'total' | 'platforms';
  showIcon: boolean;
  showOffline: boolean;
  platforms: { twitch: boolean; youtube?: boolean; tiktok: boolean };
  style: {
    fontSize: number;
    color: string;
    accentColor: string;
    background: string;
    transparent: boolean;
  };
}

interface ViewerCountProps {
  config: ViewerConfig | undefined;
  /** Live counters from the server: twitchViewers, youtubeViewers, tiktokViewers, twitchLive, youtubeLive. */
  stats: Record<string, any> | undefined;
  status: Record<string, any> | undefined;
  previewScale?: number;
  t: any;
}

/** 1200 -> 1.2K, because an overlay has a fixed width and a raid does not. */
export function formatCount(n: number): string {
  if (n < 1000) return String(n);
  const k = n / 1000;
  return `${k >= 100 ? Math.round(k) : k.toFixed(1).replace(/\.0$/, '')}K`;
}

/**
 * What each platform contributes, and whether it should be on screen.
 *
 * `live` means the platform is connected AND has something to report. Twitch
 * additionally knows whether the channel is actually broadcasting, which is
 * why an offline channel reports nothing rather than zero.
 */
export function viewerRows(config: ViewerConfig | undefined, stats: any, status: any) {
  const enabled = config?.platforms ?? { twitch: true, youtube: true, tiktok: true };

  const rows = [
    {
      key: 'twitch',
      label: 'Twitch',
      count: Number(stats?.twitchViewers) || 0,
      live: Boolean(stats?.twitchLive),
      connected: status?.twitch?.status === 'connected' || status?.twitch === 'connected',
      enabled: enabled.twitch !== false,
    },
    {
      key: 'youtube',
      label: 'YouTube',
      count: Number(stats?.youtubeViewers) || 0,
      // Like Twitch, YouTube says whether the broadcast is actually on.
      live: Boolean(stats?.youtubeLive) && (status?.youtube?.status === 'connected' || status?.youtube === 'connected'),
      connected: status?.youtube?.status === 'connected' || status?.youtube === 'connected',
      enabled: enabled.youtube !== false,
    },
    {
      key: 'tiktok',
      label: 'TikTok',
      count: Number(stats?.tiktokViewers) || 0,
      // TikTok has no separate "are you live" signal; being connected to a
      // room is the same thing.
      live: status?.tiktok?.status === 'connected' || status?.tiktok === 'connected',
      connected: status?.tiktok?.status === 'connected' || status?.tiktok === 'connected',
      enabled: enabled.tiktok !== false,
    },
  ];

  return rows.filter((r) => r.enabled && (r.live || config?.showOffline));
}

/*
  data-viewers is a promise a stylesheet can rely on: the shell, one platform
  row, the mark and the number. Both shapes use the same four names, so a
  look written for the total still means something when the layer is switched
  to a line per platform — and the mark is wrapped in a span in both, rather
  than being a bare icon in one of them and not the other.

  Everything about the shell is set inline, so a stylesheet has to say
  !important to get past it. That is the same bargain every other layer
  makes and the presets are written for it.
*/
export const ViewerCount: React.FC<ViewerCountProps> = ({ config, stats, status, previewScale, t }) => {
  const style = config?.style;
  const scale = previewScale ?? 1;
  const size = (style?.fontSize ?? 28) * scale;
  const rows = viewerRows(config, stats, status);
  const total = rows.reduce((sum, r) => sum + r.count, 0);

  const shell: React.CSSProperties = {
    /*
      What was chosen, for a look to read before its own colours; left
      automatic, nothing is set and the look decides. The background only once
      Transparent is off: it is on by default, so it cannot say anybody chose
      it, and a look keeps its box until somebody picks one.
    */
    ['--viewers-text' as any]: style?.color || undefined,
    ['--viewers-accent' as any]: style?.accentColor || undefined,
    ['--viewers-background' as any]: style?.transparent === false ? (style?.background || undefined) : undefined,
    background: style?.transparent === false ? (style?.background || '#0b0b0ecc') : 'transparent',
    color: style?.color || '#ffffff',
    fontSize: `${size}px`,
    padding: style?.transparent === false ? `${size * 0.35}px ${size * 0.6}px` : 0,
    borderRadius: `${size * 0.4}px`,
  };

  // Nothing live and nothing asked to be shown: render nothing at all rather
  // than a stray icon with no number next to it.
  if (rows.length === 0) {
    return <div className="font-black tabular-nums opacity-40" data-viewers="box" style={shell}>{t.viewersOffline}</div>;
  }

  if (config?.mode === 'platforms') {
    return (
      <div className="inline-flex items-center gap-5 font-black tabular-nums leading-none" data-viewers="box" style={shell}>
        {rows.map((r) => (
          <span key={r.key} className="inline-flex items-center gap-2" data-viewers="row">
            <span data-viewers="icon" style={{ color: style?.accentColor || '#f43f5e', display: 'inline-flex' }}>
              {r.key === 'twitch' ? <TwitchIcon size={size * 0.85} /> : r.key === 'youtube' ? <YouTubeIcon size={size * 0.85} /> : <TikTokIcon size={size * 0.85} />}
            </span>
            <span data-viewers="count">{formatCount(r.count)}</span>
          </span>
        ))}
      </div>
    );
  }

  return (
    <div className="inline-flex items-center gap-2 font-black tabular-nums leading-none" data-viewers="box" style={shell}>
      {config?.showIcon !== false && (
        <span data-viewers="icon" style={{ color: style?.accentColor || '#f43f5e', display: 'inline-flex' }}>
          <Eye size={size * 0.9} />
        </span>
      )}
      <span data-viewers="count">{formatCount(total)}</span>
    </div>
  );
};
