/**
 * @license
 * SPDX-License-Identifier: Apache-2.0 AND LicenseRef-Commons-Clause-1.0
 *
 * The library: stylesheets to start from, grouped by the look they belong to.
 *
 * Grouped rather than listed, because a look is the thing somebody wants. The
 * ticker, the run card and the nameplate in "Marathon" are one decision, not
 * three, and a flat list of a dozen names makes you rebuild that decision
 * every time.
 *
 * Each entry names only parts the app promises to keep, so a preset cannot
 * quietly stop working when a component is rewritten. Tests hold that, and
 * hold each one to the layer it is offered on.
 *
 * Every one of these was rendered on a canvas and looked at before it was
 * written down. That matters more than it sounds: two were wrong the first
 * time in ways reading would never have shown — corner brackets that came out
 * a solid block, and a bezel that covered the digits it was meant to frame.
 *
 * Shaped as data with nothing built in about where it came from, so that a
 * page for making your own can add to the same list later without this having
 * to change.
 */

import { LOOK_THEMES } from './looks/index.js';
import { SPECTRUM, SPECTRUM_DOWN, A } from './looks/common.js';

/** Every theme, in the Library's order: shared/looks/, a file each. */
export const CSS_LOOKS = LOOK_THEMES;

/**
 * Which box an entry belongs in.
 *
 * A look and a motion are different decisions about the same layer, kept in
 * different fields so that changing one cannot take the other with it. Every
 * entry that does not say is a look, which is what all of them were.
 */
/**
 * What a preset is written onto: a layer on a canvas, one alert, or the chat.
 *
 * An alert is not a layer. A layout holds one alerts layer that every alert
 * on the channel plays through, so these go on the alert record itself and
 * are picked one at a time rather than dropped across a layout.
 */
export const presetApplies = (entry) => {
  if (entry.applies === 'alert') return 'alert';
  if (entry.applies === 'chat') return 'chat';
  return 'layer';
};

export const presetKind = (entry) => (entry.kind === 'motion' ? 'motion' : 'look');

/** The field on a layer that a preset of this kind is written into. */
export const presetField = (entry) => (presetKind(entry) === 'motion' ? 'motionCss' : 'css');

/** Every entry, flat, for the places that do not care which look it came from. */
export const ALL_PRESETS = CSS_LOOKS.flatMap((look) =>
  look.objects.map((object) => ({ ...object, lookId: look.id, lookName: look.name })));

/**
 * The kinds of layer the library has anything for, in the order they appear.
 *
 * Read from the presets rather than written down beside them, so a filter can
 * never offer a kind with nothing behind it.
 */
export const PRESET_LAYER_TYPES = [...new Set(ALL_PRESETS.map((p) => p.layerType))];

/**
 * Whether a whole look can be dropped onto every matching layer at once.
 *
 * Shapes cannot. A layout holds many of them and each is a different piece of
 * the build — a wall, a frame, a divider — so writing one stylesheet across
 * all of them would destroy the others. Everything else in a layout is either
 * the only one of its kind or a set that wants to match.
 */
export const canApplyInBulk = (layerType) => layerType !== 'shape';

/**
 * The dock's chat: Marathon's, always.
 *
 * The dock is a tool at the desk rather than something viewers see, so it does
 * not follow the overlay's theme or stylesheet and takes no stylesheet of its
 * own — it is the Marathon chat every time, whatever the stream is wearing.
 *
 * It is the Marathon chat look above with one difference: nothing that a dock
 * option controls is !important here, so the options and sliders still move
 * it. Padding, corners, the row's colour and the text colour are written by
 * those controls onto the row itself, which beats a rule without !important;
 * the rank colours and name colours arrive as custom properties the row sets
 * only when they are chosen (--chat-rank-picked, --chat-user-color, and the
 * ink to write on them). Where nothing is set, it is exactly Marathon.
 *
 * The two rules still marked !important are the ones no control speaks for:
 * the rank bubble, which Marathon replaces with the chip and the edge, and an
 * event's name, which is written in its platform's colour and would otherwise
 * sit unreadable on the chip.
 */
export const DOCK_CHAT_CSS = `:scope {
  --ground: #09090bcc; /* The black it sits on */
  --on-accent: #09090b; /* Text on the accent */
  --ink: #ffffff; /* The words */
  --mod: #00ff88; /* Moderator */
  --vip: #ff2d95; /* VIP */
  --sub: #00d5ff; /* Subscriber */
  --accent: var(--overlay-accent, var(--current-accent, #f43f5e));
}

[data-chat="row"] {
  background: var(--ground);
  border-radius: 0;
  border-left: 3px solid var(--chat-rank, var(--accent));
  padding: 7px 12px;
  gap: 8px;
}

/* The name as a filled chip: their own colour when name colours are on. */
[data-chat="user"] {
  background: var(--chat-user-color, var(--accent));
  color: var(--chat-user-ink, var(--on-accent));
  padding: 0 .4em;
  letter-spacing: .1em;
  border-radius: 0;
}

[data-chat="text"] {
  color: var(--ink);
  letter-spacing: .01em;
}

[data-chat="time"] { color: rgba(255,255,255,.3); }

[data-chat="marks"] { opacity: .8; }

/* A rank: the colour picked for it in the settings, else Marathon's own. */
[data-chat-rank="moderator"] { border-left-color: var(--chat-rank-picked, var(--mod)); }
[data-chat-rank="vip"] { border-left-color: var(--chat-rank-picked, var(--vip)); }
[data-chat-rank="subscriber"] { border-left-color: var(--chat-rank-picked, var(--sub)); }

[data-chat-rank="moderator"] [data-chat="user"] { background: var(--chat-rank-picked, var(--mod)); color: var(--chat-rank-ink, var(--on-accent)); }
[data-chat-rank="vip"] [data-chat="user"] { background: var(--chat-rank-picked, var(--vip)); color: var(--chat-rank-ink, var(--on-accent)); }
[data-chat-rank="subscriber"] [data-chat="user"] { background: var(--chat-rank-picked, var(--sub)); color: var(--chat-rank-ink, var(--on-accent)); }

/* The broadcaster is the spectrum itself, unless a colour is picked for them. */
[data-chat-rank="broadcaster"] [data-chat="user"] { background: var(--chat-rank-picked, ${SPECTRUM}); color: var(--chat-rank-ink, var(--on-accent)); }
[data-chat-rank="broadcaster"] { border-image: var(--chat-rank-edge, ${SPECTRUM_DOWN}) 1; }

[data-chat="highlight"] {
  border: 0 !important;
  border-radius: 0 !important;
  background: transparent !important;
}

[data-chat-kind="event"] [data-chat="user"] { color: var(--on-accent) !important; }`;
