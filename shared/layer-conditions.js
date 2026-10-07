/**
 * @license
 * SPDX-License-Identifier: Apache-2.0 AND LicenseRef-Commons-Clause-1.0
 *
 * When a layer is allowed to draw itself.
 *
 * A layer that is always on screen has to be designed for its emptiest
 * moment: the song card sits there saying nothing while no music plays, the
 * question panel shows an empty frame between questions, and the countdown
 * occupies a corner for the whole stream to be used twice.
 *
 * A condition turns those into layers that appear when they have something
 * to say. That is a different thing from hiding a layer by hand, which is a
 * thing somebody has to remember to do, in the middle of streaming.
 *
 * Deliberately a short closed list rather than a rule language. Every entry
 * is something the app already knows for certain; "is the stream live" is
 * absent for exactly that reason — the app knows whether a chat connection
 * is up, which is not the same thing, and a condition that quietly means
 * something else is worse than no condition at all.
 */

export const LAYER_CONDITIONS = [
  {
    id: 'always',
    label: 'Always',
    hint: 'On screen whenever the layer is visible.',
    test: () => true,
  },
  {
    id: 'song',
    label: 'A song is playing',
    hint: 'For the now-playing card, to hide it between songs rather than show it with nothing playing.',
    test: (s) => Boolean(s?.spotifyTrack?.name),
  },
  {
    id: 'countdown',
    label: 'The countdown is running',
    hint: 'For a break screen: the whole thing appears when the timer starts.',
    test: (s) => s?.countdown?.mode === 'running',
  },
  {
    id: 'plan',
    label: 'The plan has somewhere it is up to',
    hint: 'Hides the plan once the stream has finished working through it.',
    test: (s) => Boolean(s?.plan?.currentId) && (s?.plan?.items || []).some((i) => i.id === s.plan.currentId),
  },
  {
    id: 'question',
    label: 'A question is up',
    hint: 'For the question panel, and for anything that should move out of its way.',
    test: (s) => Boolean(s?.questions?.showingId),
  },
  {
    id: 'poll',
    label: 'A poll is up',
    hint: 'Open, or showing its result. For making room for the poll, or for the poll layer itself.',
    test: (s) => Boolean(s?.poll && s.poll.mode !== 'idle'),
  },
  {
    id: 'giveaway',
    label: 'A giveaway is up',
    hint: 'Open, being drawn, or showing its winner. For the giveaway layer, or for making room for it.',
    test: (s) => Boolean(s?.giveaway && s.giveaway.mode && s.giveaway.mode !== 'idle'),
  },
  {
    id: 'voice',
    label: 'Somebody in the Discord call is talking',
    hint: 'Needs the bot listening on the Voice call screen. Inverted, it is quiet in the call.',
    test: (s) => Boolean(s?.voice?.members?.some((m) => m.speaking)),
  },
  {
    id: 'alert',
    label: 'An alert is playing',
    hint: 'Usually inverted: hide the chat box while a follow alert is on screen.',
    test: (s) => Boolean(s?.currentAlert),
  },
];

export const CONDITION_IDS = LAYER_CONDITIONS.map((c) => c.id);

const BY_ID = new Map(LAYER_CONDITIONS.map((c) => [c.id, c]));

/**
 * Whether a layer's condition is met.
 *
 * An unknown condition draws the layer. The alternative — hiding it — means a
 * layout made by a newer version goes blank on an older one, with nothing on
 * screen to say why.
 */
export function conditionMet(showWhen, invert, state) {
  const entry = BY_ID.get(showWhen);
  if (!entry) return true;
  let met;
  try {
    met = Boolean(entry.test(state || {}));
  } catch {
    met = true;
  }
  return invert ? !met : met;
}
