/**
 * @license
 * SPDX-License-Identifier: Apache-2.0 AND LicenseRef-Commons-Clause-1.0
 *
 * The people around the run: regulars, crews, and the Discord call.
 *
 * The seats themselves — who is playing, who is hosting, who is commentating —
 * stay on the run record, which the nameplates, the couch and text layers
 * read. This keeps what fills them:
 *
 *   - regulars, the people who are on often, each with the second line their
 *     plate shows, their Twitch login for a shoutout and their Discord account
 *     for the call — so a seat is picked rather than retyped;
 *   - crews, a whole set of seats saved under a name for a night that repeats;
 *   - the Discord call, which can fill the commentator seats in one press, or
 *     keep them following whoever is in it as people join and leave.
 */

import { collection } from '../core/store.js';
import { bus, EVENTS } from '../core/bus.js';
import { createLogger } from '../core/logger.js';
import { refusal } from '../core/refusal.js';
import { MAX_COMMENTATORS, cleanPerson } from '../../shared/run.js';
import { getState as voiceNow } from '../platforms/discord-voice.js';

const log = createLogger('people');

/** More than anybody has on often; a list past this is a list nobody finds a name in. */
export const MAX_REGULARS = 50;

/** One per kind of night, which is not many. */
export const MAX_CREWS = 20;

export const DEFAULT_PEOPLE = {
  regulars: [],
  crews: [],
  /** The commentator seats follow the Discord call. */
  followCall: false,
  /** Discord accounts in the call that are never seated from it — the streamer's own, usually. */
  skip: [],
};

const EMPTY = { name: '', subtitle: '' };

let store = null;
/** How the run is read and changed: through the engine, so every change takes the run's own path. */
let deps = {};
/** The call as last heard. */
let voice = null;
/** Who was in the call last time, so talking and muting are not mistaken for somebody arriving. */
let lastMembers = null;

const clip = (v, max) => String(v ?? '').trim().slice(0, max);
const newId = () => Math.random().toString(36).slice(2, 11);
const snowflake = (v) => (/^\d{5,25}$/.test(String(v ?? '')) ? String(v) : '');
const sameName = (a, b) => String(a ?? '').trim().toLowerCase() === String(b ?? '').trim().toLowerCase();

/** Stored people with every part present, however old the file. */
export function withDefaults(raw) {
  const p = raw && typeof raw === 'object' ? raw : {};
  return {
    ...DEFAULT_PEOPLE,
    ...p,
    regulars: Array.isArray(p.regulars) ? p.regulars : [],
    crews: Array.isArray(p.crews) ? p.crews : [],
    skip: Array.isArray(p.skip) ? p.skip : [],
    followCall: p.followCall === true,
  };
}

export const getPeople = () => withDefaults(store?.get());

function write(next) {
  store.set(next);
  bus.emit(EVENTS.CONFIG, { key: 'people', value: getPeople() });
  return next;
}

/** The call now: as last heard, or asked for when nothing has been heard yet. */
function callNow() {
  if (voice) return voice;
  try {
    return voiceNow();
  } catch {
    return null;
  }
}

// ------------------------------------------------------------ the call

/** A call member as a seat: their regular if they are one, their Discord name if not. */
export function personFromMember(member, regulars = getPeople().regulars) {
  const regular = regulars.find((r) => r.discordId && r.discordId === member?.id);
  if (regular) return cleanPerson({ ...regular, discordId: member.id });
  return cleanPerson({ name: member?.name, discordId: member?.id });
}

/**
 * Who from the call sits in the commentator seats: in the call's own order
 * (pinned first, then by when they joined), leaving out who is not to be
 * seated and who already plays or hosts — somebody moved to host from the
 * call is not also a commentator.
 */
export function callSeats(members, run, people = getPeople()) {
  const seated = new Set([run?.runner?.discordId, run?.host?.discordId].filter(Boolean));
  const skip = new Set(people.skip);
  return (members || [])
    .filter((m) => m?.id && !skip.has(m.id) && !seated.has(m.id))
    .map((m) => personFromMember(m, people.regulars))
    .slice(0, MAX_COMMENTATORS);
}

/** Fill the commentator seats from the call, now. */
function fillFromCall(state = callNow()) {
  const seats = callSeats(state?.members, deps.getRun?.() || {});
  deps.setRun?.((prev) => ({ ...prev, commentators: seats }));
  return seats;
}

/** While following, a change to who is seated from the call shows at once. */
function refreshFollow() {
  if (getPeople().followCall) fillFromCall();
}

function onConfig({ key, value } = {}) {
  if (key !== 'voice') return;
  voice = value;
  const ids = (value?.members || []).map((m) => m.id).join(',');
  // Talking, muting and turning a camera on are told the same way as arriving; only arriving and leaving count.
  if (ids === lastMembers) return;
  lastMembers = ids;
  if (getPeople().followCall) {
    const seats = fillFromCall(value);
    log.info(`the call changed — ${seats.length} in the commentator seats`);
  }
}

/**
 * The run with somebody from the call in a seat.
 *
 * They leave whichever seat they were in, so nobody sits twice. A
 * commentator takes the first empty seat, or a new one while there is room.
 */
export function seatPerson(run, seat, person) {
  const same = (p) => person.discordId && p?.discordId === person.discordId;
  const next = {
    runner: same(run?.runner) ? EMPTY : (run?.runner || EMPTY),
    host: same(run?.host) ? EMPTY : (run?.host || EMPTY),
    commentators: (run?.commentators || []).filter((c) => !same(c)),
  };
  if (seat === 'runner') next.runner = person;
  else if (seat === 'host') next.host = person;
  else {
    const free = next.commentators.findIndex((c) => !c?.name);
    if (free >= 0) next.commentators[free] = person;
    else if (next.commentators.length < MAX_COMMENTATORS) next.commentators.push(person);
    else throw refusal('seats_full', 'the commentator seats are full');
  }
  return next;
}

