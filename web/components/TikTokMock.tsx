/**
 * @license
 * SPDX-License-Identifier: Apache-2.0 AND LicenseRef-Commons-Clause-1.0
 *
 * A stand-in for what TikTok LIVE draws over a vertical stream, laid over the
 * vertical canvas in the editor.
 *
 * The shaded areas say where not to put things; this says why. A hatched
 * strip along the bottom is easy to wave away, while a column of comments, a
 * comment box and a gift button sitting on top of the song card are not —
 * and the real app draws more than a rectangle can show: a name pill and a
 * follow button at the top, the viewer count opposite, hearts floating up the
 * right, comments climbing from the bottom.
 *
 * Drawn from memory of the app, generic icons and no logo: close enough to
 * judge spacing by, never a copy, and the app moves things around between
 * versions anyway. A guide in the editor only — nothing here reaches the
 * stream, and it never takes a click from the layers underneath.
 *
 * Laid out on a 1080-wide phone and scaled to the canvas, the top row held to
 * the top edge and the comments to the bottom one, so a canvas taller or
 * shorter than 1920 keeps them where the app would.
 */
import React from 'react';
import { ChevronRight, CircleHelp, Ellipsis, Forward, Gift, Heart, Plus, User, X } from 'lucide-react';

interface Props {
  width: number;
  height: number;
  t: any;
}

const PHONE_WIDTH = 1080;
const SHADOW = '0 1px 3px rgba(0,0,0,0.55)';
const PILL = 'rgba(0,0,0,0.32)';

// The people in the comments. Made up, and coloured rather than pictured.
const CHATTERS = [
  { name: 'pixel.fan', colour: '#f472b6' },
  { name: 'carlitos22', colour: '#38bdf8' },
  { name: 'miau.miau', colour: '#a3e635' },
];

const Avatar = ({ size, colour }: { size: number; colour: string }) => (
  <span
    className="shrink-0 rounded-full flex items-center justify-center"
    style={{ width: size, height: size, background: colour, border: '3px solid rgba(255,255,255,0.85)' }}
  >
    <User size={size * 0.55} color="white" strokeWidth={2.4} />
  </span>
);

const RoundButton = ({ children, background = PILL }: { children: React.ReactNode; background?: string }) => (
  <span className="shrink-0 rounded-full flex items-center justify-center" style={{ width: 84, height: 84, background }}>
    {children}
  </span>
);

