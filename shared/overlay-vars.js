/**
 * @license
 * SPDX-License-Identifier: Apache-2.0 AND LicenseRef-Commons-Clause-1.0
 *
 * The values a free text layer can put on screen.
 *
 * Named once, here, because three things need the same list: the layer that
 * resolves them, the editor that offers them, and the tests that check the two
 * agree. A picker offering a variable nothing resolves would leave "{foo}" on
 * stream, which is exactly the failure this is arranged to prevent.
 *
 * Everything here is already in the snapshot. Nothing new is fetched, and
 * nothing is computed on the server — a text layer is a different arrangement
 * of what every other overlay is already reading.
 */

/**
 * Each entry: the name typed in braces, a label for the picker, and how to get
 * it out of the client's state.
 *
 * Kept as a flat list of single words rather than dotted paths. A person
 * writing "{followers} seguidores" is not thinking about object shapes, and
 * the shapes here are not stable enough to expose — `latestDonation` is a
 * whole object with a currency in it.
 */
export const OVERLAY_VARS = [
  // --- counts ---------------------------------------------------------------
  { name: 'followers', label: 'Follower count', get: (s) => s.stats?.twitchFollowers },
  { name: 'subs', label: 'Subscriber count', get: (s) => s.stats?.twitchSubs },
  { name: 'viewers', label: 'Viewers now', get: (s) => s.stats?.twitchViewers },
  { name: 'youtubeViewers', label: 'YouTube viewers now', get: (s) => (s.stats?.youtubeLive ? s.stats?.youtubeViewers : undefined) },
  { name: 'tiktokLikes', label: 'TikTok likes', get: (s) => s.stats?.tiktokLikes },

  // --- who did what last ----------------------------------------------------
  { name: 'latestFollower', label: 'Latest follower', get: (s) => s.streamTags?.latestFollower?.user },
  { name: 'latestSubscriber', label: 'Latest subscriber', get: (s) => s.streamTags?.latestSubscriber?.user },
  { name: 'latestDonation', label: 'Latest donation (who)', get: (s) => s.streamTags?.latestDonation?.user },
  { name: 'latestDonationAmount', label: 'Latest donation (how much)', get: (s) => s.streamTags?.latestDonation?.amount },
  { name: 'topDonation', label: 'Biggest donation (who)', get: (s) => s.streamTags?.topDonation?.user },
  { name: 'topDonationAmount', label: 'Biggest donation (how much)', get: (s) => s.streamTags?.topDonation?.amount },
  { name: 'latestRaid', label: 'Latest raid', get: (s) => s.streamTags?.latestRaid?.user },

  // --- what is playing ------------------------------------------------------
  { name: 'nowPlaying', label: 'Song playing', get: (s) => s.spotifyTrack?.name },
  { name: 'nowPlayingArtist', label: 'Song artist', get: (s) => s.spotifyTrack?.artist },

  // --- what is being played -------------------------------------------------
  { name: 'game', label: 'Game', get: (s) => s.run?.game },
  { name: 'platform', label: 'Platform', get: (s) => s.run?.platform },
  { name: 'gameYear', label: 'Year the game came out', get: (s) => s.run?.year },
  { name: 'category', label: 'Category', get: (s) => s.run?.category },
  { name: 'estimate', label: 'Estimate', get: (s) => s.run?.estimate },
  { name: 'runner', label: 'Who is playing', get: (s) => s.run?.runner?.name },
  { name: 'host', label: 'Who is hosting', get: (s) => s.run?.host?.name },
  {
    name: 'commentators',
    label: 'Who is commentating',
    // Joined here rather than offered as four variables: a line that reads
    // "con Ana, Bo y Cy" is the thing people write, and building it out of
    // {commentator1}{commentator2} means writing the commas by hand and
    // getting a trailing one whenever somebody leaves. In Spanish, because
    // it is read on stream.
    get: (s) => {
      const names = (s.run?.commentators || []).map((c) => c?.name).filter(Boolean);
      if (names.length < 2) return names[0];
      return `${names.slice(0, -1).join(', ')} y ${names[names.length - 1]}`;
    },
  },

  // --- what the stream is doing ---------------------------------------------
  {
    name: 'planNow',
    label: 'Plan: happening now',
    get: (s) => (s.plan?.items || []).find((i) => i.id === s.plan?.currentId)?.text,
  },
  {
    name: 'planNext',
    label: 'Plan: up next',
    get: (s) => {
      const items = s.plan?.items || [];
      const at = items.findIndex((i) => i.id === s.plan?.currentId);
      return items[(at < 0 ? -1 : at) + 1]?.text;
    },
  },

  // --- who is playing tonight ----------------------------------------------
  /*
    From the Players list: "7/15 crewmates" in a lobby, "4 left" in a game.
    Still in is everyone not out, ejected or dead.
  */
  { name: 'playersIn', label: 'Players still in', get: (s) => (s.players?.items ? s.players.items.filter((p) => p.state === 'in').length : undefined) },
  { name: 'playersTotal', label: 'Players on the list', get: (s) => (s.players?.items ? s.players.items.length : undefined) },

  // --- the poll -------------------------------------------------------------
  { name: 'pollQuestion', label: 'The poll question', get: (s) => (s.poll && s.poll.mode !== 'idle' ? s.poll.question : undefined) },
  { name: 'pollVotes', label: 'Votes in the poll', get: (s) => (s.poll && s.poll.mode !== 'idle' ? s.poll.total : undefined) },
  /* A tie names every answer in it. */
  { name: 'pollLeader', label: 'The answer winning the poll', get: (s) => (s.poll?.leaders?.length ? s.poll.leaders.map((i) => s.poll.options[i]).join(' / ') : undefined) },

  // --- the Discord call -----------------------------------------------------
  { name: 'voiceCount', label: 'People in the Discord call', get: (s) => (s.voice?.channelId ? (s.voice.members || []).length : undefined) },
  { name: 'voiceTalking', label: 'Who is talking in the Discord call', get: (s) => ((s.voice?.members || []).filter((m) => m.speaking).map((m) => m.name).join(', ') || undefined) },

  // --- the next stream, from the Twitch schedule ---------------------------
  /*
    In this computer's own time and words, so OBS shows it the way it shows
    {time}. Empty while there is nothing on the schedule, so a line reading
    "Próximo stream: {nextStream}" shows its dash rather than a wrong date.
  */
  { name: 'nextStream', label: 'Next stream: day and time', get: (s) => nextAt(s, (d) => d.toLocaleString([], { weekday: 'long', day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })) },
  { name: 'nextStreamDay', label: 'Next stream: the day', get: (s) => nextAt(s, (d) => d.toLocaleDateString([], { weekday: 'long', day: 'numeric', month: 'long' })) },
  { name: 'nextStreamTime', label: 'Next stream: the time', get: (s) => nextAt(s, (d) => d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })) },
  { name: 'nextStreamIn', label: 'Next stream: how long until', get: (s) => nextAt(s, (d) => untilWords(d)) },
  { name: 'nextStreamTitle', label: 'Next stream: its title', get: (s) => s.twitchSchedule?.next?.title || undefined },
  { name: 'nextStreamGame', label: 'Next stream: its game', get: (s) => s.twitchSchedule?.next?.category || undefined },

  // --- counted by hand -------------------------------------------------------
  // "MUERTES: {deaths}". Changed by the Deaths step, the deck's buttons or the Game screen.
  { name: 'deaths', label: 'Deaths', get: (s) => s.counters?.deaths ?? 0 },

  // --- the clock ------------------------------------------------------------
  { name: 'time', label: 'Time now', get: () => new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) },
  { name: 'date', label: "Today's date", get: () => new Date().toLocaleDateString() },
];

