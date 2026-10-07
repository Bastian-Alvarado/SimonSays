/**
 * @license
 * SPDX-License-Identifier: Apache-2.0 AND LicenseRef-Commons-Clause-1.0
 *
 * The alert that plays over the stream.
 *
 * Moved out of App.tsx so a composited overlay can place it as a layer instead
 * of dedicating a whole browser source to it.
 *
 * The Chat dock's preview pane used to carry its own copy of this markup at
 * roughly 70% size. Two copies of the same thing drift, and the preview is
 * meant to show what goes on stream — so the size difference became a `scale`
 * prop and the copy went away.
 *
 * It renders what the server sends. The server already interpolates the
 * message template against the full variable context and ships the result as
 * `text`; this used to ignore that and re-split the raw template on `{user}`,
 * which is why every variable except `{user}` reached the stream as literal
 * `{spotify.track}`.
 */
import React, { useEffect, useMemo, useRef, useState } from 'react';
import { ActiveAlert } from '../types';
import { ScopedStyle } from './ScopedStyle';

/** Image cap at full size. Scaled down for previews. */
const IMAGE_MAX_PX = 300;

/** How long before the end to start the exit animation. */
const EXIT_MS = 400;

/**
 * The entrances and exits an alert may use.
 *
 * Exported so the editor offers exactly what the renderer can draw — the two
 * lists drifting apart is how every stored config ended up naming
 * `animate-pop-in` and `animate-fade-out` back when neither existed.
 */
export const ALERT_ANIMATIONS_IN = [
  { value: 'animate-pop-in', label: 'Pop' },
  { value: 'animate-fade-in', label: 'Fade' },
  { value: 'animate-zoom-in', label: 'Zoom' },
  { value: 'animate-slide-up', label: 'Slide up' },
  { value: 'animate-slide-down', label: 'Slide down' },
];

export const ALERT_ANIMATIONS_OUT = [
  { value: 'animate-fade-out', label: 'Fade' },
  { value: 'animate-pop-out', label: 'Shrink' },
  { value: 'animate-slide-out-up', label: 'Slide up' },
];

const IN_VALUES = ALERT_ANIMATIONS_IN.map((a) => a.value);
const OUT_VALUES = ALERT_ANIMATIONS_OUT.map((a) => a.value);

/**
 * Accept only a class that exists.
 *
 * Configs saved by older builds hold `fadeIn`, `fadeOut` and `animate-pop-in`
 * from three different conventions, none of which were real Tailwind classes.
 * Rather than migrate the stored data, anything unrecognised falls back to a
 * sensible default — so an old alert animates instead of appearing instantly.
 */
const animIn = (v?: string) => (v && IN_VALUES.includes(v) ? v : 'animate-pop-in');
const animOut = (v?: string) => (v && OUT_VALUES.includes(v) ? v : 'animate-fade-out');

export interface AlertOverlayProps {
  alert: ActiveAlert;
  /**
   * 1 on stream. Below 1 for the in-app preview, whose pane is a fraction of
   * a real canvas — text sized for 1080p would fill it edge to edge.
   */
  scale?: number;
  /**
   * Play the alert's sound. Off in editors, where a preview re-rendering on
   * every keystroke would fire the sound on every keystroke too.
   */
  playSound?: boolean;
}

