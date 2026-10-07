/**
 * @license
 * SPDX-License-Identifier: Apache-2.0 AND LicenseRef-Commons-Clause-1.0
 *
 * Variable resolution and template interpolation.
 *
 * Two surfaces:
 *   - `resolve(path, ctx)`   -> a raw value, used by condition evaluation
 *                               ('user.isSub', 'random.1-100', 'message.content')
 *   - `interpolate(str, ctx)`-> a string, used by chat/TTS/OBS text
 *                               ('{user} just followed!')
 */

import { says } from '../../shared/platforms.js';

/**
 * The Spotify half of the context: V2's {spotify.track} and {spotify.artist},
 * plus the rest of what the poller already knows.
 *
 * Always present, even with nothing playing, so a template renders an empty
 * string rather than leaving "{spotify.track}" on screen.
 */
export function nowPlayingVars(track, upNext) {
  return {
    track: track?.name ?? '',
    artist: track?.artist ?? '',
    album: track?.album ?? '',
    coverUrl: track?.coverUrl ?? '',
    isPlaying: Boolean(track?.isPlaying),

    // Declared empty rather than absent. A queue step fills these in, but it
    // does not always run — a song request with no song name, Spotify not
    // signed in, nothing found for the search. An unknown path is left as
    // "{spotify.queuedTrack}" on purpose, so that a typo shows up; leaving
    // these undefined meant chat printed the placeholder to viewers.
    queuedTrack: '',
    queuedArtist: '',
    queuedAlbum: '',
    queuedUrl: '',

    // What Spotify says is coming after this one. Read from its own queue, so
    // shuffle and playlist order are already accounted for; empty when there
    // is genuinely nothing lined up rather than guessed at.
    nextTrack: upNext?.name ?? '',
    nextArtist: upNext?.artist ?? '',
    nextAlbum: upNext?.album ?? '',
    nextCoverUrl: upNext?.coverUrl ?? '',
    nextUrl: upNext?.url ?? '',
  };
}

/**
 * Build the evaluation context handed to every step in an action run.
 */
export function buildContext({
  user = {}, message = '', args = undefined, event = null, platform = 'system',
  nowPlaying = null, upNext = null, extra = {},
} = {}) {
  const raw = String(message);
  const words = raw.trim().split(/\s+/).filter(Boolean);

  // When a command fired this, `args` is the text after the trigger word.
  //
  // `{message}` then means that, not the whole line — writing
  // "{user} dice {message}" for a `!tts hello` should say "hello", not
  // "tts hello". Every chat bot behaves this way, and reading the trigger
  // aloud is never what an author wants. The untouched line stays available
  // as `{message.raw}`.
  const isCommand = args !== undefined;
  const content = isCommand ? String(args) : raw;

  return {
    user: {
      name: user.name ?? user.user ?? 'Someone',
      id: user.id ?? null,
      avatar: user.avatar ?? null,
      isSub: Boolean(user.isSub),
      isMod: Boolean(user.isMod),
      isVip: Boolean(user.isVip),
      isBroadcaster: Boolean(user.isBroadcaster),
      platform: user.platform ?? platform,
    },
    message: {
      content,
      raw,
      words,
      args: isCommand ? String(args) : words.slice(1).join(' '),
    },
    event: event ? { type: event.type, ...event.data } : {},
    /**
     * What the viewer supplied, whichever way they supplied it.
     *
     * V2 called this `{input}` and used it everywhere — song requests, stream
     * titles, TTS, reward text. The alias table below already carries V2's
     * other single-word names, but this one was missed, so those templates
     * came out with a literal "{input}" in them. It cannot be a plain alias
     * because it means two things: the text after a trigger word when a
     * command fired the action, and the viewer's typed text when a channel
     * point reward did.
     */
    input: isCommand ? String(args) : (event?.data?.input ?? ''),
    spotify: nowPlayingVars(nowPlaying, upNext),
    platform,
    /*
      What this platform calls the people watching it.

      One caption, read correctly wherever it fires: "{user} is a new
      {words.follower}" says Follower on Twitch and Subscriber on YouTube,
      because those are the same thing under different names. Without this a
      caption written once is wrong on one of the two, and written twice is two
      alerts to keep in step.
    */
    words: {
      follower: says(platform, 'follower'),
      followers: says(platform, 'followers'),
      followed: says(platform, 'followed'),
      supporter: says(platform, 'supporter'),
      supporters: says(platform, 'supporters'),
      gift: says(platform, 'gift'),
      tip: says(platform, 'tip'),
    },
    ...extra,
  };
}

/** Resolve a dotted path against the context. Supports the `random.A-B` pseudo-path. */
export function resolve(pathStr, ctx) {
  if (!pathStr) return undefined;

  // random.1-100 -> inclusive integer in range
  const rand = /^random\.(-?\d+)-(-?\d+)$/.exec(pathStr);
  if (rand) {
    const lo = Number(rand[1]);
    const hi = Number(rand[2]);
    const [min, max] = lo <= hi ? [lo, hi] : [hi, lo];
    return Math.floor(Math.random() * (max - min + 1)) + min;
  }

  return pathStr.split('.').reduce((acc, key) => (acc == null ? undefined : acc[key]), ctx);
}

/**
 * Replace `{path}` placeholders. Unknown paths are left intact so a typo is
 * visible in the output rather than silently becoming "undefined".
 *
 * Legacy single-word aliases from V2 ({user}, {count}, {level}) are mapped
 * onto their dotted equivalents for backwards compatibility.
 */
const ALIASES = {
  user: 'user.name',
  username: 'user.name',
  message: 'message.content',
  args: 'message.args',
  platform: 'platform',
};

export function interpolate(template, ctx) {
  if (typeof template !== 'string' || !template.includes('{')) return template ?? '';

  return template.replace(/\{([a-zA-Z0-9_.\-]+)\}/g, (match, key) => {
    const target = ALIASES[key] ?? key;
    const value = resolve(target, ctx);
    if (value === undefined || value === null) return match;
    return String(value);
  });
}
