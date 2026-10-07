/**
 * @license
 * SPDX-License-Identifier: Apache-2.0 AND LicenseRef-Commons-Clause-1.0
 *
 * Earlier versions of the welcome card looks, word for word, by the look
 * they became. A card keeps a copy of its look's stylesheet, so a look that
 * gains a field — the name's colour, 2026-10-02 — does not reach a card
 * that already wears it. A card whose stylesheet is exactly one of these,
 * never edited, is read as the look's current version instead (cleanCard);
 * one that was edited is left as it is.
 */

export const PREVIOUS_CARD_LOOKS = {
  "card-simonsays": [
    ":scope {\n  --color: #ffffff; /* Colour */\n  --ground: #0f0f12; /* Background */\n  --ground2: #27272a; /* Background, far side */\n  background-image: linear-gradient(135deg, var(--ground), var(--ground2));\n}\n\n[data-card=\"avatar\"] { border: 6px solid var(--color); box-shadow: 0 12px 32px rgba(0,0,0,.55); }\n[data-card=\"title\"] { color: var(--color); opacity: .8; }\n[data-card=\"name\"] { color: #ffffff; }\n[data-card=\"subtitle\"] { color: var(--color); opacity: .6; }",
  ],
  "card-cyberpunky": [
    ":scope {\n  --neon: #ffffff; /* Main colour */\n  --ground: #0a0a0b; /* Background */\n  --grid: rgba(255,255,255,.05); /* The grid */\n  background-image:\n    linear-gradient(var(--grid) 1px, transparent 1px),\n    linear-gradient(90deg, var(--grid) 1px, transparent 1px);\n  background-size: 44px 44px;\n  background-color: var(--ground);\n  border: 1px solid rgba(255,255,255,.25);\n  font-family: 'Chakra Petch';\n}\n\n[data-card=\"avatar\"] { border-radius: 0; border: 2px solid var(--neon); }\n[data-card=\"title\"] { font-family: 'VT323'; font-weight: 400; letter-spacing: 6px; color: var(--neon); opacity: 1; }\n[data-card=\"name\"] { text-transform: uppercase; font-weight: 700; color: var(--neon); }\n[data-card=\"subtitle\"] { font-family: 'VT323'; font-weight: 400; font-size: 30px; letter-spacing: 3px; opacity: .7; }",
  ],
};
