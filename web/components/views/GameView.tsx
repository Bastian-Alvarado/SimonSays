/**
 * @license
 * SPDX-License-Identifier: Apache-2.0 AND LicenseRef-Commons-Clause-1.0
 *
 * What is being played.
 *
 * One record for the whole app. A marathon keeps a schedule of runs and points
 * at one; this app already has that list — the stream plan — and asking
 * somebody to keep a second one so an overlay can read a game title would be
 * worse than asking them to type the title. The title follows the Twitch
 * category on its own; everything else here stays with the game it was typed
 * for.
 *
 * Everything is optional. A game with nothing else filled in is the normal
 * case, and a form that refuses to save until every box is filled is a form
 * nobody fills in.
 *
 * Every field commits when you leave it rather than on each keystroke: the
 * server trims what it stores, and a field that saved per keystroke would make
 * a space impossible to type.
 */
import React, { useState } from 'react';
import { Gamepad2, Eye, Skull, Minus, Plus } from 'lucide-react';
import { RunCard } from '../RunCard';
import { ClearButton, Field, Heading, PREVIEW_GROUND, RunScreenProps, firstLayer } from '../RunParts';

type GameViewProps = RunScreenProps & {
  /** The deaths count, and a way to change it: op add, subtract or reset. */
  deaths?: number;
  changeDeaths?: (op: string, value?: string) => void;
};

export const GameView = ({ run, setRun, layouts, t, deaths = 0, changeDeaths }: GameViewProps) => {
  const save = (patch: Record<string, any>) => setRun({ ...run, ...patch });
  /*
    What was last typed into the year and refused.

    The server keeps four digits or nothing, and the field then shows what is
    stored — so "'96" used to disappear on leaving the box, with nothing to
    say why. It is checked here first and not sent, and the reason stays
    under the field until a year that is one is typed.
  */
  const [badYear, setBadYear] = useState('');

  const setYear = (typed: string) => {
    const year = typed.trim();
    if (year && !/^[0-9]{4}$/.test(year)) {
      setBadYear(year);
      return;
    }
    setBadYear('');
    save({ year });
  };

  const clearGame = () => {
    if (!window.confirm(t.runClearGameConfirm || 'Empty the game: title, platform, year, category and estimate?')) return;
    setBadYear('');
    save({ game: '', platform: '', year: '', category: '', estimate: '' });
  };

  const hasGame = Boolean((run?.game || '').trim());
  const anything = hasGame || run?.platform || run?.year || run?.category || run?.estimate;

  return (
    <div className="space-y-5 max-w-3xl">
      <div className="glass-panel rounded-3xl border border-zinc-800 p-5 space-y-4">
        <Heading
          icon={<Gamepad2 size={14} />}
          text={t.runGame || 'The game'}
          action={anything ? <ClearButton onClick={clearGame} t={t} /> : undefined}
        />

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <Field label={t.runTitle || 'Title'} value={run?.game || ''} placeholder="Dark Souls" wide
            onCommit={(v) => save({ game: v })} />
          <Field label={t.runPlatform || 'Platform'} value={run?.platform || ''} placeholder="PS3"
            onCommit={(v) => save({ platform: v })} />
          {/* Four digits or nothing: it is printed beside the platform. */}
          <Field
            label={t.runYear || 'Year'} value={run?.year || ''} placeholder="2011" onCommit={setYear}
            error={badYear ? String(t.runYearInvalid || '“{typed}” is not a year, so it was not saved. Four digits, like 1996.').split('{typed}').join(badYear) : undefined}
          />
          <Field label={t.runCategory || 'Category'} value={run?.category || ''} placeholder="Any%"
            onCommit={(v) => save({ category: v })} />
          {/*
            Text, not a duration. Nothing counts against it, and a field that
            insists on h:mm:ss is a field that refuses "about an hour".
          */}
          <Field label={t.runEstimate || 'Estimate'} value={run?.estimate || ''} placeholder="1:20:00"
            onCommit={(v) => save({ estimate: v })} />
        </div>

        <p className="text-[10px] text-zinc-600 leading-relaxed">
          {t.runHint || 'Read by the run card and by text layers as {game}, {platform}, {category}, {estimate} and the rest. The title follows your Twitch category; everything else stays with the game it was typed for.'}
        </p>
        <p className="text-[10px] text-zinc-600 leading-relaxed" data-game-plan-tip>
          {t.gamePlanTip || 'A step of the Stream plan can fill this card when it starts: open the step’s settings and fill in its run card.'}
        </p>
      </div>

      {/*
        The deaths count: the game's, for as long as the playthrough lasts, so
        it sits with the game rather than with tonight. Mostly changed from
        chat or the deck as it happens; this is where it is seen and put right.
      */}
      {changeDeaths && (
        <div className="glass-panel rounded-3xl border border-zinc-800 p-5 space-y-3" data-game-deaths>
          <Heading
            icon={<Skull size={14} />}
            text={t.gameDeaths || 'Deaths'}
            action={deaths ? (
              <ClearButton
                onClick={() => { if (window.confirm(t.gameDeathsResetConfirm || 'Back to zero deaths?')) changeDeaths('reset'); }}
                t={t}
              />
            ) : undefined}
          />
          <div className="flex items-center gap-4">
            <button
              onClick={() => changeDeaths('subtract')} disabled={!deaths}
              title={t.gameDeathsLess || 'One fewer'}
              className="w-10 h-10 rounded-xl border border-zinc-800 bg-zinc-900 text-zinc-300 flex items-center justify-center hover:border-zinc-600 disabled:opacity-30"
              data-game-deaths-less
            >
              <Minus size={16} />
            </button>
            <span className="text-3xl font-black tabular-nums text-white min-w-[3ch] text-center" data-game-deaths-count>{deaths}</span>
            <button
              onClick={() => changeDeaths('add')}
              title={t.gameDeathsMore || 'One more'}
              className="w-10 h-10 rounded-xl border border-current-accent/60 bg-current-accent/10 text-current-accent flex items-center justify-center hover:bg-current-accent/20"
              data-game-deaths-more
            >
              <Plus size={16} />
            </button>
          </div>
          <p className="text-[10px] text-zinc-600 leading-relaxed">
            {t.gameDeathsHint || 'Kept for the whole playthrough, from one stream to the next. Put it on an overlay with {deaths} in a text layer. The Deaths step in an action changes it from chat, and the deck has buttons for it.'}
          </p>
        </div>
      )}

      {/*
        The card as it goes on stream, drawn with the colours the first run
        card in a layout already has. Without a look applied, which is said, so
        nobody wonders why their stylesheet is not on it.
      */}
      <div className="glass-panel rounded-3xl border border-zinc-800 p-5 space-y-3" data-run-preview="game">
        <Heading icon={<Eye size={14} />} text={t.runPreview || 'Preview'} />
        {hasGame ? (
          <>
            <div className={PREVIEW_GROUND}>
              <div style={{ height: 120 }}>
                <RunCard config={firstLayer(layouts, 'runcard')} run={run} />
              </div>
            </div>
            <p className="text-[10px] text-zinc-600 leading-relaxed">
              {t.runPreviewHint || 'Drawn plain, the way a layer looks before a look is applied.'}
            </p>
          </>
        ) : (
          <p className="text-[10px] text-zinc-600 leading-relaxed">
            {t.gamePreviewEmpty || 'Nothing to show yet: the card appears once there is a game.'}
          </p>
        )}
      </div>
    </div>
  );
};
