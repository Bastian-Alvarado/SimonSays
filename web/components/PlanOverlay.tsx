/**
 * @license
 * SPDX-License-Identifier: Apache-2.0 AND LicenseRef-Commons-Clause-1.0
 *
 * What the stream is working through, for the people watching it.
 *
 * Games Done Quick put a schedule on screen because a marathon runs to a
 * clock: times, estimates, who is up next. This is the same idea with the
 * clock taken out — a list of what is coming and a mark against where the
 * stream has got to. Saying "at 9" and then not doing it at 9 is worse than
 * not saying, and on a one-person stream that is most nights.
 */
import React, { useEffect, useRef, useState } from 'react';
import { withDiscordText } from '../discordEmoji';

export interface PlanItem { id: string; text: string; note?: string; done?: boolean }
export interface Plan { items: PlanItem[]; currentId?: string; showDone?: boolean }

export interface PlanOverlayConfig {
  /**
   * How much of the list to show.
   *
   * 'recap' is what is left with the last finished line kept above it,
   * 'upcoming' is what is left and nothing behind it, 'all' is the whole
   * list and 'current' is the one line being worked on.
   */
  mode?: 'recap' | 'all' | 'upcoming' | 'current';
  /** Cap on the lines drawn, so a long plan cannot run off the canvas. */
  limit?: number;
  title?: string;
  textColor?: string;
  accentColor?: string;
  doneColor?: string;
  background?: string;
  radius?: number;
  showNotes?: boolean;
  /** Under the line it belongs to, with the whole row, rather than beside it. */
  notesOwnLine?: boolean;
}