/** The next stream's start as a Date, put into words by `say`, or nothing when there is none. */
function nextAt(s, say) {
  const iso = s?.twitchSchedule?.next?.start;
  const d = iso ? new Date(iso) : null;
  return d && !Number.isNaN(d.getTime()) ? say(d) : undefined;
}

/** "in 2 days", "in 5 hours", "tomorrow" — in this computer's language. */
function untilWords(d, now = Date.now()) {
  const words = new Intl.RelativeTimeFormat([], { numeric: 'auto' });
  const minutes = Math.round((d.getTime() - now) / 60000);
  if (Math.abs(minutes) < 60) return words.format(minutes, 'minute');
  const hours = Math.round(minutes / 60);
  if (Math.abs(hours) < 36) return words.format(hours, 'hour');
  return words.format(Math.round(hours / 24), 'day');
}

const BY_NAME = new Map(OVERLAY_VARS.map((v) => [v.name, v]));

/**
 * Fill in a template against the current state.
 *
 * An unknown name is left exactly as typed rather than blanked. That is
 * deliberate and matches how the rest of this app interpolates: a typo that
 * disappears is a mystery, and a typo that shows up as "{folowers}" on the
 * preview is a thing you can see and fix before it goes out.
 *
 * A known name whose value is missing — no song playing, no raid yet — is
 * replaced with the fallback, because that is an absence rather than a
 * mistake, and an overlay reading "undefined" is worse than one reading "—".
 */
export function fillTemplate(template, state, fallback = '—') {
  return String(template ?? '').replace(/\{([a-zA-Z]+)\}/g, (whole, name) => {
    const entry = BY_NAME.get(name);
    if (!entry) return whole;
    let value;
    try {
      value = entry.get(state || {});
    } catch {
      value = undefined;
    }
    if (value === undefined || value === null || value === '') return fallback;
    return typeof value === 'number' ? value.toLocaleString() : String(value);
  });
}
