/**
 * @license
 * SPDX-License-Identifier: Apache-2.0 AND LicenseRef-Commons-Clause-1.0
 *
 * Scene types on the Layouts screen (server/engine/scene-types.js): which one
 * the layout being edited fills, and — in the Omnilayer card — the list
 * itself, with the two ways of catching up an existing setup: types made from
 * the OBS scene bindings, and commands turned to name a type instead of a
 * layout.
 *
 * A type is what a layout is for — Starting, BRB — so a command can ask for
 * "BRB" and get whichever layout is BRB in the overlay profile that is on.
 * The list is the same in every profile; each profile's layouts say which
 * type they fill.
 */
import React, { useState } from 'react';
import { Plus, Tags, Trash2, Wand2, Workflow } from 'lucide-react';
import { fill } from '../words';

export interface SceneType { id: string; name: string }
interface LayoutLike { id: string; name: string; sceneType?: string }

const label = 'text-[8px] font-black uppercase tracking-widest text-zinc-600';
const field = 'w-full bg-zinc-950/60 border border-zinc-800 rounded-md px-1.5 py-1 text-[10px] text-zinc-300 outline-none focus:border-current-accent';
const sameName = (a: string, b: string) => a.trim().toLowerCase() === b.trim().toLowerCase();

/** A box to name a new type, and the button that adds it. */
const NewType = ({ types, onAdd, t }: { types: SceneType[]; onAdd: (name: string) => void; t: any }) => {
  const [name, setName] = useState('');
  const taken = types.some((x) => sameName(x.name, name));
  const add = () => {
    if (!name.trim() || taken) return;
    onAdd(name.trim());
    setName('');
  };
  return (
    <div className="flex gap-1.5" data-scene-type-new>
      <input
        value={name}
        onChange={(e) => setName(e.target.value)}
        onKeyDown={(e) => { if (e.key === 'Enter') add(); }}
        placeholder={t.sceneTypeNewPlaceholder || 'New type, like BRB'}
        maxLength={40}
        className={field}
      />
      <button
        onClick={add}
        disabled={!name.trim() || taken}
        title={taken ? (t.sceneTypeTaken || 'There is a type with that name already') : undefined}
        className="shrink-0 flex items-center gap-1 px-2 rounded-md text-[9px] font-black uppercase tracking-widest border border-zinc-800 text-zinc-400 hover:text-white disabled:opacity-40"
      >
        <Plus size={11} /> {t.sceneTypeAdd || 'Add'}
      </button>
    </div>
  );
};

/**
 * Which type the layout being edited fills. Picking one a layout already
 * fills moves it here, as a scene binding moves: one layout per type, so
 * asking for a type always means one layout.
 */
export const SceneTypePicker = ({ types, layout, layouts, onPick, run, t }: {
  types: SceneType[];
  layout: LayoutLike;
  layouts: LayoutLike[];
  onPick: (typeId: string) => void;
  /** system.actions.omnilayer, for adding a type. */
  run: (payload: any) => Promise<any>;
  t: any;
}) => {
  const holder = (id: string) => layouts.find((l) => l.sceneType === id && l.id !== layout.id);
  const chip = (on: boolean) => `px-2.5 py-1.5 rounded-lg border text-[10px] font-bold transition-all ${
    on ? 'border-current-accent bg-current-accent/10 text-white' : 'border-zinc-800 bg-zinc-900/40 text-zinc-400 hover:border-zinc-700'}`;
  const add = async (name: string) => {
    const state = await run({ op: 'types', types: [...types, { name }] }).catch(() => null);
    const made = (state?.types || []).find((x: SceneType) => sameName(x.name, name));
    if (made) onPick(made.id);
  };
  return (
    <div className="glass-panel rounded-3xl border border-zinc-800 p-5 space-y-3" data-scene-type-picker>
      <div className="flex items-center gap-2">
        <Tags size={13} className="text-current-accent" />
        <span className="text-[9px] font-black uppercase tracking-widest text-zinc-500">{t.sceneTypeTitle || 'Scene type'}</span>
      </div>
      <p className="text-[9px] text-zinc-600 leading-snug">
        {t.sceneTypePickerHint || 'What this layout is for. A command that goes live with a type gets this profile’s layout of that type, so the same command works in every profile.'}
      </p>
      <div className="flex flex-wrap gap-1.5">
        <button onClick={() => onPick('')} className={chip(!layout.sceneType)} data-scene-type-none>{t.sceneTypeNone || 'None'}</button>
        {types.map((x) => {
          const other = holder(x.id);
          return (
            <button
              key={x.id}
              onClick={() => onPick(x.id)}
              className={chip(layout.sceneType === x.id)}
              // Naming the other layout matters: clicking moves the type here.
              title={other ? fill(t.sceneTypeHeldBy || '“{layout}” is this type now: picking it here moves it', { layout: other.name }) : undefined}
              data-scene-type-chip={x.id}
            >
              {x.name}
              {other && <span className="ml-1.5 text-[8px] font-bold text-zinc-600">{other.name}</span>}
            </button>
          );
        })}
      </div>
      <NewType types={types} onAdd={add} t={t} />
    </div>
  );
};

