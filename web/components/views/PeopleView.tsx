/**
 * @license
 * SPDX-License-Identifier: Apache-2.0 AND LicenseRef-Commons-Clause-1.0
 *
 * Who is on: whoever is playing, the host, and the commentators.
 *
 * Kept on the run record with the game, because that is what the nameplates,
 * the couch and text layers read — a plate set to follow "Commentator 2"
 * follows whoever is in that seat here, so a guest changing is one edit rather
 * than four plates to retype. It is a screen of its own because people change
 * at different moments from the game: as guests arrive and leave, while live.
 *
 * Around the seats: regulars to pick instead of retyping, crews to seat a
 * whole night at once, and the Discord call to seat people from — once, or
 * following it as people come and go. Those live in server/engine/people.js.
 *
 * Every field commits when you leave it rather than on each keystroke: the
 * server trims what it stores, and a field that saved per keystroke would make
 * a space impossible to type.
 */
import React, { useEffect, useState } from 'react';
import {
  Mic, Plus, User, Radio, Eye, EyeOff, Star, Megaphone, Trash2, Headphones, Users, Check, Save,
} from 'lucide-react';
import { RosterLayer } from '../RosterLayer';
import { CommittedInput } from '../CommittedInput';
import { MAX_COMMENTATORS } from '../../../shared/run.js';
import { refusalWords, shoutoutWords } from '../../words';
import { ClearButton, EMPTY_PERSON, Heading, Person, PREVIEW_GROUND, RunScreenProps, firstLayer } from '../RunParts';

export interface Regular extends Person { id: string }
export interface Crew { id: string; name: string; runner?: Person; host?: Person; commentators?: Person[] }
export interface PeopleState { regulars: Regular[]; crews: Crew[]; followCall: boolean; skip: string[] }
export interface CallMember { id: string; name: string; avatar?: string; speaking?: boolean }

interface Props extends RunScreenProps {
  people?: PeopleState;
  peopleControl: (payload: Record<string, any>) => Promise<any>;
  voice?: { channelId?: string; members?: CallMember[] };
  shoutout: (login: string) => Promise<any>;
}

/** Put values into a sentence: "Shout out {login}". */
const fill = (text: string, vars: Record<string, string>) =>
  Object.entries(vars).reduce((out, [k, v]) => out.split(`{${k}}`).join(v), String(text));

const small = 'bg-zinc-950/60 border border-zinc-800 rounded-md px-1.5 py-1 text-[10px] text-zinc-300 outline-none focus:border-current-accent disabled:opacity-40';
const input = 'w-full bg-zinc-950/60 border border-zinc-800 rounded-lg px-2.5 py-1.5 text-[11px] text-zinc-200 outline-none focus:border-current-accent disabled:opacity-50';

/** A setting that is on or off, in the look the rest of the app uses. */
const Toggle = ({ on, onClick, text, hint }: { on: boolean; onClick: () => void; text: string; hint?: string }) => (
  <div className="space-y-2">
    <button
      onClick={onClick}
      className={`w-full px-4 py-3 rounded-xl text-[10px] font-black border transition-all uppercase tracking-widest flex items-center justify-between gap-3 text-left ${
        on ? 'bg-current-accent/10 border-current-accent text-current-accent' : 'bg-zinc-900 border-zinc-800 text-zinc-500'
      }`}
    >
      <span>{text}</span>
      {on && <Check size={14} className="shrink-0" />}
    </button>
    {hint && <p className="text-[10px] text-zinc-600 leading-relaxed px-1">{hint}</p>}
  </div>
);

