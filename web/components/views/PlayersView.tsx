/**
 * @license
 * SPDX-License-Identifier: Apache-2.0 AND LicenseRef-Commons-Clause-1.0
 *
 * Who is in tonight's game.
 *
 * Typed in here before a community night, or filled from chat by a command
 * carrying the "Players: join" step. During the game each player can be put
 * out — or ejected, or killed, for the games where how somebody left matters —
 * and brought back in, and a new round puts everybody back in at once.
 *
 * Every change sends the whole list, which the server cleans with the same
 * rules a command's changes go through (shared/players.js), so the two can
 * never disagree about what a list may hold.
 */
import React, { useState } from 'react';
import { useDragOrder, DragGrip } from '../../hooks/useDragOrder';
import { moveToGap } from '../../../shared/list-order.js';
import { Plus, Trash2, RotateCcw, Users } from 'lucide-react';
import { Button } from '../Button';
import { PLAYER_COLOURS, MAX_PLAYERS, colourFor, cleanName, sameName } from '../../../shared/players.js';

export interface Player { id: string; name: string; colour: string; state: string }

interface Props {
  players: { items: Player[] };
  setPlayers: (next: { items: Player[] }) => void;
  t: any;
}

const STATES = ['in', 'out', 'ejected', 'dead'] as const;

/* The named colours, once each — "grey" is only a spelling of "gray". */
const SWATCHES = Object.entries(PLAYER_COLOURS).filter(([name]) => name !== 'grey');

const newId = () => Math.random().toString(36).slice(2, 11);

