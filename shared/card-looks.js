/**
 * @license
 * SPDX-License-Identifier: Apache-2.0 AND LicenseRef-Commons-Clause-1.0
 *
 * Looks for the welcome card, one per theme, to start from.
 *
 * Written like the layer looks: a stylesheet on the card's named parts —
 * `:scope` for the card, `[data-card="avatar"]`, `"title"`, `"name"`,
 * `"subtitle"`, `"text"`, `"background"` — with every colour a field
 * (`--x: value; /* Label *\/`), so a look is a place to start and its knobs
 * show up to turn. Every look has one for the name, so a background the
 * look's own colour does not read on is a field away from fixed. A change
 * to a look keeps its previous wording in card-looks-previous.js, so cards
 * already wearing it are brought up to date (cleanCard). A card is a still picture, so no pseudo-elements and no
 * motion; decoration is backgrounds, borders and shadows.
 */

export const CARD_LOOKS = [
  {
    id: 'card-simonsays',
    name: 'SimonSays Default',
    hint: 'Clean and dark: the avatar in a ring of your colour, the name large and white.',
    css: `:scope {
  --color: #ffffff; /* Colour */
  --name: #ffffff; /* Name */
  --ground: #0f0f12; /* Background */
  --ground2: #27272a; /* Background, far side */
  background-image: linear-gradient(135deg, var(--ground), var(--ground2));
}

[data-card="avatar"] { border: 6px solid var(--color); box-shadow: 0 12px 32px rgba(0,0,0,.55); }
[data-card="title"] { color: var(--color); opacity: .8; }
[data-card="name"] { color: var(--name); }
[data-card="subtitle"] { color: var(--color); opacity: .6; }`,
  },
  {
    id: 'card-cyberpunky',
    name: 'Cyberpunky',
    hint: 'Black with a faint grid and a hairline frame, squared capitals, the rest in pixel print.',
    css: `:scope {
  --neon: #ffffff; /* Main colour */
  --name: #ffffff; /* Name */
  --ground: #0a0a0b; /* Background */
  --grid: rgba(255,255,255,.05); /* The grid */
  background-image:
    linear-gradient(var(--grid) 1px, transparent 1px),
    linear-gradient(90deg, var(--grid) 1px, transparent 1px);
  background-size: 44px 44px;
  background-color: var(--ground);
  border: 1px solid rgba(255,255,255,.25);
  font-family: 'Chakra Petch';
}

[data-card="avatar"] { border-radius: 0; border: 2px solid var(--neon); }
[data-card="title"] { font-family: 'VT323'; font-weight: 400; letter-spacing: 6px; color: var(--neon); opacity: 1; }
[data-card="name"] { text-transform: uppercase; font-weight: 700; color: var(--name); }
[data-card="subtitle"] { font-family: 'VT323'; font-weight: 400; font-size: 30px; letter-spacing: 3px; opacity: .7; }`,
  },
  {
    id: 'card-minimal',
    name: 'Minimal light',
    hint: 'White and quiet: a soft border, the avatar round, the name in dark ink with one colour for the details.',
    css: `:scope {
  --ink: #18181b; /* The name */
  --tint: #6366f1; /* The details */
  --paper: #ffffff; /* Background */
  background-image: none;
  background-color: var(--paper);
  color: var(--ink);
  border: 1px solid #e4e4e7;
}

[data-card="avatar"] { border: 4px solid var(--tint); }
[data-card="title"] { color: var(--tint); opacity: 1; }
[data-card="name"] { color: var(--ink); }
[data-card="subtitle"] { color: var(--ink); opacity: .55; }`,
  },
];
