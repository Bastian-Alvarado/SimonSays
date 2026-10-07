/**
 * @license
 * SPDX-License-Identifier: Apache-2.0 AND LicenseRef-Commons-Clause-1.0
 *
 * Dock buttons that need nothing set up first.
 *
 * A dock button points at an action you built, which is right for anything
 * particular to your stream and absurd for pausing the music: an action whose
 * whole body is one step, made once, named, and pointed at — four screens to
 * arrive at a play button. These are that button, already made.
 *
 * Shared rather than declared on either side, because both ends have to agree
 * about exactly the same list: the server refuses a button naming one it does
 * not have, and the screen offers what the server will accept.
 *
 * `category` is the tint the grid already gives a button, so a built-in one
 * looks like what it drives rather than like a thing apart.
 */

export const DOCK_BUILTINS = [
  {
    id: 'spotify_play_pause',
    category: 'spotify',
    name: 'Play / pause',
    /*
      One button, not two. The thing you press to stop the music is the thing
      you press to start it again, and two cells where one would do makes you
      read them before pressing.
    */
    op: 'toggle',
    icon: '⏯',
  },
  { id: 'spotify_next', category: 'spotify', name: 'Next track', op: 'next', icon: '⏭' },
  { id: 'spotify_previous', category: 'spotify', name: 'Previous track', op: 'previous', icon: '⏮' },
  /*
    Repeatable, unlike everything else here.

    A press that arrives while one is still in flight is normally a double-tap
    rather than a second intent — firing a scene switch twice is messy and easy
    to do on a phone. Volume is the opposite: four presses are four tenths, and
    they arrive faster than a round trip, so swallowing them is the button
    appearing not to work. Measured before this: four quick presses moved the
    volume by one step and two of the four never left the page.
  */
  { id: 'spotify_volume_up', category: 'spotify', name: 'Volume up', op: 'volume_up', icon: '🔊', repeatable: true },
  { id: 'spotify_volume_down', category: 'spotify', name: 'Volume down', op: 'volume_down', icon: '🔉', repeatable: true },
  { id: 'spotify_shuffle', category: 'spotify', name: 'Shuffle', op: 'shuffle', icon: '🔀' },
  {
    id: 'spotify_repeat',
    category: 'spotify',
    /*
      Cycles rather than toggles — off, the whole context, the one track — so
      it is named for what it is rather than for a state it does not hold.
    */
    name: 'Repeat',
    op: 'repeat',
    icon: '🔁',
  },
  /*
    The stream plan, moved from the deck the same way the Plan steps move it
    from chat — one activity forward, marking the current one done, or one
    back, undoing that. Not repeatable: a double-tap here would skip an
    activity, and there is no volume-style reason to want two.
  */
  { id: 'plan_next', category: 'plan', name: 'Complete current', op: 'next', icon: '✅' },
  { id: 'plan_back', category: 'plan', name: 'Go back', op: 'back', icon: '↩️' },
  /*
    The run timer. Start and pause are one button, as play and pause are:
    the thing you press to stop it is the thing you press to carry on. Finish
    and its undo are apart from it on purpose, so ending a run is never the
    same tap as pausing one. None repeat — a double-tap on Finish is not two
    finishes.
  */
  { id: 'timer_toggle', category: 'timer', name: 'Start / pause', op: 'toggle', icon: '⏱' },
  { id: 'timer_finish', category: 'timer', name: 'Finish', op: 'finish', icon: '🏁' },
  { id: 'timer_undo', category: 'timer', name: 'Undo finish', op: 'undoFinish', icon: '↩️' },
  { id: 'timer_reset', category: 'timer', name: 'Reset', op: 'reset', icon: '⟲' },
  /*
    The countdown, the same way: start and pause as one button, a minute on
    and a minute off, and back to its full time. The minutes repeat — three
    presses are three minutes — and the rest do not. Starting one saved
    countdown in particular is an action with a Countdown step, put on the
    deck like any other.
  */
  { id: 'countdown_toggle', category: 'countdown', name: 'Start / pause', op: 'toggle', icon: '⏳' },
  { id: 'countdown_more', category: 'countdown', name: '+1 minute', op: 'add', amount: '1:00', icon: '➕', repeatable: true },
  { id: 'countdown_less', category: 'countdown', name: '−1 minute', op: 'add', amount: '-1:00', icon: '➖', repeatable: true },
  { id: 'countdown_reset', category: 'countdown', name: 'Reset', op: 'reset', icon: '⟲' },
  /*
    The deaths count, for the button under your hand when it happens. One
    more and one fewer repeat — three deaths in a row are three presses — and
    back to none is apart from them, so it is never the tap you meant as +1.
  */
  { id: 'deaths_add', category: 'deaths', name: 'Death +1', op: 'add', icon: '💀', repeatable: true },
  { id: 'deaths_subtract', category: 'deaths', name: 'Death −1', op: 'subtract', icon: '➖', repeatable: true },
  { id: 'deaths_reset', category: 'deaths', name: 'Deaths to zero', op: 'reset', icon: '⟲' },
  /*
    YouTube's category, flipped between the two a stream actually moves
    between: whichever of them it is not in, and from anything else Gaming.
    Not repeatable — a double-tap would flip it straight back.
  */
  { id: 'youtube_category_toggle', category: 'youtube', name: 'Gaming / People & Blogs', op: 'toggle_category', icon: '🎮', categories: ['20', '22'] },
  /*
    The pixel avatar's faces, on every avatar on screen for a few seconds —
    what the "Avatar: show a face" step does, without an action around it.
    Back to normal takes a face off early. Not repeatable: a second press
    would only start the same face again.
  */
  { id: 'avatar_happy', category: 'avatar', name: 'Happy', op: 'happy', icon: '😊' },
  { id: 'avatar_surprised', category: 'avatar', name: 'Surprised', op: 'surprised', icon: '😮' },
  { id: 'avatar_startled', category: 'avatar', name: 'Startled', op: 'startled', icon: '❗' },
  { id: 'avatar_wink', category: 'avatar', name: 'Wink', op: 'wink', icon: '😜' },
  { id: 'avatar_sad', category: 'avatar', name: 'Sad', op: 'sad', icon: '😢' },
  { id: 'avatar_angry', category: 'avatar', name: 'Angry', op: 'angry', icon: '😠' },
  { id: 'avatar_star_eyes', category: 'avatar', name: 'Star eyes', op: 'star-eyes', icon: '🤩' },
  { id: 'avatar_heart_eyes', category: 'avatar', name: 'Heart eyes', op: 'heart-eyes', icon: '😍' },
  { id: 'avatar_dizzy', category: 'avatar', name: 'Dizzy', op: 'dizzy', icon: '😵' },
  { id: 'avatar_sleepy', category: 'avatar', name: 'Sleepy', op: 'sleepy', icon: '😴' },
  { id: 'avatar_deep_sleep', category: 'avatar', name: 'Fast asleep', op: 'deep-sleep', icon: '💤' },
  { id: 'avatar_normal', category: 'avatar', name: 'Back to normal', op: 'none', icon: '🙂' },
  // Something it does once, start to end, where its outfit has been drawn doing it.
  { id: 'avatar_drink', category: 'avatar', name: 'Drink water', op: 'drink', icon: '🥤' },
  // Whatever viewers dressed it in comes off.
  { id: 'avatar_undress', category: 'avatar', name: 'Own outfit back', op: 'undress', icon: '👕' },
  /*
    Twitch, live: a clip of the last half minute (its link to chat, as the
    Twitch screen says), and a marker to find this moment in the VOD. Both
    need the stream live, and say so when it is not.
  */
  { id: 'twitch_clip', category: 'twitch', name: 'Clip it', op: 'clip', icon: '🎬' },
  { id: 'twitch_marker', category: 'twitch', name: 'Stream marker', op: 'marker', icon: '📍' },
  /*
    The question queue: the one on screen is answered and the next approved
    one goes up. Says so when nothing approved is left.
  */
  { id: 'question_next', category: 'questions', name: 'Next question', op: 'next', icon: '❓' },
];

