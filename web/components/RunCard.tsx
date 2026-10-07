/**
 * @license
 * SPDX-License-Identifier: Apache-2.0 AND LicenseRef-Commons-Clause-1.0
 *
 * What is being played, as the card a marathon puts next to the game.
 *
 * Two rows, because that is what the information is: the game on top, in the
 * size you read from across the room, and the facts about it underneath in the
 * size you read when you are already looking. Splitting them any other way —
 * four equal lines, say — makes the title stop being the title.
 *
 * Buildable out of five text layers, and that is the point of text layers. It
 * is here as one layer because this particular arrangement is the recognisable
 * thing, and five layers that have to be moved together whenever the card
 * moves is a worse way to own it.
 *
 * Draws nothing until there is a game, like the nameplate: a card added and
 * not filled in should be invisible rather than an empty box on stream.
 */
import React from 'react';

export interface RunCardConfig {
  accentColor?: string;
  textColor?: string;
  backgroundColor?: string;
  align?: 'left' | 'center' | 'right';
  titleSize?: number;
  detailSize?: number;
  radius?: number;
  /** The spectrum edge, which is what makes it read as a marathon card. */
  showEdge?: boolean;
  showCategory?: boolean;
  showEstimate?: boolean;
  estimateLabel?: string;
}

export interface RunInfo {
  game?: string;
  platform?: string;
  year?: string;
  category?: string;
  estimate?: string;
}

export const RunCard = ({ config, run }: { config: RunCardConfig; run?: RunInfo }) => {
  const game = (run?.game || '').trim();
  if (!game) return null;

  const accent = config.accentColor || 'var(--overlay-accent, #f43f5e)';
  const align = config.align || 'center';

  /*
    The platform and the year are one fact — "N64, 1996" — so they are joined
    rather than laid out separately. Either can be missing without leaving a
    stray comma behind, which is the whole reason this is not a template.
  */
  const machine = [run?.platform, run?.year].map((v) => (v || '').trim()).filter(Boolean).join(' · ');

  /*
    Each detail carries which one it is, rather than being known by its
    position. The list drops whatever is switched off, so with the category
    hidden the estimate would slide into first place — and anything reading
    position would then call the estimate the category.
  */
  const details = [
    { part: 'category', text: config.showCategory === false ? '' : (run?.category || '').trim() },
    {
      part: 'estimate',
      text: config.showEstimate === false ? '' : [
        (config.estimateLabel ?? 'EST').trim(),
        (run?.estimate || '').trim(),
      ].filter(Boolean).join(' '),
    },
  ].filter((d) => d.text);

  // Only when there is an estimate to label, or the label sits there alone.
  const showDetails = details.some((d) => d.text && d.text !== (config.estimateLabel ?? 'EST'));

  /*
    The data-runcard names are a promise a stylesheet can rely on. Everything
    else here is markup that gets rewritten whenever this component is
    touched, so a rule naming it would break on an update for a reason nobody
    could see.
  */
  return (
    <div
      className="w-full h-full flex flex-col justify-center overflow-hidden" data-runcard="card"
      style={{
        // A chosen accent, for a look to use wherever it puts its own.
        ['--runcard-accent' as any]: config.accentColor || undefined,
        background: config.backgroundColor || '#09090bd9',
        borderRadius: config.radius ? `${config.radius}px` : undefined,
        color: config.textColor || '#ffffff',
        // The edge, top and bottom. A border rather than its own elements, so
        // it cannot fall out of step with the card's height or its corners.
        borderTop: config.showEdge === false ? undefined : `4px solid ${accent}`,
        borderBottom: config.showEdge === false ? undefined : `4px solid ${accent}`,
        boxSizing: 'border-box',
        padding: '0 4%',
        textAlign: align,
        alignItems: align === 'right' ? 'flex-end' : align === 'left' ? 'flex-start' : 'center',
      }}
    >
      <div
        className="w-full truncate leading-tight" data-runcard="title"
        style={{ fontSize: `${config.titleSize ?? 34}px`, fontWeight: 800, letterSpacing: '0.02em' }}
      >
        {game}
      </div>

      {Boolean(machine) && (
        <div
          className="w-full truncate leading-tight" data-runcard="machine"
          style={{ fontSize: `${config.detailSize ?? 16}px`, opacity: 0.75, letterSpacing: '0.08em' }}
        >
          {machine}
        </div>
      )}

      {showDetails && (
        <div
          className="w-full flex gap-4 leading-tight" data-runcard="details"
          style={{
            fontSize: `${config.detailSize ?? 16}px`,
            marginTop: 4,
            letterSpacing: '0.08em',
            justifyContent: align === 'right' ? 'flex-end' : align === 'left' ? 'flex-start' : 'center',
          }}
        >
          {details.map((d) => (d.part === 'category' ? (
            <span key="category" data-runcard="category" style={{ color: accent, fontWeight: 700 }}>
              {d.text}
            </span>
          ) : (
            <span key="estimate" data-runcard="estimate" style={{ opacity: 0.75 }}>
              {d.text}
            </span>
          )))}
        </div>
      )}
    </div>
  );
};