/**
 * The list itself, in the Omnilayer card: renaming, deleting, adding — and
 * catching up a setup made before types existed.
 */
export const SceneTypesManager = ({ types, layouts, run, t }: {
  types: SceneType[];
  /** The layouts of the profile that is on, to say which one fills each type here. */
  layouts: LayoutLike[];
  run: (payload: any) => Promise<any>;
  t: any;
}) => {
  const [doomed, setDoomed] = useState('');
  const [said, setSaid] = useState('');
  const save = (next: SceneType[]) => run({ op: 'types', types: next }).catch(() => null);
  const rename = (id: string, name: string) => {
    const clean = name.trim();
    const was = types.find((x) => x.id === id);
    if (!was || !clean || clean === was.name || types.some((x) => x.id !== id && sameName(x.name, clean))) return;
    save(types.map((x) => (x.id === id ? { ...x, name: clean } : x)));
  };
  const remove = (id: string) => {
    // Twice, the first time to ask: deleting takes the type off the layouts of every profile.
    if (doomed !== id) { setDoomed(id); return; }
    setDoomed('');
    save(types.filter((x) => x.id !== id));
  };
  const fromBindings = async () => {
    const res = await run({ op: 'types_from_bindings' }).catch(() => null);
    if (res?.made) setSaid(fill(t.sceneTypesMade || '{types} types. Layouts given their type in {profiles} profiles.', { types: res.made.types, profiles: res.made.profiles }));
  };
  const convert = async () => {
    const res = await run({ op: 'convert_steps' }).catch(() => null);
    if (res?.converted) setSaid(fill(t.sceneTypesConverted || '{live} steps and triggers now name a type, and saved actions changed in {profiles} profiles.', { live: res.converted.live, profiles: res.converted.profiles }));
  };
  return (
    <div className="space-y-2 pt-2 border-t border-zinc-800/60" data-scene-types>
      <span className={label}>{t.sceneTypesTitle || 'Scene types'}</span>
      <p className="text-[9px] text-zinc-600 leading-snug">
        {t.sceneTypesHint || 'Name what your layouts are for — Starting, Gameplay, BRB — and give each layout its type. A command that goes live with a type works in every overlay profile.'}
      </p>
      {types.map((x) => {
        const here = layouts.find((l) => l.sceneType === x.id);
        return (
          <div key={x.id} className="flex items-center gap-1.5" data-scene-type-row={x.id}>
            <input
              key={x.name}
              defaultValue={x.name}
              maxLength={40}
              onBlur={(e) => rename(x.id, e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter') (e.target as HTMLInputElement).blur(); }}
              className={field}
            />
            <span className={`shrink-0 max-w-[110px] truncate text-[9px] ${here ? 'text-zinc-500' : 'text-amber-500/80'}`}>
              {here ? here.name : (t.sceneTypeNoneHere || 'none in this profile')}
            </span>
            <button
              onClick={() => remove(x.id)}
              title={doomed === x.id ? undefined : (t.sceneTypeDelete || 'Delete this type')}
              className={`shrink-0 flex items-center gap-1 px-1.5 py-1 rounded-md border text-[9px] font-bold ${doomed === x.id ? 'border-red-500 text-red-400' : 'border-zinc-800 text-zinc-500 hover:text-white'}`}
              data-scene-type-delete={x.id}
            >
              <Trash2 size={11} />{doomed === x.id && (t.sceneTypeDeleteSure || 'Delete from every profile?')}
            </button>
          </div>
        );
      })}
      <NewType types={types} onAdd={(name) => save([...types, { id: '', name }])} t={t} />
      <div className="grid grid-cols-1 gap-1.5 pt-1">
        <button
          onClick={fromBindings}
          className="flex items-center justify-center gap-1.5 px-3 py-2 rounded-xl text-[9px] font-black uppercase tracking-widest border border-zinc-800 text-zinc-400 hover:text-white"
          data-scene-types-from-bindings
        >
          <Wand2 size={12} /> {t.sceneTypesFromBindings || 'Make types from my scene bindings'}
        </button>
        <button
          onClick={convert}
          disabled={types.length === 0}
          className="flex items-center justify-center gap-1.5 px-3 py-2 rounded-xl text-[9px] font-black uppercase tracking-widest border border-zinc-800 text-zinc-400 hover:text-white disabled:opacity-40"
          data-scene-types-convert
        >
          <Workflow size={12} /> {t.sceneTypesConvert || 'Use types in my commands'}
        </button>
      </div>
      <p className="text-[9px] text-zinc-600 leading-snug">
        {t.sceneTypesButtonsHint || 'The first gives every layout bound to an OBS scene the type of that scene, in every profile. The second turns each step and trigger that names a layout with a type to name the type instead.'}
      </p>
      {said && <p className="text-[9px] text-current-accent leading-snug" data-scene-types-said>{said}</p>}
    </div>
  );
};