export const PlayersView = ({ players, setPlayers, t }: Props) => {
  const items = players?.items || [];
  const [name, setName] = useState('');
  const [colour, setColour] = useState('');
  const [picking, setPicking] = useState<string | null>(null);

  const save = (next: Player[]) => setPlayers({ items: next });
  const full = items.length >= MAX_PLAYERS;
  const taken = Boolean(name.trim()) && items.some((p) => sameName(p.name, name));

  const add = () => {
    const clean = cleanName(name);
    if (!clean || full || taken) return;
    save([...items, { id: newId(), name: clean, colour: colour || colourFor(clean), state: 'in' }]);
    setName('');
    setColour('');
  };

  const patch = (id: string, change: Partial<Player>) => save(items.map((p) => (p.id === id ? { ...p, ...change } : p)));
  const playerOrder = useDragOrder(({ from, gap }) => save(moveToGap(items, from, gap)));

  const stateLabel: Record<string, string> = {
    in: t.playersStateIn || 'In',
    out: t.playersStateOut || 'Out',
    ejected: t.playersStateEjected || 'Ejected',
    dead: t.playersStateDead || 'Dead',
  };
  const stillIn = items.filter((p) => p.state === 'in').length;

  return (
    <div className="animate-fade-in space-y-6 pb-20">
      <div className="glass-panel rounded-3xl border border-zinc-800 p-6 space-y-4">
        <div className="flex flex-wrap items-center gap-3">
          <Users size={16} className="text-current-accent" />
          <span className="text-[11px] font-black uppercase tracking-widest text-zinc-300">
            {t.playersNav || 'Players'} ({items.length}/{MAX_PLAYERS})
          </span>
          {items.length > 0 && (
            <span className="text-[10px] text-zinc-500">{stillIn} {t.playersStillIn || 'still in'}</span>
          )}
          <div className="ml-auto flex gap-2">
            <Button size="sm" variant="secondary" icon={<RotateCcw size={14} />} onClick={() => save(items.map((p) => ({ ...p, state: 'in' })))} disabled={!items.length}>
              {t.playersReset || 'Everyone back in'}
            </Button>
            <Button
              size="sm" variant="secondary" icon={<Trash2 size={14} />} disabled={!items.length}
              onClick={() => { if (window.confirm(t.playersClearConfirm || 'Take everyone off the list?')) save([]); }}
            >
              {t.playersClear || 'Clear list'}
            </Button>
          </div>
        </div>

        {/* Adding one by hand. */}
        <div className="flex flex-wrap items-center gap-2">
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter') add(); }}
            placeholder={t.playersNamePlaceholder || 'Player name'}
            maxLength={40}
            className="flex-1 min-w-[10rem] bg-zinc-950 border border-zinc-800 rounded-xl px-4 py-2 text-xs text-white outline-none focus:border-current-accent"
          />
          <div className="flex flex-wrap gap-1" data-players-add-colours>
            {SWATCHES.map(([key, hex]) => (
              <button
                key={key} title={key} onClick={() => setColour(colour === hex ? '' : hex)}
                className={`w-5 h-5 rounded-full border-2 transition-all ${colour === hex ? 'border-white scale-110' : 'border-transparent'}`}
                style={{ backgroundColor: hex }}
              />
            ))}
          </div>
          <Button size="sm" icon={<Plus size={14} />} onClick={add} disabled={!name.trim() || full || taken}>
            {t.playersAdd || 'Add'}
          </Button>
        </div>
        <p className="text-[10px] text-zinc-600 leading-relaxed">
          {full ? (t.playersFull || 'The list is full — 50 is the most it holds.')
            : taken ? (t.playersTaken || 'Somebody with that name is already on the list.')
              : (t.playersHint || 'No colour picked means one is chosen from the name, the same every time. Viewers can join themselves with a command carrying the "Players: join" step — !join red.')}
        </p>
      </div>

      <div ref={playerOrder.listRef} className={`relative glass-panel rounded-3xl border border-zinc-800 p-6 space-y-2 ${playerOrder.held ? 'select-none' : ''}`}>
        {playerOrder.line}
        {items.length === 0 && (
          <p className="text-[10px] text-zinc-600 uppercase tracking-widest">{t.playersNone || 'Nobody on the list yet.'}</p>
        )}
        {items.map((p) => (
          <div
            key={p.id}
            {...playerOrder.row(p.id)}
            className={`flex flex-wrap items-center gap-3 rounded-xl border p-2.5 ${p.state === 'in' ? 'border-zinc-800 bg-zinc-900/40' : 'border-zinc-900 bg-zinc-950/40 opacity-70'} ${playerOrder.held === p.id ? '!opacity-40' : ''}`}
            data-player-row={p.state}
          >
            {items.length > 1 && <DragGrip grip={playerOrder.grip(p.id)} title={t.playersDrag || 'Drag to change their place on the list'} className="-m-1" />}
            <div className="relative">
              <button
                onClick={() => setPicking(picking === p.id ? null : p.id)}
                title={t.playersColour || 'Colour'}
                className="w-6 h-6 rounded-full border-2 border-zinc-700"
                style={{ backgroundColor: p.colour }}
              />
              {picking === p.id && (
                <div className="absolute z-20 top-8 left-0 p-2 rounded-xl bg-zinc-900 border border-zinc-700 grid grid-cols-6 gap-1 w-44">
                  {SWATCHES.map(([key, hex]) => (
                    <button
                      key={key} title={key}
                      onClick={() => { patch(p.id, { colour: hex }); setPicking(null); }}
                      className={`w-5 h-5 rounded-full border-2 ${p.colour === hex ? 'border-white' : 'border-transparent'}`}
                      style={{ backgroundColor: hex }}
                    />
                  ))}
                </div>
              )}
            </div>
            <span className={`flex-1 min-w-[6rem] text-sm font-bold text-zinc-200 truncate ${p.state === 'in' ? '' : 'line-through'}`}>{p.name}</span>
            <div className="flex rounded-lg border border-zinc-800 overflow-hidden">
              {STATES.map((s) => (
                <button
                  key={s} onClick={() => patch(p.id, { state: s })}
                  className={`px-2.5 py-1 text-[9px] font-black uppercase tracking-widest transition-all ${
                    p.state === s ? 'bg-current-accent text-white' : 'bg-zinc-900 text-zinc-500 hover:text-zinc-200'
                  }`}
                >
                  {stateLabel[s]}
                </button>
              ))}
            </div>
            <button
              onClick={() => save(items.filter((q) => q.id !== p.id))}
              title={t.playersRemove || 'Take off the list'}
              className="p-1.5 text-zinc-600 hover:text-rose-500"
            >
              <Trash2 size={14} />
            </button>
          </div>
        ))}
      </div>
    </div>
  );
};
