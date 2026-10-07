/**
 * @license
 * SPDX-License-Identifier: Apache-2.0 AND LicenseRef-Commons-Clause-1.0
 *
 * The question currently being read out.
 *
 * Only ever shows one, and only one that has been approved — the server will
 * not point this at anything else. An unmoderated question box on stream is a
 * dare, and the whole value of a queue is that nothing reaches the screen
 * without somebody choosing it.
 *
 * Draws nothing when nothing is chosen, so the layer can sit in a layout all
 * the time and only appear during the segment it is for.
 */
import React, { useLayoutEffect, useRef, useState } from 'react';

export interface Question { id: string; user: string; platform?: string; text: string; status?: string }
export interface Questions { items: Question[]; showingId?: string }

export interface QuestionOverlayConfig {
  label?: string;
  textColor?: string;
  accentColor?: string;
  background?: string;
  radius?: number;
  showAsker?: boolean;
}

/*
  A question too tall for its card slides, the way a value too long for the
  omnibar does: up to show the rest, a pause, and back — upwards rather than
  sideways, because a question wraps and it is the last lines that do not fit.
  Shrinking it to fit was the other way, and a 280-character question shrunk
  into a lower third is too small to read from across the room.
*/
/** How fast it slides, in pixels a second — slow enough to read along with. */
const DRIFT_SPEED = 24;
/** The share of a cycle spent moving; the rest is a pause at each end. */
const DRIFT_MOVING = 0.35;
/** Below this it is not worth moving, and above it nobody waits for the end. */
const DRIFT_SECONDS = { least: 8, most: 60 };

/*
  data-question names the card, the row above the question, the label and the
  name on it, the window the question is read through, and the question
  itself.

  The ground, the corners and the bar down the side are written inline from
  the controls, so a stylesheet replacing any of those says !important.
*/
export const QuestionOverlay = ({ questions, config }: { questions?: Questions; config: QuestionOverlayConfig }) => {
  const showing = (questions?.items || []).find((q) => q.id === questions?.showingId);
  const view = useRef<HTMLDivElement | null>(null);
  const [over, setOver] = useState(0);

  /*
    How much of the question is out of sight. Measured again when the card
    changes size as well as when the question does: a layer is resized by
    dragging it, and a question that fitted at one size is the one most likely
    not to at the next. Two pixels of slack so rounding is not a slide.
  */
  useLayoutEffect(() => {
    const el = view.current;
    if (!el) { setOver(0); return undefined; }
    const measure = () => {
      const spare = el.scrollHeight - el.clientHeight;
      setOver(spare > 2 ? spare : 0);
    };
    measure();
    if (typeof ResizeObserver === 'undefined') return undefined;
    const watch = new ResizeObserver(measure);
    watch.observe(el);
    if (el.firstElementChild) watch.observe(el.firstElementChild);
    return () => watch.disconnect();
  }, [showing?.id, showing?.text]);

  if (!showing) return null;

  const accent = config.accentColor || 'var(--overlay-accent, #f43f5e)';
  const seconds = over
    ? Math.min(DRIFT_SECONDS.most, Math.max(DRIFT_SECONDS.least, over / (DRIFT_SPEED * DRIFT_MOVING)))
    : 0;

  return (
    <div
      className="w-full h-full flex flex-col justify-center gap-2 px-5 py-4 overflow-hidden" data-question="card"
      style={{
        backgroundColor: config.background || '#09090bd9',
        borderRadius: `${config.radius ?? 16}px`,
        borderLeft: `6px solid ${accent}`,
      }}
    >
      {(config.label || config.showAsker !== false) && (
        <div className="flex items-baseline gap-2 min-w-0 shrink-0" data-question="head">
          {config.label && (
            <span
              className="font-black uppercase tracking-widest shrink-0" data-question="label"
              style={{ color: accent, fontSize: '0.55em' }}
            >
              {config.label}
            </span>
          )}
          {config.showAsker !== false && showing.user && (
            <span
              className="font-bold truncate" data-question="asker"
              style={{ color: accent, fontSize: '0.6em', opacity: 0.9 }}
            >
              {showing.user}
            </span>
          )}
        </div>
      )}
      {/*
        The window: its natural height while the question fits, so the card
        stays centred as it always was, and whatever room is left once it does
        not — min-h-0 is what lets it shrink below its text, and the part cut
        off is the part the slide brings up.
      */}
      <div ref={view} className="min-h-0 overflow-hidden" data-question="window">
        <div
          className={`break-words leading-snug ${over ? 'animate-question-drift' : ''}`} data-question="text"
          style={{
            color: config.textColor || '#ffffff',
            ...(over ? { animationDuration: `${seconds.toFixed(1)}s`, ['--question-drift' as any]: `${-over}px` } : {}),
          }}
        >
          {showing.text}
        </div>
      </div>
    </div>
  );
};
