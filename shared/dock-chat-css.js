/**
 * @license
 * SPDX-License-Identifier: Apache-2.0 AND LicenseRef-Commons-Clause-1.0
 *
 * The dock's chat stylesheet, on its own: every page reads it (the dock draws
 * its chat with it), and it lived in css-presets.js, which carries every look
 * in the Library — about 400 KB that each page OBS shows downloaded for one
 * stylesheet. css-presets.js re-exports it, so nothing else changed.
 */

import { SPECTRUM, SPECTRUM_DOWN } from './looks/common.js';

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