export const TikTokMock = ({ width, height, t }: Props) => {
  const scale = width / PHONE_WIDTH;
  const comments = [t.tiktokMockSay1 || 'hiii 👋', t.tiktokMockSay2 || 'what game is this?', t.tiktokMockSay3 || 'gg'];

  return (
    <div className="absolute inset-0 pointer-events-none overflow-hidden" data-phone-mock="tiktok">
      <div
        className="absolute left-0 top-0 text-white"
        style={{ width: PHONE_WIDTH, height: height / scale, transform: `scale(${scale})`, transformOrigin: '0 0', fontFamily: 'system-ui, sans-serif', textShadow: SHADOW }}
      >
        {/* The app darkens the top and bottom of the picture so its own words stay readable. */}
        <div className="absolute inset-x-0 top-0" style={{ height: 280, background: 'linear-gradient(rgba(0,0,0,0.35), transparent)' }} />
        <div className="absolute inset-x-0 bottom-0" style={{ height: 760, background: 'linear-gradient(transparent, rgba(0,0,0,0.5))' }} />

        {/* The streamer's name, likes and follow button. */}
        <div className="absolute flex items-center gap-4 rounded-full" style={{ left: 28, top: 56, height: 92, padding: '0 10px 0 8px', background: PILL }}>
          <Avatar size={76} colour="linear-gradient(135deg, #fe2c55, #25f4ee)" />
          <span className="flex flex-col leading-tight pr-2">
            <span style={{ fontSize: 30, fontWeight: 700 }}>{t.tiktokMockChannel || 'Your channel'}</span>
            <span style={{ fontSize: 22, opacity: 0.8 }}>{t.tiktokMockLikes || '12.4K likes'}</span>
          </span>
          <span className="flex items-center gap-1.5 rounded-full" style={{ height: 64, padding: '0 26px', background: '#fe2c55', fontSize: 26, fontWeight: 700, textShadow: 'none' }}>
            <Plus size={28} strokeWidth={3} /> {t.tiktokMockFollow || 'Follow'}
          </span>
        </div>
        <div className="absolute flex gap-3" style={{ left: 28, top: 166 }}>
          {[t.tiktokMockRanking || 'Hourly ranking', t.tiktokMockExplore || 'Explore'].map((label) => (
            <span key={label} className="flex items-center gap-1 rounded-full" style={{ height: 52, padding: '0 18px 0 22px', background: 'rgba(0,0,0,0.25)', fontSize: 22, fontWeight: 600 }}>
              {label} <ChevronRight size={22} />
            </span>
          ))}
        </div>

        {/* The top viewers, how many are watching, and the way out. */}
        <div className="absolute flex items-center gap-3" style={{ right: 28, top: 70 }}>
          <span className="flex">
            {['#fbbf24', '#c084fc', '#34d399'].map((colour, i) => (
              <span key={colour} style={{ marginLeft: i ? -14 : 0 }}><Avatar size={64} colour={colour} /></span>
            ))}
          </span>
          <span className="flex items-center rounded-full" style={{ height: 64, padding: '0 22px', background: PILL, fontSize: 26, fontWeight: 700 }}>1.2K</span>
          <X size={56} strokeWidth={2.4} />
        </div>

        {/* Likes, floating up the right-hand side. */}
        {[
          { right: 60, bottom: 300, size: 64, opacity: 0.95 },
          { right: 130, bottom: 400, size: 48, opacity: 0.8 },
          { right: 50, bottom: 500, size: 56, opacity: 0.65 },
          { right: 120, bottom: 600, size: 40, opacity: 0.5 },
          { right: 70, bottom: 690, size: 44, opacity: 0.35 },
        ].map((h, i) => (
          <Heart key={i} className="absolute" size={h.size} fill="#fe2c55" color="#fe2c55" style={{ right: h.right, bottom: h.bottom, opacity: h.opacity }} />
        ))}

        {/* The comments, climbing from the comment box. */}
        <div className="absolute flex flex-col gap-4" style={{ left: 28, bottom: 180, width: 720 }}>
          <span className="rounded-2xl" style={{ padding: '14px 20px', background: 'rgba(0,0,0,0.28)', fontSize: 24, lineHeight: 1.35, color: '#a7f3d0' }}>
            {t.tiktokMockWelcome || 'Welcome to LIVE! Be kind and follow the community rules.'}
          </span>
          {CHATTERS.map((c, i) => (
            <span key={c.name} className="flex items-start gap-4">
              <Avatar size={56} colour={c.colour} />
              <span className="flex flex-col leading-snug">
                <span style={{ fontSize: 23, fontWeight: 600, opacity: 0.7 }}>{c.name}</span>
                <span style={{ fontSize: 27 }}>{comments[i]}</span>
              </span>
            </span>
          ))}
          <span style={{ fontSize: 23, opacity: 0.75 }}>
            {(t.tiktokMockJoined || '{name} joined').replace('{name}', 'luna_gg')} 👋
          </span>
        </div>

        {/* The comment box and the buttons beside it. */}
        <div className="absolute flex items-center gap-4" style={{ left: 28, right: 28, bottom: 60 }}>
          <span className="flex-1 flex items-center rounded-full" style={{ height: 88, padding: '0 32px', background: 'rgba(255,255,255,0.16)', fontSize: 28, opacity: 0.85 }}>
            {t.tiktokMockComment || 'Add comment...'}
          </span>
          <RoundButton><CircleHelp size={44} /></RoundButton>
          <RoundButton><Forward size={44} /></RoundButton>
          <RoundButton background="linear-gradient(135deg, #fe2c55, #ff9f43)"><Gift size={44} /></RoundButton>
          <RoundButton><Ellipsis size={44} /></RoundButton>
        </div>
      </div>
    </div>
  );
};
