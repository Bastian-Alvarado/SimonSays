/**
 * @license
 * SPDX-License-Identifier: Apache-2.0 AND LicenseRef-Commons-Clause-1.0
 *
 * The blank tape an empty screen shows in the Simon Systems reskin: the flat
 * cassette from the object library, in the palette. Hidden unless ss-ui.css
 * shows it, and it replaces the icon just before it.
 */
import React from 'react';

export const SsTape = ({ t }: { t: any }) => (
  <div className="ss-tape hidden">
    <svg viewBox="0 0 120 78" width="120" height="78" role="presentation" aria-hidden="true">
      <rect x="2" y="2" width="116" height="74" style={{ fill: 'var(--ss-ground)', stroke: 'var(--ss-line)', strokeWidth: 3 }} />
      <rect x="12" y="10" width="96" height="36" style={{ fill: 'var(--ss-marigold)' }} />
      <rect x="12" y="10" width="96" height="7" style={{ fill: 'var(--ss-house)' }} />
      <rect x="30" y="24" width="60" height="16" style={{ fill: 'var(--ss-part)' }} />
      <circle cx="44" cy="32" r="5" style={{ fill: 'var(--ss-ground)', stroke: 'var(--ss-line)', strokeWidth: 2 }} />
      <circle cx="76" cy="32" r="5" style={{ fill: 'var(--ss-ground)', stroke: 'var(--ss-line)', strokeWidth: 2 }} />
      <path d="M24 76 30 56H90L96 76" style={{ fill: 'none', stroke: 'var(--ss-line)', strokeWidth: 3 }} />
    </svg>
    <p>{t.ssNoCartridge || 'No cartridge inserted'}</p>
  </div>
);