/*
  data-plan names the box, the heading, a line, the mark against the current
  one, its words and the note beside them.

  And data-plan-state says which line it is — now, done, or still to come —
  so a look can decide how each of those reads. Everything about how they are
  drawn today is written inline from the controls, so a stylesheet overriding
  one says !important.
*/
export const PlanOverlay = ({ plan, config }: { plan?: Plan; config: PlanOverlayConfig }) => {
  const all = plan?.items || [];
  const mode = config.mode || 'recap';
  const at = all.findIndex((i) => i.id === plan?.currentId);
  const accent = config.accentColor || 'var(--overlay-accent, #f43f5e)';
  const text = config.textColor || '#ffffff';
  const doneColor = config.doneColor || '#71717a';
  /*
    Whether a note sits beside its line or under it. Beside, it has only the
    width the title did not want and ends in an ellipsis; under, it has the
    whole row and can say what it came to say.
  */
  const ownLine = config.notesOwnLine === true;
  const start = at >= 0 ? at : 0;
  const cap = Math.max(1, config.limit ?? 4);

  /*
    The one line of history worth keeping: what was just finished.

    A list that only ever looks forward loses the thing somebody arriving
    thirty seconds ago most wants — what they just missed — and a list that
    keeps every finished line grows all night until the top of it is a stream
    that ended hours ago. One crossed-out line is the whole of the useful part.

    It is the last finished line before here rather than the last one in the
    list, because things get ticked off out of order and the one that matters
    is the one you just came from. It counts against the cap, so the box is the
    height it was told to be — and drops out entirely at a cap of one, where
    the line being worked on is the only one that fits.
  */
  let back = -1;
  if (mode === 'recap' && cap > 1 && plan?.showDone !== false) {
    for (let i = start - 1; i >= 0; i -= 1) if (all[i].done) { back = i; break; }
  }
  const backId = back >= 0 ? all[back].id : null;

  /*
    The line the recap is replacing, kept on screen long enough to leave.

    Crossing something off swaps one crossed-out line for another, and a swap
    with no motion is a flicker: the eye reads it as the list having been
    rewritten rather than as having moved on by one. So the one being replaced
    stays for the length of its animation, above the one taking its place, and
    goes up and out — which is the direction the list just moved.

    It clears on the animation ending rather than on a timer of its own, so a
    stylesheet can make the exit as long as it likes. The timer behind it is
    only there because an animation that never runs never ends, and a line
    that stayed for good would be worse than no animation at all.
  */
  const [leavingId, setLeavingId] = useState<string | null>(null);
  const wasBack = useRef<string | null>(null);
  useEffect(() => {
    const before = wasBack.current;
    wasBack.current = backId;
    if (!before || !backId || before === backId) return undefined;
    setLeavingId(before);
    const timer = setTimeout(() => setLeavingId(null), 4000);
    return () => clearTimeout(timer);
  }, [backId]);

  if (!all.length) return null;

  /*
    Which items to draw.

    "upcoming" starts at whatever is current rather than at the top, because
    once a stream is three things in, the top of the list is history and the
    interesting part has scrolled off. With nothing marked current it falls
    back to the start, which is what a plan looks like before it begins.
  */
  let items = all;
  if (mode === 'current') items = at >= 0 ? [all[at]] : [all[0]];
  else if (mode === 'upcoming' || mode === 'recap') {
    const ahead = all.slice(start, start + (back >= 0 ? cap - 1 : cap));
    items = back >= 0 ? [all[back], ...ahead] : ahead;
  } else if (plan?.showDone === false) {
    items = all.filter((i) => !i.done);
  }

  /* The one on its way out sits above the one that replaced it. */
  const leaving = leavingId && leavingId !== backId && !items.some((i) => i.id === leavingId)
    ? all.find((i) => i.id === leavingId)
    : undefined;
  const drawn = leaving ? [leaving, ...items] : items;

  return (
    <div
      /*
        Items sit further apart once notes are under them, or a note is as
        far from the line it belongs to as from the next one and the pairing
        stops reading. Beside the line there is nothing to pair, so the
        tighter spacing stays.
      */
      className={`w-full h-full flex flex-col px-4 py-3 overflow-hidden ${ownLine ? 'gap-3' : 'gap-1.5'}`} data-plan="list"
      style={{
        backgroundColor: config.background || 'transparent',
        borderRadius: `${config.radius ?? 12}px`,
        /*
          Centred while it fits, and piled from the top once it does not.

          Plain centring overflows a full box in both directions at once, and
          the half that goes off the top is the half you cannot get back: the
          title and the line that is happening now. "safe" is the keyword for
          exactly that — it falls back to the start when the content is taller
          than the box, so what drops off the bottom is the part still to come.

          A browser that has never heard of it drops the whole declaration and
          leaves the default, which is the top. That is the wrong half to lose
          nothing from, so it degrades the way this was changed to behave.
        */
        justifyContent: 'safe center',
      }}
    >
      {config.title && (
        <div
          /*
            shrink-0 because truncate brings overflow: hidden, and a flex item
            that hides its overflow loses the automatic minimum size that would
            otherwise keep it as tall as its own text. In a full box it was
            being squeezed to nothing: the title was still there, still first,
            still inside the box, and nought pixels tall.
          */
          className="font-black uppercase tracking-widest truncate shrink-0" data-plan="title"
          style={{ color: accent, fontSize: '0.62em' }}
        >
          {config.title}
        </div>
      )}
      {drawn.map((item) => {
        const isNow = item.id === plan?.currentId && item.id !== leaving?.id;
        const isLeaving = item.id === leaving?.id;
        return (
          /*
            Which line this is, said out loud. Whether the current one is bold
            and the finished ones struck through is a decision a look should be
            able to make, and it cannot make it if the only thing on the page is
            the result of the component having made it.
          */
          <div
            key={isLeaving ? `leaving-${item.id}` : item.id}
            className={`flex items-baseline gap-x-2 min-w-0 shrink-0 ${ownLine ? 'flex-wrap gap-y-0.5' : ''}`} data-plan="item" data-plan-state={isNow ? 'now' : item.done ? 'done' : 'todo'} data-plan-leaving={isLeaving ? 'yes' : undefined}
            onAnimationEnd={isLeaving ? () => setLeavingId(null) : undefined}
          >
            {/*
              A bar rather than a bullet, and only on the current item: the
              point of the list is which one is happening, and a marker on
              every row says nothing.
            */}
            <span
              className="shrink-0 rounded-sm" data-plan="mark"
              style={{
                width: '0.18em',
                height: '0.85em',
                backgroundColor: isNow ? accent : 'transparent',
              }}
            />
            <span
              className="truncate" data-plan="text"
              style={{
                color: item.done ? doneColor : text,
                opacity: item.done ? 0.65 : 1,
                textDecoration: item.done ? 'line-through' : 'none',
                fontWeight: isNow ? 900 : 600,
              }}
            >
              {withDiscordText(item.text)}
            </span>
            {/*
              The note, beside the words rather than inside them.

              Inside, it shared the truncation with the words it annotates, so
              a long note ate the name of the thing it was a note about. Out
              here it starts from no width at all and grows into whatever is
              left over, so the title is never asked to give anything up — a
              hair of shrinking costs a whole glyph in a fixed-width face. And it is
              no longer struck through on a finished line, which read as the
              note itself having been crossed off.

              It follows the line it belongs to rather than always taking the
              colour for finished things: a note on what is happening now is
              not finished, and drawing it in that grey said it was.
            */}
            {config.showNotes && item.note && (
              <span
                /*
                  On its own line it stops competing for width altogether, so
                  it runs as long as it needs and wraps instead of ending in
                  an ellipsis three words in. The dash stays: it is what says
                  this is a note about the line above rather than a line of
                  its own, which matters more once it is not beside it.

                  Indented past the mark so it starts under the words rather
                  than under the bar, which is the same amount of space the
                  gap gives the title on the row above.
                */
                className={ownLine ? 'basis-full min-w-0' : 'truncate basis-0 grow'} data-plan="note"
                style={{
                  color: item.done ? doneColor : text,
                  opacity: item.done ? 0.65 : 0.55,
                  fontWeight: 500,
                  paddingLeft: ownLine ? 'calc(0.18em + 0.5rem)' : undefined,
                }}
              >
                — {item.note}
              </span>
            )}
          </div>
        );
      })}
    </div>
  );
};
