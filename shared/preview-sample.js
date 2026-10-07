/**
 * @license
 * SPDX-License-Identifier: Apache-2.0 AND LicenseRef-Commons-Clause-1.0
 *
 * Something for a preview to draw.
 *
 * The library draws every stylesheet with the real component, which is the
 * point of it — but the real components are built to disappear rather than sit
 * on stream half-filled. The run card draws nothing without a game, the
 * nameplate nothing without a name, and a finished clock dims itself. Feed
 * them the live state as it is and a catalogue of styles becomes a catalogue
 * of empty boxes, which is what happened: a run with a game but no runner
 * typed in left every nameplate preset previewing as blank.
 *
 * So the gaps are filled one field at a time rather than one record at a time.
 * Whatever is really set is shown, because the preview is meant to look like
 * your overlay; whatever is not gets a stand-in, because a preview of nothing
 * says nothing about the stylesheet it is supposed to be showing.
 */

export const SAMPLE_RUN = {
  game: 'Dark Souls',
  platform: 'PS3',
  year: '2011',
  category: 'Any%',
  estimate: '1:20:00',
  runner: { name: 'Rowan', subtitle: 'he/him' },
  host: { name: 'Alex', subtitle: 'they/them' },
};

/**
 * The words a stand-in says, in the dashboard's language. A Spanish Library
 * previewing its looks with English slots and English chat reads as a screen
 * half translated; the stand-ins are words like any other on it. Names,
 * games and figures stay as they are.
 */
export const SAMPLE_WORDS = {
  en: {
    runnerPronouns: 'he/him', hostPronouns: 'they/them',
    raised: 'Raised', upNext: 'Up next', upNextText: 'Hollow Knight',
    startingSoon: 'Starting soon',
    milestone: 'Milestone!', donateNow: 'Donate now!', incentive: 'Upgrade to No Dupes', raisedForCharity: 'raised for charity',
    plan: [['Warm up', 'any%'], ['Dark Souls', 'all bosses'], ['Q and A', '']],
    question: 'What got you into speedrunning this one?',
    pollQuestion: 'Who is the impostor?', pollOptions: ['Red', 'Cyan', 'Lime', 'Nobody, skip'],
  },
  es: {
    runnerPronouns: 'él', hostPronouns: 'elle',
    raised: 'Recaudado', upNext: 'A continuación', upNextText: 'Hollow Knight',
    startingSoon: 'Empezamos pronto',
    milestone: '¡Hito!', donateNow: '¡Dona ya!', incentive: 'Desbloquear sin duplicados', raisedForCharity: 'recaudado para la causa',
    plan: [['Calentamiento', 'any%'], ['Dark Souls', 'todos los jefes'], ['Preguntas y respuestas', '']],
    question: '¿Qué te llevó a hacer speedrun de este?',
    pollQuestion: '¿Quién es el impostor?', pollOptions: ['Rojo', 'Cian', 'Lima', 'Nadie, saltar'],
  },
};
const wordsFor = (lang) => SAMPLE_WORDS[lang] || SAMPLE_WORDS.en;

const text = (value) => (typeof value === 'string' ? value.trim() : '');

/** A person with both lines filled, keeping whichever line is really set. */
const fillPerson = (person, sample) => ({
  name: text(person?.name) || sample.name,
  subtitle: text(person?.subtitle) || sample.subtitle,
});

/**
 * The run a preview should show: yours, with the blanks stood in for.
 *
 * Field by field, so a half-filled run — a game typed in but no category, no
 * estimate and nobody named, which is what a run looks like most of the time —
 * still previews a card with its chips and a plate with a name on it.
 */
export function previewRun(run, lang = 'en') {
  const w = wordsFor(lang);
  const SAMPLE = { ...SAMPLE_RUN, runner: { ...SAMPLE_RUN.runner, subtitle: w.runnerPronouns }, host: { ...SAMPLE_RUN.host, subtitle: w.hostPronouns } };
  const pick = (key) => text(run?.[key]) || SAMPLE[key];
  return {
    ...run,
    game: pick('game'),
    platform: pick('platform'),
    year: pick('year'),
    category: pick('category'),
    estimate: pick('estimate'),
    runner: fillPerson(run?.runner, SAMPLE.runner),
    host: fillPerson(run?.host, SAMPLE.host),
    commentators: (run?.commentators || []).length
      ? run.commentators.map((who) => fillPerson(who, SAMPLE.runner))
      : [fillPerson(null, SAMPLE.runner)],
  };
}

/**
 * The bar a preview should show.
 *
 * An item that is switched off is not drawn, so a bar whose every item is off
 * is an empty bar. That is correct on stream and useless here.
 */