/** How long a face from the dock stays on, in seconds. */
export const DOCK_FACE_SECONDS = 5;

/** The one with this id, or nothing. */
/*
  Something a pixel avatar from the Pixel avatars tab does, as a button of
  its own: avatar_do:<its name>. Made rather than listed — the tab's avatars
  are not known here — and played on every avatar on screen that does it.
*/
export const PIXEL_ACTION_BUILTIN = 'avatar_do:';
export const pixelActionBuiltinId = (name) => `${PIXEL_ACTION_BUILTIN}${name}`;
function pixelActionBuiltin(id) {
  const name = String(id).slice(PIXEL_ACTION_BUILTIN.length);
  if (!/^[a-z0-9][a-z0-9-]{0,39}$/.test(name)) return null;
  const words = name.replace(/-/g, ' ');
  return { id, category: 'avatar', name: words.charAt(0).toUpperCase() + words.slice(1), op: name, icon: '✨', pixel: true };
}

export const dockBuiltin = (id) => DOCK_BUILTINS.find((b) => b.id === id) || (String(id ?? '').startsWith(PIXEL_ACTION_BUILTIN) ? pixelActionBuiltin(id) : null);

/** Ids only, for the validator that has to refuse everything else. */
export const DOCK_BUILTIN_IDS = DOCK_BUILTINS.map((b) => b.id);