// ------------------------------------------------------------ requests

/**
 * Everything the Who's on screen asks for, by `op`.
 *
 * Regulars are matched by their id, then their Discord account, then their
 * name, so saving a seat as a regular twice updates the one regular rather
 * than making a second of the same person. Crews are replaced by name, the
 * way saving "Among Us night" again means.
 */
export function control(payload = {}) {
  const people = getPeople();
  switch (payload.op) {
    case 'regular_save': {
      const incoming = payload.regular || {};
      const person = cleanPerson(incoming);
      if (!person.name) throw refusal('regular_name', 'a regular needs a name');
      const existing = people.regulars.find((r) => incoming.id && r.id === incoming.id)
        || people.regulars.find((r) => person.discordId && r.discordId === person.discordId)
        || people.regulars.find((r) => sameName(r.name, person.name));
      if (!existing && people.regulars.length >= MAX_REGULARS) throw refusal('regulars_full', `there are already ${MAX_REGULARS} regulars`, { n: MAX_REGULARS });
      /*
        Only what this save mentions changes. Saving somebody from the call
        brings a name and a Discord account, and must not wipe the second line
        and Twitch login they already have; a field sent empty is cleared.
      */
      const entry = { ...(existing || {}), id: existing?.id || newId(), name: person.name };
      for (const key of ['subtitle', 'twitch', 'discordId']) {
        if (!(key in incoming)) continue;
        if (person[key]) entry[key] = person[key];
        else if (key === 'subtitle') entry.subtitle = '';
        else delete entry[key];
      }
      write({ ...people, regulars: existing ? people.regulars.map((r) => (r.id === existing.id ? entry : r)) : [...people.regulars, entry] });
      refreshFollow();
      return { ok: true, id: entry.id };
    }
    case 'regular_delete': {
      write({ ...people, regulars: people.regulars.filter((r) => r.id !== payload.id) });
      refreshFollow();
      return { ok: true };
    }
    case 'crew_save': {
      const name = clip(payload.name, 60);
      if (!name) throw refusal('crew_name', 'give the crew a name');
      const run = deps.getRun?.() || {};
      const seats = {
        runner: cleanPerson(run.runner),
        host: cleanPerson(run.host),
        commentators: (run.commentators || []).map(cleanPerson).filter((p) => p.name).slice(0, MAX_COMMENTATORS),
      };
      if (!seats.runner.name && !seats.host.name && !seats.commentators.length) throw refusal('nobody_seated', 'nobody is seated');
      const existing = people.crews.find((c) => sameName(c.name, name));
      if (!existing && people.crews.length >= MAX_CREWS) throw refusal('crews_full', `there are already ${MAX_CREWS} crews`, { n: MAX_CREWS });
      const entry = { id: existing?.id || newId(), name, ...seats, savedAt: Date.now() };
      write({ ...people, crews: existing ? people.crews.map((c) => (c.id === existing.id ? entry : c)) : [...people.crews, entry] });
      log.info(`crew saved: "${name}"`);
      return { ok: true };
    }
    case 'crew_load': {
      const crew = people.crews.find((c) => c.id === payload.id);
      if (!crew) throw refusal('crew_gone', 'that crew is gone');
      deps.setRun?.((prev) => ({ ...prev, runner: crew.runner || EMPTY, host: crew.host || EMPTY, commentators: crew.commentators || [] }));
      log.info(`crew seated: "${crew.name}"`);
      return { ok: true };
    }
    case 'crew_delete': {
      write({ ...people, crews: people.crews.filter((c) => c.id !== payload.id) });
      return { ok: true };
    }
    case 'follow': {
      write({ ...people, followCall: payload.on === true });
      if (payload.on === true) fillFromCall();
      log.info(payload.on === true ? 'the commentator seats follow the call' : 'the commentator seats no longer follow the call');
      return { ok: true };
    }
    case 'skip': {
      const id = snowflake(payload.id);
      if (!id) throw refusal('nobody_to_skip', 'nobody to leave out');
      const skip = new Set(people.skip);
      if (payload.skip === false) skip.delete(id); else skip.add(id);
      write({ ...people, skip: [...skip].slice(-50) });
      refreshFollow();
      return { ok: true };
    }
    case 'fill': {
      const seats = fillFromCall();
      return { ok: true, seated: seats.length };
    }
    case 'seat': {
      const member = (callNow()?.members || []).find((m) => m.id === payload.id);
      if (!member) throw refusal('not_in_call', 'they are not in the call');
      const person = personFromMember(member, people.regulars);
      const next = seatPerson(deps.getRun?.() || {}, payload.seat, person);
      deps.setRun?.((prev) => ({ ...prev, ...next }));
      return { ok: true };
    }
    default:
      throw refusal('unknown_request', `unknown request "${payload.op}"`);
  }
}

// ------------------------------------------------------------------ wiring

/** `d` reads and changes the run: `getRun()` and `setRun(change)`. */
export function initPeople(d = {}) {
  store = collection('people', DEFAULT_PEOPLE);
  deps = d;
  bus.on(EVENTS.CONFIG, onConfig);
  const now = callNow();
  lastMembers = (now?.members || []).map((m) => m.id).join(',');
}