export function previewOmnibar(omnibar, lang = 'en') {
  const live = (omnibar?.items || []).filter((item) => item && item.enabled !== false);
  if (live.length) return omnibar;
  const w = wordsFor(lang);
  return {
    enabled: true,
    defaultSeconds: 12,
    /*
      Two, and one of them pinned, because one slot is no longer what a bar
      looks like. A card showing a single cell says the bar is a place one
      thing appears in turn, which was true until a slot could be kept — and
      a theme's pinned cell is the half of it somebody is most likely to want
      and least likely to find.
    */
    items: [
      { id: 'sample-pin', type: 'text', enabled: true, pinned: true, label: w.raised, text: '$4,120' },
      { id: 'sample', type: 'text', enabled: true, label: w.upNext, text: w.upNextText },
    ],
    style: omnibar?.style,
  };
}

/**
 * The clock a preview should show: your label, your type size, your colours,
 * held at the time it starts from.
 *
 * Not the live mode. A timer spends almost all of its life either never
 * started or long finished, and a finished one deliberately dims itself to
 * say so — which in a catalogue reads as the stylesheet having washed the
 * digits out. Idle at its full duration is the moment the styling is for.
 */
export function previewCountdown(countdown, lang = 'en') {
  const durationMs = countdown?.durationMs || 300000;
  return {
    ...(countdown || {}),
    mode: 'idle',
    endsAt: null,
    remainingMs: durationMs,
    durationMs,
    label: text(countdown?.label) || wordsFor(lang).startingSoon,
  };
}

/**
 * A tall bar for a look to be drawn on: a goal card, and the total pinned.
 *
 * A goal because it is the card the tall bar is most for, and the one with the
 * most parts for a look to dress — the track, the fill, the marker riding it.
 */
export function previewTallBar(omnibar, lang = 'en') {
  const w = wordsFor(lang);
  return {
    id: 'preview-tall',
    name: 'Preview',
    kind: 'tall',
    enabled: true,
    defaultSeconds: 60,
    style: { ...(omnibar?.style || {}), height: 110 },
    items: [
      { id: 'sample-tall-goal', type: 'goal', enabled: true, label: w.milestone, sublabel: w.donateNow, text: w.incentive, goalSource: 'manual', goalTarget: 100000, goalValue: 90393, goalShow: 'remaining', goalPrefix: '$' },
      { id: 'sample-tall-total', type: 'text', enabled: true, pinned: true, text: '$90,418', sublabel: w.raisedForCharity },
    ],
  };
}

/**
 * The run timer a preview should show: stopped part-way through a run.
 *
 * A timer at 00:00.0 shows nothing of the look but its zeros, and one still
 * running would be a card that ticks. A time held still is the digits a look
 * is about, drawn the way a run shows them.
 */
export function previewStopwatch(stopwatch) {
  return { ...(stopwatch || {}), mode: 'running', startedAt: null, elapsedMs: 20 * 60 * 1000 + 34500 };
}

/**
 * The counter a preview should show.
 *
 * A viewer counter draws nothing but the offline word when no platform is
 * live, which is most of the time you would be sitting in the library picking
 * a style. Showing the offline platforms fills it without overriding which
 * platforms you count: one you have switched off stays off.
 */
export function previewViewers(viewers) {
  return { ...(viewers || {}), showOffline: true };
}

/** A count worth drawing. Yours when there is one, a stand-in when there is not. */
const count = (value, sample) => (Number(value) > 0 ? Number(value) : sample);

export function previewStats(stats) {
  return {
    ...(stats || {}),
    twitchViewers: count(stats?.twitchViewers, 128),
    youtubeViewers: count(stats?.youtubeViewers, 64),
    tiktokViewers: count(stats?.tiktokViewers, 41),
  };
}

/**
 * The players a preview should show.
 *
 * Yours when there are enough to fill a page and somebody is out — a look
 * for this layer is mostly about how a player who is out reads, and a list
 * where everybody is in hides it. Otherwise a lobby of ten with one of each.
 */
export function previewPlayers(players) {
  const items = players?.items || [];
  if (items.length >= 6 && items.some((p) => p.state !== 'in')) return players;
  const lobby = [
    ['Rowan', '#c51111', 'in'], ['Nolan', '#132ed1', 'in'], ['Ninja', '#117f2d', 'ejected'],
    ['Kiwi', '#f5f557', 'in'], ['Luna', '#ed54ba', 'in'], ['Rex', '#ef7d0d', 'dead'],
    ['Mochi', '#38fedc', 'in'], ['Echo', '#6b2fbb', 'in'], ['Pixel', '#50ef39', 'out'], ['Toast', '#d6e0f0', 'in'],
  ];
  return { items: lobby.map(([name, colour, state], i) => ({ id: `pv${i}`, name, colour, state })) };
}