export const PeopleView = ({ run, setRun, layouts, people, peopleControl, voice, shoutout, t }: Props) => {
  const save = (patch: Record<string, any>) => setRun({ ...run, ...patch });
  const commentators = run?.commentators || [];
  const regulars = people?.regulars || [];
  const crews = people?.crews || [];
  const skip = new Set(people?.skip || []);
  const following = people?.followCall === true;

  // A short word under a seat — "Saved as a regular", a shoutout's answer — and a problem, if a request says no.
  const [notes, setNotes] = useState<Record<string, { text: string; warn?: boolean }>>({});
  const [problem, setProblem] = useState('');
  const [crewName, setCrewName] = useState('');
  const [newRegular, setNewRegular] = useState<Person>({ name: '', subtitle: '', twitch: '' });
  useEffect(() => {
    if (!problem) return undefined;
    const id = setTimeout(() => setProblem(''), 8000);
    return () => clearTimeout(id);
  }, [problem]);

  // A warning — a shoutout that only partly went — stays long enough to read.
  const note = (slot: string, text: string, warn = false) => {
    setNotes((n) => ({ ...n, [slot]: { text, warn } }));
    setTimeout(() => setNotes((n) => (n[slot]?.text === text ? { ...n, [slot]: { text: '' } } : n)), warn ? 9000 : 5000);
  };
  const ask = async (payload: Record<string, any>) => {
    setProblem('');
    try {
      return await peopleControl(payload);
    } catch (err: any) {
      setProblem(refusalWords(t, err));
      return null;
    }
  };

  // ------------------------------------------------------------------ seats

  /*
    Every seat by a key, so moving somebody is swapping two keys: to the host's
    seat, the host comes to theirs — nobody is lost, and a move is undone by
    moving back.
  */
  const slots = [
    { key: 'runner', label: t.runRunner || 'Playing' },
    { key: 'host', label: t.runHost || 'Host' },
    ...commentators.map((_, i) => ({ key: `c${i}`, label: `${t.runCommentator || 'Commentary'} ${i + 1}` })),
  ];
  const seatOf = (key: string): Person => (key === 'runner' ? run?.runner : key === 'host' ? run?.host : commentators[Number(key.slice(1))]) || EMPTY_PERSON;
  const seats = () => ({ runner: run?.runner || EMPTY_PERSON, host: run?.host || EMPTY_PERSON, commentators: [...commentators] });
  const put = (next: ReturnType<typeof seats>, key: string, person: Person) => {
    if (key === 'runner') next.runner = person;
    else if (key === 'host') next.host = person;
    else next.commentators[Number(key.slice(1))] = person;
  };
  const setSeat = (key: string, person: Person) => { const next = seats(); put(next, key, person); save(next); };
  const move = (from: string, to: string) => {
    if (from === to) return;
    const next = seats();
    const a = seatOf(from);
    const b = seatOf(to);
    put(next, from, b);
    put(next, to, a);
    save(next);
  };
  const pickRegular = (key: string, id: string) => {
    const r = regulars.find((x) => x.id === id);
    if (!r) return;
    const { id: _id, ...person } = r;
    setSeat(key, person);
  };
  const saveAsRegular = async (key: string, person: Person) => {
    if (await ask({ op: 'regular_save', regular: person })) note(key, t.peopleSavedRegular || 'Saved as a regular');
  };
  const shout = async (key: string, login: string) => {
    try {
      const said = shoutoutWords(t, await shoutout(login));
      note(key, said.text, !said.ok);
    } catch (err: any) {
      note(key, refusalWords(t, err), true);
    }
  };

  const clearPeople = () => {
    if (!window.confirm(t.runClearPeopleConfirm || 'Take everybody off: the player, the host and every commentator?')) return;
    save({ runner: EMPTY_PERSON, host: EMPTY_PERSON, commentators: [] });
  };

  const people_ = [run?.runner, run?.host, ...commentators].filter((p) => (p?.name || '').trim());

  /*
    A seat's markup, called as a function rather than rendered as a component.
    Declared in here as a component it would be a new type on every render,
    so React would rebuild the fields each time the server sent anything —
    and a field rebuilt while you type loses what you were typing.
  */
  const seat = (slot: string, label: string, icon: React.ReactNode, removable = false) => {
    const person = seatOf(slot);
    // While the seats follow the call, the call decides the commentators.
    const locked = following && slot.startsWith('c');
    return (
      <div key={slot} className="rounded-xl border border-zinc-800 bg-zinc-900/40 p-3 space-y-2" data-seat={slot}>
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-zinc-500">{icon}</span>
          <span className="flex-1 min-w-[6rem] text-[9px] font-black uppercase tracking-widest text-zinc-400">{label}</span>
          <select value={slot} onChange={(e) => move(slot, e.target.value)} disabled={locked} title={t.peopleMoveTo || 'Move to another seat'} className={small} data-seat-move>
            {slots.map((s) => <option key={s.key} value={s.key}>{s.label}</option>)}
          </select>
          {regulars.length > 0 && !locked && (
            <select value="" onChange={(e) => e.target.value && pickRegular(slot, e.target.value)} className={small} data-seat-regular>
              <option value="">{t.peoplePickRegular || 'Regulars…'}</option>
              {regulars.map((r) => <option key={r.id} value={r.id}>{r.name}</option>)}
            </select>
          )}
          {person.name && (
            <button onClick={() => saveAsRegular(slot, person)} title={t.peopleSaveRegular || 'Save as a regular'} className="p-1 text-zinc-600 hover:text-current-accent">
              <Star size={13} />
            </button>
          )}
          {person.twitch && (
            <button onClick={() => shout(slot, person.twitch!)} title={fill(t.peopleShoutout || 'Shout out {login}', { login: person.twitch })} className="p-1 text-zinc-600 hover:text-current-accent" data-seat-shoutout>
              <Megaphone size={13} />
            </button>
          )}
          {removable && !locked && (
            <button onClick={() => save({ commentators: commentators.filter((_, n) => `c${n}` !== slot) })} title={t.runRemove || 'Remove'} className="p-1 text-zinc-600 hover:text-rose-500">
              <Trash2 size={13} />
            </button>
          )}
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
          <CommittedInput value={person.name || ''} placeholder={t.runName || 'Name'} disabled={locked} onCommit={(v: string) => setSeat(slot, { ...person, name: v })} className={input} />
          <CommittedInput value={person.subtitle || ''} placeholder={t.runSecondLine || 'he/him — @handle'} disabled={locked} onCommit={(v: string) => setSeat(slot, { ...person, subtitle: v })} className={input} />
          <CommittedInput value={person.twitch || ''} placeholder={t.peopleTwitchHint || 'Twitch login'} disabled={locked} onCommit={(v: string) => setSeat(slot, { ...person, twitch: v })} className={input} />
        </div>
        {notes[slot]?.text && <p className={`text-[10px] font-bold ${notes[slot].warn ? 'text-amber-400' : 'text-current-accent'}`}>{notes[slot].text}</p>}
      </div>
    );
  };

  // ------------------------------------------------------------------ call

  const members = voice?.members || [];
  const regularFor = (m: CallMember) => regulars.find((r) => r.discordId === m.id);

  // --------------------------------------------------------------- crews

  const loadCrew = async (crew: Crew) => {
    const name = crew.name;
    if (people_.length && !window.confirm(fill(t.peopleCrewLoadConfirm || 'Replace everybody seated now with “{name}”?', { name }))) return;
    await ask({ op: 'crew_load', id: crew.id });
  };

  return (
    <div className="space-y-5 max-w-3xl">
      {problem && (
        <p role="alert" className="rounded-xl border border-rose-500/40 bg-rose-500/10 px-4 py-2 text-[11px] font-bold text-rose-300">{problem}</p>
      )}

      <div className="glass-panel rounded-3xl border border-zinc-800 p-5 space-y-3">
        <Heading
          icon={<Mic size={14} />}
          text={t.runPeople || 'Who is on'}
          action={people_.length || commentators.length ? <ClearButton onClick={clearPeople} t={t} /> : undefined}
        />

        {seat('runner', t.runRunner || 'Playing', <User size={13} />)}
        {seat('host', t.runHost || 'Host', <Radio size={13} />)}

        {following && (
          <p className="text-[10px] font-bold text-current-accent leading-relaxed" data-people-following>
            {t.peopleFollowing || 'The commentator seats follow the Discord call. Turn that off below to type in them.'}
          </p>
        )}
        {/*
          Removing takes the seat away rather than clearing it: an empty seat
          is kept, so clearing the name would leave a row for nobody.
        */}
        {commentators.map((_, i) => seat(`c${i}`, `${t.runCommentator || 'Commentary'} ${i + 1}`, <Mic size={13} />, true))}

        {commentators.length < MAX_COMMENTATORS && !following && (
          <button
            onClick={() => save({ commentators: [...commentators, { name: '', subtitle: '' }] })}
            className="flex items-center gap-1.5 px-3 py-2 rounded-lg bg-zinc-900/60 border border-zinc-800 text-[9px] font-black uppercase tracking-widest text-zinc-400 hover:text-white hover:border-zinc-700"
          >
            <Plus size={12} /> {t.runAddCommentator || 'Add commentary'}
          </button>
        )}

        <p className="text-[10px] text-zinc-600 leading-relaxed">
          {t.peopleHint || 'Read by nameplates set to follow somebody, by the couch layer, and by text layers as {runner}, {host} and {commentators}.'}
        </p>
      </div>

      {/* The Discord call: seat somebody from it, fill the commentators from it, or follow it. */}
      <div className="glass-panel rounded-3xl border border-zinc-800 p-5 space-y-3" data-people-call>
        <Heading icon={<Headphones size={14} />} text={t.peopleCall || 'The Discord call'} />
        {!voice?.channelId ? (
          <p className="text-[10px] text-zinc-600 leading-relaxed">{t.peopleCallNone || 'Choose a call on the Voice call screen to seat people from it.'}</p>
        ) : (
          <>
            {members.length === 0 ? (
              <p className="text-[10px] text-zinc-600">{t.peopleCallEmpty || 'Nobody is in the call right now.'}</p>
            ) : (
              <div className="space-y-1.5">
                {members.map((m) => {
                  const regular = regularFor(m);
                  const skipped = skip.has(m.id);
                  return (
                    <div key={m.id} className={`flex items-center gap-2 rounded-lg border border-zinc-800 bg-zinc-900/40 px-2 py-1.5 ${skipped ? 'opacity-60' : ''}`} data-call-member={m.id}>
                      {m.avatar ? <img src={m.avatar} alt="" className="w-6 h-6 rounded-full object-cover shrink-0" /> : <span className="w-6 h-6 rounded-full bg-zinc-800 shrink-0" />}
                      <span className="flex-1 min-w-0 truncate text-xs text-zinc-200">
                        {regular?.name || m.name}
                        {regular && <Star size={10} className="inline ml-1 -mt-0.5 text-current-accent" />}
                        {skipped && <span className="ml-2 text-[9px] font-black uppercase tracking-widest text-zinc-500">{t.peopleSkipped || 'Not seated'}</span>}
                      </span>
                      <select value="" onChange={(e) => e.target.value && ask({ op: 'seat', id: m.id, seat: e.target.value })} className={small}>
                        <option value="">{t.peopleSeatAs || 'Seat as…'}</option>
                        <option value="runner">{t.runRunner || 'Playing'}</option>
                        <option value="host">{t.runHost || 'Host'}</option>
                        <option value="commentator">{t.runCommentator || 'Commentary'}</option>
                      </select>
                      <button
                        onClick={() => ask({ op: 'skip', id: m.id, skip: !skipped })}
                        title={skipped ? (t.peopleUnskip || 'Seat from the call again') : (t.peopleSkip || 'Never seat from the call')}
                        className="p-1 text-zinc-600 hover:text-zinc-300"
                      >
                        {skipped ? <Eye size={13} /> : <EyeOff size={13} />}
                      </button>
                      {!regular && (
                        <button onClick={() => ask({ op: 'regular_save', regular: { name: m.name, discordId: m.id } })} title={t.peopleSaveRegular || 'Save as a regular'} className="p-1 text-zinc-600 hover:text-current-accent">
                          <Star size={13} />
                        </button>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
            {!following && members.length > 0 && (
              <button
                onClick={() => ask({ op: 'fill' })}
                className="w-full px-4 py-2.5 rounded-xl text-[10px] font-black border border-zinc-800 bg-zinc-900 text-zinc-300 uppercase tracking-widest hover:border-current-accent hover:text-current-accent transition-all"
              >
                {t.peopleFill || 'Fill the commentator seats from the call'}
              </button>
            )}
            <Toggle
              on={following}
              onClick={() => ask({ op: 'follow', on: !following })}
              text={t.peopleFollow || 'Keep the commentator seats following the call'}
              hint={t.peopleFollowHint || 'As people join and leave, the seats change with them, in the call’s order. Regulars bring their second line and Twitch login. Whoever is playing or hosting is left out, and so is anybody marked never to be seated.'}
            />
          </>
        )}
      </div>

      {/* Regulars: the people on often, to pick in any seat. */}
      <div className="glass-panel rounded-3xl border border-zinc-800 p-5 space-y-3" data-people-regulars>
        <Heading icon={<Star size={14} />} text={t.peopleRegulars || 'Regulars'} />
        <p className="text-[10px] text-zinc-600 leading-relaxed">
          {t.peopleRegularsHint || 'The people you have on often. Pick one in any seat instead of retyping them. One linked to Discord brings their second line and Twitch login when seated from the call.'}
        </p>
        {regulars.length === 0 && <p className="text-[10px] text-zinc-600">{t.peopleRegularsEmpty || 'No regulars yet. Save somebody from a seat or from the call, or add them here.'}</p>}
        {regulars.map((r) => (
          <div key={r.id} className="grid grid-cols-1 sm:grid-cols-[1fr_1fr_1fr_auto] gap-2 items-center" data-regular={r.id}>
            <CommittedInput value={r.name} placeholder={t.runName || 'Name'} onCommit={(v: string) => { if (v.trim()) ask({ op: 'regular_save', regular: { ...r, name: v } }); }} className={input} />
            <CommittedInput value={r.subtitle || ''} placeholder={t.runSecondLine || 'he/him — @handle'} onCommit={(v: string) => ask({ op: 'regular_save', regular: { ...r, subtitle: v } })} className={input} />
            <CommittedInput value={r.twitch || ''} placeholder={t.peopleTwitchHint || 'Twitch login'} onCommit={(v: string) => ask({ op: 'regular_save', regular: { ...r, twitch: v } })} className={input} />
            <div className="flex items-center justify-end gap-1">
              {r.discordId && <span title={t.peopleDiscordLinked || 'Linked to their Discord account'} className="text-zinc-500"><Headphones size={12} /></span>}
              <button
                onClick={() => { if (window.confirm(fill(t.peopleForgetConfirm || 'Forget “{name}”?', { name: r.name }))) ask({ op: 'regular_delete', id: r.id }); }}
                title={t.peopleForget || 'Forget'} className="p-1.5 text-zinc-600 hover:text-rose-500"
              >
                <Trash2 size={13} />
              </button>
            </div>
          </div>
        ))}
        <div className="grid grid-cols-1 sm:grid-cols-[1fr_1fr_1fr_auto] gap-2 items-center pt-2 border-t border-zinc-800/60">
          <input value={newRegular.name} placeholder={t.runName || 'Name'} onChange={(e) => setNewRegular({ ...newRegular, name: e.target.value })} className={input} />
          <input value={newRegular.subtitle || ''} placeholder={t.runSecondLine || 'he/him — @handle'} onChange={(e) => setNewRegular({ ...newRegular, subtitle: e.target.value })} className={input} />
          <input value={newRegular.twitch || ''} placeholder={t.peopleTwitchHint || 'Twitch login'} onChange={(e) => setNewRegular({ ...newRegular, twitch: e.target.value })} className={input} />
          <button
            onClick={async () => { if (await ask({ op: 'regular_save', regular: newRegular })) setNewRegular({ name: '', subtitle: '', twitch: '' }); }}
            disabled={!newRegular.name.trim()}
            className="flex items-center justify-center gap-1 px-3 py-1.5 rounded-lg bg-current-accent text-white text-[10px] font-black uppercase tracking-widest disabled:opacity-40"
          >
            <Plus size={12} /> {t.add || 'Add'}
          </button>
        </div>
      </div>

      {/* Crews: everybody in their seats, saved for a night that repeats. */}
      <div className="glass-panel rounded-3xl border border-zinc-800 p-5 space-y-3" data-people-crews>
        <Heading icon={<Users size={14} />} text={t.peopleCrews || 'Crews'} />
        <p className="text-[10px] text-zinc-600 leading-relaxed">
          {t.peopleCrewsHint || 'Everybody in their seats, saved under a name for a night that repeats. Seating a crew seats them all at once.'}
        </p>
        <div className="flex gap-2">
          <input
            value={crewName} maxLength={60}
            placeholder={t.peopleCrewName || 'Name this crew…'}
            onChange={(e) => setCrewName(e.target.value)}
            className={input}
          />
          <button
            onClick={async () => { if (await ask({ op: 'crew_save', name: crewName })) setCrewName(''); }}
            disabled={!crewName.trim() || !people_.length}
            className="flex items-center gap-1 px-3 py-1.5 rounded-lg bg-current-accent text-white text-[10px] font-black uppercase tracking-widest disabled:opacity-40"
          >
            <Save size={12} /> {t.peopleSave || 'Save'}
          </button>
        </div>
        {crews.length === 0 && <p className="text-[10px] text-zinc-600">{t.peopleCrewsEmpty || 'No crews yet.'}</p>}
        {crews.map((c) => {
          const count = [c.runner, c.host, ...(c.commentators || [])].filter((p) => p?.name).length;
          return (
            <div key={c.id} className="flex items-center gap-2 rounded-xl border border-zinc-800 bg-zinc-900/60 px-3 py-2" data-crew={c.id}>
              <div className="flex-1 min-w-0">
                <div className="text-xs text-zinc-200 truncate">{c.name}</div>
                <div className="text-[10px] text-zinc-500">{count} {t.peopleCrewPeople || 'people'}</div>
              </div>
              <button onClick={() => loadCrew(c)} className="px-3 py-1.5 rounded-lg text-[10px] font-black uppercase tracking-widest bg-current-accent/10 border border-current-accent text-current-accent hover:bg-current-accent/20">
                {t.peopleCrewLoad || 'Seat them'}
              </button>
              <button
                onClick={() => { if (window.confirm(fill(t.peopleCrewForgetConfirm || 'Forget the crew “{name}”?', { name: c.name }))) ask({ op: 'crew_delete', id: c.id }); }}
                title={t.peopleForget || 'Forget'} className="p-1.5 text-zinc-600 hover:text-rose-500"
              >
                <Trash2 size={14} />
              </button>
            </div>
          );
        })}
      </div>

      {/* The seats as they go on stream, in the colours the first couch in a layout already has. */}
      <div className="glass-panel rounded-3xl border border-zinc-800 p-5 space-y-3" data-run-preview="people">
        <Heading icon={<Eye size={14} />} text={t.runPreview || 'Preview'} />
        {people_.length ? (
          <>
            <div className={PREVIEW_GROUND}>
              <div style={{ height: Math.ceil(people_.length / 2) * 64 }}>
                <RosterLayer
                  config={{ ...firstLayer(layouts, 'roster'), include: 'everyone', showEmpty: false, columns: 2, nameSize: 18, pronounSize: 10 }}
                  run={run}
                />
              </div>
            </div>
            <p className="text-[10px] text-zinc-600 leading-relaxed">
              {t.runPreviewHint || 'Drawn plain, the way a layer looks before a look is applied.'}
            </p>
          </>
        ) : (
          <p className="text-[10px] text-zinc-600 leading-relaxed">
            {t.peoplePreviewEmpty || 'Nothing to show yet: a seat appears once somebody has a name.'}
          </p>
        )}
      </div>
    </div>
  );
};