export const AlertOverlay = ({ alert, scale = 1, playSound = false }: AlertOverlayProps) => {
  const { config } = alert;
  const [leaving, setLeaving] = useState(false);

  // Start the exit a moment before the alert is taken off screen, so it plays
  // out rather than being cut mid-animation.
  useEffect(() => {
    setLeaving(false);
    const total = config.duration || 5000;
    if (total <= EXIT_MS) return;
    const timer = setTimeout(() => setLeaving(true), total - EXIT_MS);
    return () => clearTimeout(timer);
  }, [alert.id, config.duration]);

  /*
    The clip's own volume, and what to do when a browser will not start it.

    Autoplay with sound is refused without a gesture in an ordinary tab and
    allowed in a browser source, which is the one that matters. Refused, it
    falls back to muted and plays anyway: a browser that will not make a noise
    is not a reason to lose the picture as well.
  */
  const video = useRef<HTMLVideoElement>(null);
  useEffect(() => {
    const el = video.current;
    if (!el) return;
    el.volume = Math.min(1, Math.max(0, config.soundVolume ?? 1));
    el.muted = !playSound;
    el.play().catch(() => {
      el.muted = true;
      el.play().catch(() => {});
    });
  }, [alert.id, config.soundVolume, playSound]);

  // One sound per alert, not per render.
  const playedFor = useRef<string | null>(null);
  useEffect(() => {
    if (!playSound || !config.soundUrl || playedFor.current === alert.id) return;
    playedFor.current = alert.id;
    const audio = new Audio(config.soundUrl);
    audio.volume = Math.min(1, Math.max(0, config.soundVolume ?? 1));
    // An overlay that cannot play audio is not a reason to lose the alert.
    audio.play().catch(() => {});
  }, [alert.id, config.soundUrl, config.soundVolume, playSound]);

  /**
   * The caption, split so the name can carry the accent colour.
   *
   * `text` is the server's interpolation of the whole template and is what
   * should reach the screen. The name is then found inside it rather than the
   * template being re-split, because by this point `{user}` is already gone.
   * Falling back to the raw template keeps an editor preview working before
   * anything has round-tripped through the server.
   */
  const parts = useMemo(() => {
    const rendered = (alert as any).text || config.messageTemplate.split('{user}').join(alert.user);
    // Absent means yes, matching the server's validator. A config stored before
    // the field existed would otherwise quietly lose its accent colour.
    if (config.highlightText === false || !alert.user) return [{ text: rendered, accent: false }];
    return String(rendered).split(alert.user).flatMap((chunk, i) => (
      i === 0 ? [{ text: chunk, accent: false }] : [{ text: alert.user, accent: true }, { text: chunk, accent: false }]
    ));
  }, [alert, config.messageTemplate, config.highlightText]);

  /*
    A webm with an alpha channel is what most alerts people actually notice are
    made of, and it has to be a <video> — an <img> renders nothing at all for
    one.

    It keeps its own soundtrack, on the surfaces allowed to make a noise. It
    used to be muted always, on the reasoning that audio was the soundUrl's
    job — but a clip somebody chose for its sound arriving silent is not a
    design, it is the clip not working. The volume control applies to it too,
    so the two remain one setting rather than two.

    Square, because the corners of a clip are the clip's business: a rounded
    box drawn around somebody's artwork is this app having an opinion about
    it. The media names itself, so a stylesheet wanting them back can say so.
  */
  const isVideo = /\.(webm|mp4)(\?|#|$)/i.test(config.imageUrl || '');
  const mediaStyle = { maxWidth: `${IMAGE_MAX_PX * scale}px`, maxHeight: `${IMAGE_MAX_PX * scale}px` };
  const mediaClass = 'object-contain shadow-2xl drop-shadow-2xl';

  const image = !config.imageUrl ? null : isVideo ? (
    <video
      // Re-keyed per alert so the clip restarts rather than showing its last
      // frame when the same alert fires twice.
      key={alert.id}
      ref={video}
      src={config.imageUrl}
      className={mediaClass} data-alert="media"
      style={mediaStyle}
      autoPlay
      muted={!playSound}
      playsInline
    />
  ) : (
    <img src={config.imageUrl} alt="" className={mediaClass} style={mediaStyle} data-alert="media" />
  );

  const caption = (
    <div
      style={{
        fontFamily: config.fontFamily || 'Montserrat',
        fontSize: `${config.fontSize * scale}px`,
        color: config.textColor || '#ffffff',
        textShadow: '0 2px 10px rgba(0,0,0,0.5)',
        /*
          What was chosen for this alert, for a look to read before its own;
          left automatic, nothing is set and the look decides. The words,
          the name, and the font.
        */
        ['--alert-text' as any]: config.textColor || undefined,
        ['--alert-name' as any]: config.accentColor || undefined,
        // Quoted: a name like "Baloo 2" is not a valid family unquoted.
        ['--alert-font' as any]: config.fontFamily ? `"${config.fontFamily.replace(/"/g, '')}"` : undefined,
      }}
      className="font-black uppercase tracking-tight" data-alert="caption"
    >
      {/*
        The words are an element rather than a bare text node, because a
        stylesheet cannot reach a text node and boxing the message is the
        obvious thing somebody wants to do with it.

        The spaces around them stay outside that element. A template reads
        "Nuevo follow! {user}", so the chunk before the name carries a
        trailing space — inside a filled chip that space is a stripe of
        colour hanging off the end of the words, and outside it is the gap
        that separates them from the name, which is what it was for.
      */}
      {parts.map((p, i) => {
        if (p.accent) {
          return <span key={i} style={{ color: config.accentColor || '#f43f5e' }} data-alert="name">{p.text}</span>;
        }
        // An empty chunk is what a template beginning or ending with the
        // name leaves behind. Rendered, it is an empty box a chip would paint.
        if (!p.text) return null;
        const words = p.text.trim();
        const lead = p.text.slice(0, p.text.length - p.text.trimStart().length);
        const tail = p.text.slice(p.text.trimEnd().length);
        return (
          <React.Fragment key={i}>
            {lead}
            {Boolean(words) && <span data-alert="message">{words}</span>}
            {tail}
          </React.Fragment>
        );
      })}
    </div>
  );

  // `image-cover` puts the caption over the picture; the rest are a flex
  // direction. Doing it this way keeps all four arrangements in one place
  // rather than four near-identical blocks.
  const direction = config.layout === 'image-left' ? 'flex-row'
    : config.layout === 'image-right' ? 'flex-row-reverse'
      : 'flex-col';


  return (
    <div className="absolute inset-0 z-50 flex items-center justify-center pointer-events-none p-8">
      <div className={`${leaving ? animOut(config.animationOut) : animIn(config.animationIn)}`}>
        {/*
          This alert's own stylesheet, scoped to the alert.

          Prelude-less @scope takes its root from the element the style sits
          in, so :scope here is the alert and nothing written can reach the
          rest of the page. One element rather than two, so a keyframe
          declared in the look is visible to the motion; the motion goes last
          so it wins where both speak about the same property — including
          against the built-in entrance, which is a class on this same div.

          It replays on every firing without being keyed: the queue clears
          the current alert before the next one starts, so this whole
          component unmounts between two of them.
        */}
        <ScopedStyle css={config.css} motionCss={config.motionCss} />
        {config.layout === 'image-cover' && image ? (
          <div className="relative flex items-center justify-center" data-alert="body">
            {image}
            <div className="absolute inset-0 flex items-center justify-center text-center px-4">{caption}</div>
          </div>
        ) : (
          <div className={`flex ${direction} items-center justify-center text-center gap-4`} data-alert="body">
            {image}
            {caption}
          </div>
        )}
      </div>
    </div>
  );
};