/**
 * The plan a preview should show.
 *
 * A plan with nothing in it draws nothing, and yours is usually either empty
 * or about tonight rather than about a stylesheet. Three lines with one of
 * them current and one done is the only state that shows what a look does:
 * an all-to-come list says nothing about how a finished line reads.
 */
export function previewPlan(plan, lang = 'en') {
  /*
    Yours only when it shows all three states, which is a higher bar than the
    other previews set — and deliberately. A run card with a real game and a
    borrowed category is still a run card, but a plan where nothing is behind
    you hides half of what a look for it decides, and half of a picture is
    worse than a picture of something else.
  */
  const items = plan?.items || [];
  const current = items.some((i) => i.id === plan?.currentId);
  const behind = items.some((i) => i.done);
  const ahead = items.some((i) => !i.done && i.id !== plan?.currentId);
  if (current && behind && ahead) return plan;
  return {
    items: [
      { id: 'p1', text: wordsFor(lang).plan[0][0], note: wordsFor(lang).plan[0][1], done: true },
      { id: 'p2', text: wordsFor(lang).plan[1][0], note: wordsFor(lang).plan[1][1] },
      { id: 'p3', text: wordsFor(lang).plan[2][0] },
    ],
    currentId: 'p2',
  };
}

/**
 * The question a preview should show.
 *
 * The overlay draws nothing at all unless one is being shown, which is right
 * on stream — it sits in a layout all year and appears for the segment it is
 * for — and useless in a catalogue. Yours when one is up, a stand-in when not.
 */
export function previewQuestions(questions, lang = 'en') {
  const showing = (questions?.items || []).find((q) => q.id === questions?.showingId);
  if (showing) return questions;
  return {
    items: [{ id: 'q1', user: 'pixelpepp', text: wordsFor(lang).question }],
    showingId: 'q1',
  };
}

/**
 * The poll a preview should show.
 *
 * Nothing is drawn while no poll is up, which is most of the time. Yours when
 * one is open, otherwise one halfway through with a clear leader, so a look
 * shows how the leading answer reads.
 */
export function previewPoll(poll, lang = 'en') {
  if (poll && poll.mode === 'open' && (poll.options || []).length) return poll;
  const options = wordsFor(lang).pollOptions;
  const counts = [14, 6, 3, 2];
  return {
    mode: 'open', question: wordsFor(lang).pollQuestion, options, counts,
    total: counts.reduce((a, b) => a + b, 0), leaders: [0], byPlatform: { twitch: 17, youtube: 8 },
    endsAt: null, rules: { numbers: true, words: true, change: true },
  };
}

/**
 * The call a preview should show.
 *
 * Yours when there are a few people in it, otherwise four with Discord's
 * own default avatars: one talking, one muted and one deafened, since that
 * is what a look for this layer decides.
 */
export function previewVoice(voice) {
  if ((voice?.members || []).length >= 3) return voice;
  const people = [['Rowan', true, false, false], ['Nolan', false, false, false], ['Kiwi', false, true, false], ['Luna', false, false, true]];
  // Somebody's own pictures, when anybody has some, on the one who is talking — so a look can be seen with them.
  const [pictured] = Object.values(voice?.pictures || {});
  return {
    channelId: 'preview', listen: true, status: 'listening',
    members: people.map(([name, speaking, muted, deafened], i) => ({
      id: `pv${i}`, name, avatar: `https://cdn.discordapp.com/embed/avatars/${i}.png`, speaking, muted, deafened,
      ...(i === 0 && pictured ? { name: pictured.name || name, pictures: pictured } : {}),
    })),
  };
}

/** One snapshot with every preview fed, its stand-ins in the dashboard's language. */
export function previewSystem(system, lang = 'en') {
  const data = system?.data || {};
  return {
    ...system,
    data: {
      ...data,
      run: previewRun(data.run, lang),
      omnibar: previewOmnibar(data.omnibar, lang),
      countdown: previewCountdown(data.countdown, lang),
      // A tall bar a tall-bar look can be drawn on, beside whatever bars there are.
      omnibars: [...(data.omnibars || []), previewTallBar(data.omnibar, lang)],
      stopwatch: previewStopwatch(data.stopwatch),
      plan: previewPlan(data.plan, lang),
      questions: previewQuestions(data.questions, lang),
      players: previewPlayers(data.players),
      poll: previewPoll(data.poll, lang),
      voice: previewVoice(data.voice),
      viewers: previewViewers(data.viewers),
      stats: previewStats(data.stats),
    },
  };
}
