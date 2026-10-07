/**
 * @license
 * SPDX-License-Identifier: Apache-2.0 AND LicenseRef-Commons-Clause-1.0
 *
 * A lower third: who is on camera.
 *
 * Modelled on the nameplates in Games Done Quick's layout bundles, which pair
 * a name with a second line for pronouns or a handle and mark the whole thing
 * with an accent bar. Theirs hold several plates at once and are fed from a
 * schedule. This is one plate, and a layout holds as many as it needs — each
 * either has a name typed into it or follows the run, which is resolved by the
 * canvas before it gets here so that this stays a thing that draws a name.
 *
 * It draws nothing at all when no name has been set. A layer added and not yet
 * filled in should be invisible on stream rather than an empty bar somebody
 * has to remember to turn off.
 */
import React from 'react';

export interface NameplateConfig {
  name?: string;
  subtitle?: string;
  accentColor?: string;
  textColor?: string;
  backgroundColor?: string;
  align?: 'left' | 'right';
  nameSize?: number;
  subtitleSize?: number;
  showBar?: boolean;
  radius?: number;
}

export const Nameplate = ({ config }: { config: NameplateConfig }) => {
  const name = (config.name || '').trim();
  const subtitle = (config.subtitle || '').trim();
  if (!name && !subtitle) return null;

  const right = config.align === 'right';
  const accent = config.accentColor || 'var(--overlay-accent, #f43f5e)';

  /*
    The bar is a border rather than its own element, so it cannot fall out of
    step with the panel's height or its rounded corners.
  */
  const bar = config.showBar === false ? {} : right
    ? { borderRight: `6px solid ${accent}` }
    : { borderLeft: `6px solid ${accent}` };

  /*
    The data-nameplate names are a promise a stylesheet can rely on, so a
    plate can be styled to match the rest of a layout without naming the
    utility classes around it — those get rewritten whenever this is touched.
  */
  return (
    <div
      className="w-full h-full flex flex-col justify-center px-5 py-3 overflow-hidden" data-nameplate="plate"
      style={{
        // What was chosen, for a look to read before its own; left
        // automatic, nothing is set and the look decides.
        ['--nameplate-background' as any]: config.backgroundColor || undefined,
        ['--nameplate-text' as any]: config.textColor || undefined,
        ['--nameplate-accent' as any]: config.accentColor || undefined,
        backgroundColor: config.backgroundColor || '#09090bd9',
        borderRadius: `${config.radius ?? 12}px`,
        alignItems: right ? 'flex-end' : 'flex-start',
        textAlign: right ? 'right' : 'left',
        ...bar,
      }}
    >
      {name && (
        <div
          className="font-black uppercase tracking-tight leading-none truncate max-w-full" data-nameplate="name"
          style={{ color: config.textColor || '#ffffff', fontSize: `${config.nameSize ?? 40}px` }}
        >
          {name}
        </div>
      )}
      {subtitle && (
        <div
          className="font-semibold tracking-wide truncate max-w-full" data-nameplate="subtitle"
          style={{
            color: accent,
            fontSize: `${config.subtitleSize ?? 18}px`,
            marginTop: name ? '0.35em' : 0,
          }}
        >
          {subtitle}
        </div>
      )}
    </div>
  );
};
