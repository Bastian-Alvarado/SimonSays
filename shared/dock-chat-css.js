/**
 * @license
 * SPDX-License-Identifier: Apache-2.0 AND LicenseRef-Commons-Clause-1.0
 *
 * The dock's chat stylesheet, on its own: every page reads it (the dock draws
 * its chat with it), and it lived in css-presets.js, which carries every look
 * in the Library — about 400 KB that each page OBS shows downloaded for one
 * stylesheet. css-presets.js re-exports it, so nothing else changed.
 */

/**
 * The dock's chat: CHAT.LOG, always.
 *
 * The dock is a tool at the desk rather than something viewers see, so it does
 * not follow the overlay's theme or stylesheet and takes no stylesheet of its
 * own. One line per message: a platform tag, the name, the words, and a quiet
 * rule underneath, on whatever the window behind it is. A rank is a second tag
 * beside the platform's, in words, so nobody has to know what a colour means.
 *
 * It reads the app's colour roles, so it follows the light and dark editions;
 * each has a fallback for a page without them.
 *
 * Nothing a dock option controls is !important here, so the options and
 * sliders still move it. Padding, corners, the row's colour and the text
 * colour are written by those controls onto the row itself, which beats a rule
 * without !important. The rank colours and name colours arrive as custom
 * properties the row sets only when they are chosen (--chat-rank-picked fills
 * the rank tag, --chat-user-color colours the name). A name's colour is only ever its words: it keeps its hue
 * and takes the edition's lightness and a soft saturation, so any colour a
 * viewer picks reads on both editions and sits with the app's own colours.
 *
 * The rules still marked !important are the ones no control speaks for: the
 * rank bubble, which the tag replaces.
 */
export const DOCK_CHAT_CSS = `:scope {
  --ground: transparent; /* The window behind it */
  --ink: var(--ss-line, #f2eee9); /* The words */
  --rule: var(--ss-hair, #1d1c1c); /* Under each message */
}

[data-chat="row"] {
  background: var(--ground);
  border-radius: 0;
  box-shadow: inset 0 -1px 0 var(--rule);
  padding: 8px 14px;
  gap: 10px;
}

/* All on one line, a message reads like a sentence: a long one carries on under the name. */
[data-chat-kind="custom"]:not(:has(> div)) { display: block; }
[data-chat-kind="custom"]:not(:has(> div)) [data-chat="marks"] { display: inline-flex; vertical-align: middle; margin-right: 8px; }
[data-chat-kind="custom"]:not(:has(> div)) [data-chat="user"] { display: inline; margin-right: 8px; }
[data-chat-kind="custom"]:not(:has(> div)) [data-chat="text"] { display: inline; }
[data-chat-kind="custom"]:not(:has(> div)) [data-chat="avatar"] { display: inline-block; vertical-align: middle; margin-right: 8px; }
[data-chat-kind="custom"]:not(:has(> div)) [data-chat="time"] { float: right; margin-left: 10px; }

/* Name above: an avatar is taller than the two lines' head, so they sit beside its middle. */
[data-chat="row"]:has(> [data-chat="avatar"]) { align-items: center; }

/* The platform: its tag, and the colour of the name. */
[data-chat-platform="twitch"] { --tag-word: "TW"; --tag: #7a4fd8; --name-own: var(--ss-chat-twitch, #b79bff); }
[data-chat-platform="youtube"] { --tag-word: "YT"; --tag: #c8321f; --name-own: var(--ss-chat-youtube, #ff8a7a); }
[data-chat-platform="tiktok"] { --tag-word: "TT"; --tag: #147a78; --name-own: var(--ss-chat-tiktok, #6ed6cf); }
[data-chat-platform="discord"] { --tag-word: "DC"; --tag: #4752c4; --name-own: var(--ss-chat-discord, #a9b6f2); }

[data-chat="platform"], [data-chat="rank"] {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  min-width: 22px;
  height: 16px;
  padding: 0 3px;
  font: 700 10px/1 var(--ss-mono, ui-monospace, monospace);
  letter-spacing: .04em;
}
[data-chat="platform"] { background: var(--tag); color: #ffffff; }
[data-chat="platform"] > *, [data-chat="rank"] > * { display: none; }
[data-chat="platform"]::before { content: var(--tag-word); }

/* The rank: the highest they hold, in the colour picked for it in the settings, else the app's own. */
[data-chat="rank"] { background: var(--rank-tag); color: var(--rank-ink); }
[data-chat="rank"]::before { content: var(--rank-word); }

/* The name: its platform's colour or the one chosen for it, softened to fit the edition. */
[data-chat="user"] {
  --name-base: var(--chat-user-color, var(--name-own));
  --name-ink: oklch(from var(--name-base) var(--ss-chat-l, .84) min(c, var(--ss-chat-c, .1)) h);
  color: var(--name-ink);
  font-family: var(--ss-mono, ui-monospace, monospace);
  letter-spacing: .06em;
  text-transform: uppercase;
  border-radius: 0;
}

[data-chat="text"] {
  color: var(--ink);
  font-weight: 600;
  line-height: 1.3;
}

[data-chat="time"] { color: var(--ss-muted, rgba(255,255,255,.5)); }

[data-chat-rank="broadcaster"] { --rank-word: "HOST"; --rank-tag: var(--chat-rank-picked, var(--ss-house, #f43f5e)); --rank-ink: var(--chat-rank-ink, #050505); }
[data-chat-rank="moderator"] { --rank-word: "MOD"; --rank-tag: var(--chat-rank-picked, #bfe3cc); --rank-ink: var(--chat-rank-ink, #1e2b23); }
[data-chat-rank="vip"] { --rank-word: "VIP"; --rank-tag: var(--chat-rank-picked, #f8b82a); --rank-ink: var(--chat-rank-ink, #27272a); }
[data-chat-rank="subscriber"] { --rank-word: "SUB"; --rank-tag: var(--chat-rank-picked, var(--ss-key, #323030)); --rank-ink: var(--chat-rank-ink, var(--ss-line, #f2eee9)); }

[data-chat="highlight"] {
  border: 0 !important;
  border-radius: 0 !important;
  background: transparent !important;
}`;
