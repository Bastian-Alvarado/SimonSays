/**
 * @license
 * SPDX-License-Identifier: Apache-2.0 AND LicenseRef-Commons-Clause-1.0
 *
 * The "Cyberpunky" theme: every look it has, for every kind of layer it dresses.
 * One of the themes in the Library (shared/looks/index.js lists them, in order).
 */

const look =
  {
    id: 'cyberpunky',
    name: 'Cyberpunky',
    hint: 'A terminal HUD in one bright colour: hairline frames with squares on the corners, hazard hatching, notched chips, squared headings and pixel labels.',
    /*
      Drawn from a demo of a cyberpunk stream pack. What makes it read is not
      a colour but a handful of marks, used the same way everywhere: a
      hairline frame with a small square on each corner, hazard hatching where
      a bar ends, chips with one corner cut off, headings in a squared face
      (Chakra Petch) and the small print in a pixel one (VT323).

      The reference is acid lime. This is white, and every colour is a field
      on the layer — Main colour, Text on it, the black it sits on, the
      hairlines — so the pack's other colourways, or any other, are a few
      picks away. It does not follow the layout accent on purpose: that is
      what SimonSays Default is for, and a colourway chosen here should not
      change because a layout's accent did.
    */
    objects: [
      {
        id: 'cyber-omnibar',
        layerType: 'omnibar',
        name: 'Terminal bar',
        hint: 'A black bar under a hairline, the label as a notched chip in the main colour and hazard hatching at its end.',
        css: `@property --hatch { syntax: "<length>"; inherits: true; initial-value: 0px; }
@keyframes cyberHatch { to { --hatch: 6px; } }

:scope {
  --neon: #ffffff; /* Main colour */
  --on-neon: #0a0a0b; /* Text on the main colour */
  --ground: #0a0a0b; /* The black it sits on */
  --line: #ffffff40; /* Hairlines */
  --speed: 0.6s; /* Seconds per stripe | 0.1-4 */
  --notch: 0.7em; /* Cut corner | 0-2 */
}

[data-omnibar="bar"] {
  background: var(--omnibar-background, var(--ground)) !important;
  border-radius: 0 !important;
  border-top: 1px solid var(--line);
  padding: 0 !important;
  gap: 0 !important;
  font-family: 'Chakra Petch', sans-serif;
}

[data-omnibar="slot"] {
  align-items: stretch !important;
  height: 100%;
  gap: 0 !important;
  flex: 1 1 auto;
}

/* A kept cell is ruled off from the rotation beside it. */
[data-omnibar-state="pinned"] { flex: 0 0 auto; box-shadow: inset -1px 0 0 var(--line); }

[data-omnibar="label"] {
  display: flex;
  align-items: center;
  padding: 0 1.1em 0 1.3em;
  background: var(--omnibar-accent, var(--neon));
  color: var(--on-neon) !important;
  letter-spacing: .12em;
  clip-path: polygon(var(--notch) 0, 100% 0, 100% 100%, 0 100%, 0 var(--notch));
}

/* Hatching after the chip, where the reference ends its bars. */
[data-omnibar="value"] {
  animation: cyberHatch var(--speed) linear infinite;
  display: flex;
  align-items: center;
  flex: 1 1 auto;
  padding: 0 1.2em;
  letter-spacing: .06em;
  background:
    repeating-linear-gradient(-45deg, var(--omnibar-accent, var(--neon)) var(--hatch) calc(var(--hatch) + 2px), #0000 calc(var(--hatch) + 2px) calc(var(--hatch) + 6px)) left center / 1.4em 60% no-repeat;
  padding-left: 2.2em;
}`,
      },
      {
        id: 'cyber-tallbar',
        layerType: 'omnibar',
        name: 'Terminal tall bar',
        hint: 'For a tall omnibar: a notched block in the main colour saying what is up, a hairline track with the rest hatched, and the total big and square.',
        previewTall: true,
        previewSize: { width: 1100, height: 110 },
        css: `@property --hatch { syntax: "<length>"; inherits: true; initial-value: 0px; }
@keyframes cyberHatch { to { --hatch: 6px; } }

:scope {
  --neon: #ffffff; /* Main colour */
  --on-neon: #0a0a0b; /* Text on the main colour */
  --ground: #0a0a0b; /* The black it sits on */
  --line: #ffffff40; /* Hairlines */
  --speed: 0.6s; /* Seconds per stripe | 0.1-4 */
  --notch: 1em; /* Cut corner | 0-3 */
}

[data-tallbar="bar"] {
  background: var(--omnibar-background, var(--ground)) !important;
  border-top: 1px solid var(--line);
  font-family: 'Chakra Petch', sans-serif;
}

[data-tallbar="context"] {
  background: var(--omnibar-accent, var(--neon));
  border-right: 0 !important;
  clip-path: polygon(var(--notch) 0, 100% 0, 100% 100%, 0 100%, 0 var(--notch));
}
[data-tallbar="label"], [data-tallbar="sub"] { color: var(--on-neon) !important; letter-spacing: .1em; }

[data-tallbar="detail"], [data-tallbar="figure-target"] { font-family: 'VT323', monospace; }

/* The part still to go is hatched rather than empty. */
[data-tallbar="goal-track"] {
  animation: cyberHatch var(--speed) linear infinite;
  background: repeating-linear-gradient(-45deg, var(--line) var(--hatch) calc(var(--hatch) + 2px), #0000 calc(var(--hatch) + 2px) calc(var(--hatch) + 6px)) !important;
  border: 1px solid var(--line) !important;
}
[data-tallbar="goal-fill"] { background: var(--omnibar-accent, var(--neon)) !important; }
[data-tallbar="goal-marker"] {
  background: var(--ground) !important;
  color: var(--omnibar-accent, var(--neon)) !important;
  border: 1px solid var(--omnibar-accent, var(--neon)) !important;
  font-family: 'VT323', monospace;
}

[data-tallbar="chip"] { border-color: var(--line) !important; border-radius: 0 !important; }
[data-tallbar="chip-value"] { background: var(--omnibar-accent, var(--neon)) !important; color: var(--on-neon) !important; }

[data-tallbar="pinned"] { border-left: 1px solid var(--line) !important; }
[data-tallbar="pinned-figure"] { color: var(--omnibar-accent, var(--neon)) !important; }
[data-tallbar="pinned-caption"] { color: #ffffffaa !important; font-family: 'VT323', monospace; }`,
      },
      /*
        How these arrive. Kept with the looks, in the motion box rather than
        the look one, the way every theme keeps its own.
      */
      {
        id: 'cyber-header-draw',
        layerType: 'omnibar',
        kind: 'motion',
        // Drawn over the Terminal bar, whose filled, notched label is the thing being drawn.
        previewWith: 'cyber-omnibar',
        name: 'Header draw',
        hint: 'The header rises from the bottom as a sliver as wide as its cut corner, then draws itself out to the right, and the rest of the slot follows from its edge. For either Cyberpunky bar. Replays on every rotation.',
        /*
          One clip-path, three shapes, and the same five points in all of
          them so each can become the next: nothing, then a sliver standing
          at the left edge — as wide as the cut corner, so its slanted top IS
          the corner — then the whole header. Only the right-hand points move
          in the second half, which is what makes it read as drawn from the
          sliver rather than grown from nowhere.

          The corner is --notch, the field the Terminal bars declare, so a
          wider corner is a thicker sliver without touching this.

          The looping hatch after a label is the look's animation; setting the
          wipe on the same element would stop it, so it is named again here.
          Leaving runs the draw backwards and finishes inside the bar's 450ms.
        */
        css: `[data-omnibar="slot"], [data-tallbar="slot"] { animation: none !important; }

[data-omnibar="label"], [data-tallbar="context"] {
  animation: cyberHeader .6s cubic-bezier(.3,.7,.2,1) both;
}

[data-omnibar="value"] {
  animation: cyberWipe .3s cubic-bezier(.3,.7,.2,1) .5s both, cyberHatch var(--speed, .6s) linear infinite;
}
[data-tallbar="card"] { animation: cyberWipe .35s cubic-bezier(.3,.7,.2,1) .5s both; }

[data-omnibar-state="leaving"] [data-omnibar="value"] {
  animation: cyberUnwipe .18s cubic-bezier(.5,0,.8,.4) both;
}
[data-omnibar-state="leaving"] [data-omnibar="label"] {
  animation: cyberHeader .26s cubic-bezier(.5,0,.8,.4) .14s reverse both;
}

@keyframes cyberHeader {
  0% { clip-path: polygon(var(--notch, .7em) 100%, var(--notch, .7em) 100%, var(--notch, .7em) 100%, 0 100%, 0 100%); }
  45% { clip-path: polygon(var(--notch, .7em) 0, var(--notch, .7em) 0, var(--notch, .7em) 100%, 0 100%, 0 var(--notch, .7em)); }
  100% { clip-path: polygon(var(--notch, .7em) 0, 100% 0, 100% 100%, 0 100%, 0 var(--notch, .7em)); }
}
@keyframes cyberWipe { from { clip-path: inset(0 100% 0 0); } to { clip-path: inset(0 0 0 0); } }
@keyframes cyberUnwipe { from { clip-path: inset(0 0 0 0); } to { clip-path: inset(0 100% 0 0); } }`,
      },
      {
        id: 'cyber-card-draw',
        layerType: 'runcard',
        kind: 'motion',
        name: 'Card draw',
        hint: 'The card rises from the bottom as a sliver and draws itself out to the right, then the category chip does the same from its cut corner. Replays when the game changes.',
        previewWith: 'cyber-runcard',
        /*
          Header draw, for the run card. "backwards" rather than "both": once drawn,
          the card has no clip-path at all, so nothing of it is ever cut off after.
        */
        css: `:scope { --sliver: 6px; /* Sliver width | 1-40 */ }

[data-runcard="card"] { animation: cyberDrawBox .6s cubic-bezier(.3,.7,.2,1) backwards; }
[data-runcard="category"] { animation: cyberDrawChip .5s cubic-bezier(.3,.7,.2,1) .5s backwards; }

@keyframes cyberDrawBox {
  0% { clip-path: polygon(var(--sliver) 100%, var(--sliver) 100%, var(--sliver) 100%, 0 100%, 0 100%); }
  45% { clip-path: polygon(var(--sliver) 0, var(--sliver) 0, var(--sliver) 100%, 0 100%, 0 0); }
  100% { clip-path: polygon(0 0, 100% 0, 100% 100%, 0 100%, 0 0); }
}
@keyframes cyberDrawChip {
  0% { clip-path: polygon(.5em 100%, .5em 100%, .5em 100%, 0 100%, 0 100%); }
  45% { clip-path: polygon(.5em 0, .5em 0, .5em 100%, 0 100%, 0 .5em); }
  100% { clip-path: polygon(.5em 0, 100% 0, 100% 100%, 0 100%, 0 .5em); }
}`,
      },
      {
        id: 'cyber-row-draw',
        layerType: 'nameplate',
        kind: 'motion',
        name: 'Row draw',
        hint: 'The row rises from the bottom as a sliver and draws itself out to the right, and the arrow lights at the end. Replays when the name changes.',
        previewWith: 'cyber-nameplate',
        /*
          Header draw, for the Event row. The arrow is the look's ::after; it arrives
          last, once there is a row for it to point from.
        */
        css: `:scope { --sliver: 6px; /* Sliver width | 1-40 */ }

[data-nameplate="plate"] { animation: cyberDrawBox .6s cubic-bezier(.3,.7,.2,1) backwards; }
[data-nameplate="plate"]::after { animation: cyberAppear .2s ease-out .55s backwards; }

@keyframes cyberDrawBox {
  0% { clip-path: polygon(var(--sliver) 100%, var(--sliver) 100%, var(--sliver) 100%, 0 100%, 0 100%); }
  45% { clip-path: polygon(var(--sliver) 0, var(--sliver) 0, var(--sliver) 100%, 0 100%, 0 0); }
  100% { clip-path: polygon(0 0, 100% 0, 100% 100%, 0 100%, 0 0); }
}
@keyframes cyberAppear { from { opacity: 0; } }`,
      },
      {
        id: 'cyber-alert-draw',
        layerType: 'alert',
        applies: 'alert',
        kind: 'motion',
        name: 'Alert draw',
        hint: 'Each line of the alert rises as a sliver and draws out to the right — the message, then the name — and the code line follows. Leaves the built-in exit alone.',
        previewWith: 'cyber-alert',
        /*
          Only the lines are animated, never the alert itself: the built-in exit is a
          class on the alert, and a motion that set its animation would take that way
          out away with it.
        */
        css: `:scope { --sliver: 6px; /* Sliver width | 1-40 */ }

[data-alert="message"] { animation: cyberDrawBox .55s cubic-bezier(.3,.7,.2,1) backwards; }
[data-alert="name"] { animation: cyberDrawBox .55s cubic-bezier(.3,.7,.2,1) .35s backwards; }
[data-alert="caption"]::after { animation: cyberAppear .3s ease-out .85s backwards; }

@keyframes cyberDrawBox {
  0% { clip-path: polygon(var(--sliver) 100%, var(--sliver) 100%, var(--sliver) 100%, 0 100%, 0 100%); }
  45% { clip-path: polygon(var(--sliver) 0, var(--sliver) 0, var(--sliver) 100%, 0 100%, 0 0); }
  100% { clip-path: polygon(0 0, 100% 0, 100% 100%, 0 100%, 0 0); }
}
@keyframes cyberAppear { from { opacity: 0; } }`,
      },
      {
        id: 'cyber-line-draw',
        layerType: 'chat',
        applies: 'chat',
        kind: 'motion',
        name: 'Line draw',
        hint: 'Each new message rises as a sliver at the left and draws itself out to the right. Applying it turns the chat theme to Custom.',
        previewWith: 'cyber-chat',
        /*
          Header draw, for a line of chat. Quicker than the others: chat can arrive
          several lines a second, and each has to be finished before the next.
        */
        css: `:scope { --sliver: 6px; /* Sliver width | 1-40 */ }

[data-chat="row"] { animation: cyberDrawBox .4s cubic-bezier(.3,.7,.2,1) backwards; }

@keyframes cyberDrawBox {
  0% { clip-path: polygon(var(--sliver) 100%, var(--sliver) 100%, var(--sliver) 100%, 0 100%, 0 100%); }
  45% { clip-path: polygon(var(--sliver) 0, var(--sliver) 0, var(--sliver) 100%, 0 100%, 0 0); }
  100% { clip-path: polygon(0 0, 100% 0, 100% 100%, 0 100%, 0 0); }
}`,
      },
      {
        id: 'cyber-question-draw',
        layerType: 'question',
        kind: 'motion',
        name: 'Question draw',
        hint: 'The card rises as a sliver and draws itself out to the right, then the label chip does the same from its cut corner. Replays for every question put up.',
        previewWith: 'cyber-question',
        /*
          Header draw, for the question card, which remounts for each question shown.
        */
        css: `:scope { --sliver: 6px; /* Sliver width | 1-40 */ }

[data-question="card"] { animation: cyberDrawBox .6s cubic-bezier(.3,.7,.2,1) backwards; }
[data-question="label"] { animation: cyberDrawChip .45s cubic-bezier(.3,.7,.2,1) .5s backwards; }

@keyframes cyberDrawBox {
  0% { clip-path: polygon(var(--sliver) 100%, var(--sliver) 100%, var(--sliver) 100%, 0 100%, 0 100%); }
  45% { clip-path: polygon(var(--sliver) 0, var(--sliver) 0, var(--sliver) 100%, 0 100%, 0 0); }
  100% { clip-path: polygon(0 0, 100% 0, 100% 100%, 0 100%, 0 0); }
}
@keyframes cyberDrawChip {
  0% { clip-path: polygon(.5em 100%, .5em 100%, .5em 100%, 0 100%, 0 100%); }
  45% { clip-path: polygon(.5em 0, .5em 0, .5em 100%, 0 100%, 0 .5em); }
  100% { clip-path: polygon(.5em 0, 100% 0, 100% 100%, 0 100%, 0 .5em); }
}`,
      },
      {
        id: 'cyber-runcard',
        layerType: 'runcard',
        name: 'Cartridge',
        hint: 'A hairline frame with a square on each corner, the game in squared capitals and the category as a notched chip.',
        css: `:scope {
  --neon: #ffffff; /* Main colour */
  --on-neon: #0a0a0b; /* Text on the main colour */
  --ground: #0a0a0b; /* The black it sits on */
  --line: #ffffff40; /* Hairlines */
  --square: 6px; /* Corner squares */
}

[data-runcard="card"] {
  background:
    linear-gradient(var(--runcard-accent, var(--neon)), var(--runcard-accent, var(--neon))) left top / var(--square) var(--square) no-repeat,
    linear-gradient(var(--runcard-accent, var(--neon)), var(--runcard-accent, var(--neon))) right top / var(--square) var(--square) no-repeat,
    linear-gradient(var(--runcard-accent, var(--neon)), var(--runcard-accent, var(--neon))) left bottom / var(--square) var(--square) no-repeat,
    linear-gradient(var(--runcard-accent, var(--neon)), var(--runcard-accent, var(--neon))) right bottom / var(--square) var(--square) no-repeat,
    var(--ground) !important;
  border: 1px solid var(--line) !important;
  border-radius: 0 !important;
  font-family: 'Chakra Petch', sans-serif;
}

[data-runcard="title"] {
  color: var(--runcard-accent, var(--neon)) !important;
  text-transform: uppercase;
  font-weight: 700 !important;
  letter-spacing: .02em;
}

[data-runcard="machine"] { font-family: 'VT323', monospace; opacity: .7 !important; letter-spacing: .1em; }

[data-runcard="details"] { gap: .5em !important; }

[data-runcard="category"] {
  background: var(--runcard-accent, var(--neon));
  color: var(--on-neon) !important;
  padding: .1em .7em .1em .9em;
  clip-path: polygon(.5em 0, 100% 0, 100% 100%, 0 100%, 0 .5em);
  letter-spacing: .1em;
}

[data-runcard="estimate"] { font-family: 'VT323', monospace; letter-spacing: .08em; }`,
      },
      {
        id: 'cyber-nameplate',
        layerType: 'nameplate',
        name: 'Event row',
        hint: 'The name in squared capitals over a rule in the main colour, the second line in pixel print above it, and an arrow at the end — the reference\'s event list.',
        previewSize: { width: 520, height: 92 },
        css: `:scope {
  --neon: #ffffff; /* Main colour */
  --label: #ffffff; /* The small line */
  --ground: #0a0a0bcc; /* The black it sits on */
}

[data-nameplate="plate"] {
  position: relative !important;
  background: var(--nameplate-background, var(--ground)) !important;
  border: 0 !important;
  border-bottom: 2px solid var(--neon) !important;
  border-radius: 0 !important;
  flex-direction: column-reverse !important;
  font-family: 'Chakra Petch', sans-serif;
  padding-right: 2.2em !important;
}

/* The arrow the reference ends every row with. */
[data-nameplate="plate"]::after {
  content: '';
  position: absolute;
  right: .9em;
  top: 50%;
  width: .6em;
  height: .7em;
  transform: translateY(-50%);
  background: var(--neon);
  clip-path: polygon(0 0, 100% 50%, 0 100%);
}

[data-nameplate="name"] {
  text-transform: uppercase;
  font-weight: 700 !important;
  letter-spacing: .02em !important;
}

[data-nameplate="subtitle"] {
  color: var(--nameplate-accent, var(--label)) !important;
  font-family: 'VT323', monospace;
  text-transform: uppercase;
  letter-spacing: .14em;
  opacity: 1 !important;
}`,
      },
      {
        id: 'cyber-roster',
        layerType: 'roster',
        name: 'Crew',
        hint: 'Each seat a hairline box with the role as a tab in the main colour, the name in squared capitals and the pronouns in pixel print. A free seat keeps its box with the light off.',
        previewSize: { width: 620, height: 150 },
        css: `:scope {
  --neon: #ffffff; /* Main colour */
  --on-neon: #0a0a0b; /* Text on the main colour */
  --host: #ffffff; /* The host's tab */
  --ground: #0a0a0b; /* The black it sits on */
  --line: #ffffff40; /* Hairlines */
  --free: #2a2a2e; /* A free seat */
}

[data-roster="seat"] {
  --tab: var(--neon);
  background: var(--ground) !important;
  border-radius: 0 !important;
  box-shadow: inset 0 0 0 1px var(--line);
  opacity: 1 !important;
  font-family: 'Chakra Petch', sans-serif;
}
[data-roster="seat"][data-roster-role="host"] { --tab: var(--host); }

[data-roster="tab"] { background: var(--tab) !important; }
[data-roster="role"] { color: var(--on-neon) !important; }

[data-roster="name"] { text-transform: uppercase; font-weight: 700 !important; letter-spacing: .03em; }
[data-roster="pronouns"] {
  background: transparent !important;
  color: var(--tab) !important;
  font-family: 'VT323', monospace;
  letter-spacing: .12em;
  text-transform: uppercase;
}

[data-roster="seat"][data-roster-empty="yes"] { --tab: var(--free); }
[data-roster="seat"][data-roster-empty="yes"] [data-roster="tab"] { display: none; }
[data-roster="seat"][data-roster-empty="yes"] [data-roster="name"] { color: #3f3f46 !important; }`,
      },
      {
        id: 'cyber-viewers',
        layerType: 'viewers',
        name: 'Signal',
        hint: 'The mark in a bracketed box and the count in pixel print.',
        css: `:scope {
  --neon: #ffffff; /* Main colour */
  --ground: #0a0a0b; /* The black it sits on */
  --line: #ffffff40; /* Hairlines */
}

[data-viewers="box"] {
  background: var(--viewers-background, var(--ground)) !important;
  border-radius: 0 !important;
  border: 1px solid var(--line);
  padding: .2em .6em !important;
  gap: .6em !important;
  align-items: center !important;
}

[data-viewers="row"] { gap: .4em !important; align-items: center !important; }

[data-viewers="icon"] { color: var(--viewers-accent, var(--neon)) !important; }

[data-viewers="count"] {
  font-family: 'VT323', monospace;
  letter-spacing: .06em;
  font-size: 1.3em;
}`,
      },
      {
        id: 'cyber-alert',
        layerType: 'alert',
        applies: 'alert',
        name: 'Glitch alert',
        hint: 'The message and the name stacked in big squared capitals — the message in the main colour — with a chromatic split on the letters and a line of terminal code underneath.',
        /*
          The reference's alerts are type and nothing else: no panel, lines
          stacked tight, and a split of the letters into two colours as they
          land. The split is two text shadows, set by two fields; zero them
          for clean type.
        */
        css: `:scope {
  --neon: #ffffff; /* Main colour */
  --ink: #ffffff; /* The name */
  --split-a: #ff2d6f; /* Glitch, left */
  --split-b: #2de2ff; /* Glitch, right */
  --split: 2px; /* How far the glitch splits */
  --code: #ffffff80; /* The code line */
}

:scope {
  background: transparent;
  padding: 10px 24px;
  font-family: 'Chakra Petch', sans-serif;
}

[data-alert="media"] { border-radius: 0; }

[data-alert="caption"] {
  text-transform: uppercase;
  font-weight: 700;
  line-height: .95;
  letter-spacing: 0;
  text-shadow:
    calc(var(--split) * -1) 0 var(--split-a),
    var(--split) 0 var(--split-b) !important;
}

[data-alert="message"] {
  display: block;
  color: var(--alert-text, var(--neon)) !important;
}

[data-alert="name"] {
  display: block;
  color: var(--alert-name, var(--ink)) !important;
}

/* A line of terminal code under it, the way the reference signs off. */
[data-alert="caption"]::after {
  content: '*/:x[] relay://incoming';
  display: block;
  margin-top: .5em;
  font-family: 'VT323', monospace;
  font-weight: 400;
  font-size: .28em;
  letter-spacing: .12em;
  color: var(--code);
  text-shadow: none;
}`,
      },
      {
        id: 'cyber-countdown',
        layerType: 'countdown',
        name: 'Access pending',
        hint: 'Pixel digits under a status box with hatched ends, on black in a hairline frame.',
        css: `@property --hatch { syntax: "<length>"; inherits: true; initial-value: 0px; }
@keyframes cyberHatch4 { to { --hatch: 4px; } }

:scope {
  --neon: #ffffff; /* Main colour */
  --ground: #0a0a0b; /* The black it sits on */
  --line: #ffffff40; /* Hairlines */
  --ink: #ffffff; /* The digits */
  --speed: 0.6s; /* Seconds per stripe | 0.1-4 */
}

:scope {
  background: var(--ground);
  box-shadow: inset 0 0 0 1px var(--line);
}

[data-countdown="clock"] {
  background: transparent !important;
  gap: .2em !important;
}

/* The label as the reference's "CONNECTED" box: hatched at both ends. */
[data-countdown="label"] {
  animation: cyberHatch4 var(--speed) linear infinite;
  font-family: 'VT323', monospace;
  color: var(--countdown-label, var(--neon)) !important;
  letter-spacing: .14em;
  border: 1px solid var(--neon);
  padding: .05em 2.2em;
  background:
    repeating-linear-gradient(-45deg, var(--neon) var(--hatch) calc(var(--hatch) + 1px), #0000 calc(var(--hatch) + 1px) calc(var(--hatch) + 4px)) left / 1.6em 100% no-repeat,
    repeating-linear-gradient(-45deg, var(--neon) var(--hatch) calc(var(--hatch) + 1px), #0000 calc(var(--hatch) + 1px) calc(var(--hatch) + 4px)) right / 1.6em 100% no-repeat;
}

[data-countdown="digits"] {
  font-family: 'VT323', monospace !important;
  font-weight: 400 !important;
  color: var(--countdown-text, var(--ink)) !important;
  letter-spacing: .04em;
}

[data-countdown="paused"] {
  font-family: 'VT323', monospace;
  color: var(--countdown-label, var(--neon)) !important;
  letter-spacing: .14em;
}`,
      },
      {
        id: 'cyber-stopwatch',
        layerType: 'stopwatch',
        name: 'Uplink timer',
        hint: 'The run timer in pixel digits over a hatched rule: steady while it runs, dimmed when paused, the rule filled in the main colour when the run is done.',
        css: `@property --hatch { syntax: "<length>"; inherits: true; initial-value: 0px; }
@keyframes cyberHatch { to { --hatch: 6px; } }

:scope {
  --neon: #ffffff; /* Main colour */
  --ground: #0a0a0b; /* The black it sits on */
  --line: #ffffff40; /* Hairlines */
  --ink: #ffffff; /* Running digits */
  --held: #71717a; /* Paused digits */
  --speed: 0.6s; /* Seconds per stripe | 0.1-4 */
}

:scope {
  animation: cyberHatch var(--speed) linear infinite;
  background:
    repeating-linear-gradient(-45deg, var(--line) var(--hatch) calc(var(--hatch) + 2px), #0000 calc(var(--hatch) + 2px) calc(var(--hatch) + 6px)) left bottom / 100% 6px no-repeat,
    var(--ground);
  box-shadow: inset 0 0 0 1px var(--line);
}

[data-stopwatch="clock"] { background: transparent !important; }

[data-stopwatch="digits"] {
  font-family: 'VT323', monospace !important;
  color: var(--stopwatch-colour, var(--ink)) !important;
  letter-spacing: .04em;
}

[data-stopwatch-mode="idle"] [data-stopwatch="digits"] { opacity: .45; }
[data-stopwatch-mode="paused"] [data-stopwatch="digits"] { color: var(--stopwatch-colour, var(--held)) !important; }

[data-stopwatch-mode="finished"] {
  background:
    linear-gradient(var(--neon), var(--neon)) left bottom / 100% 6px no-repeat,
    var(--ground);
}
[data-stopwatch-mode="finished"] [data-stopwatch="digits"] { color: var(--stopwatch-colour, var(--neon)) !important; }`,
      },
      {
        id: 'cyber-chat',
        layerType: 'chat',
        applies: 'chat',
        name: 'Terminal feed',
        hint: 'Lines on the dark with a hairline under each, the names in their own colours and squared type. Applying it turns the chat theme to Custom.',
        /*
          The reference keeps everybody's name colour, which is most of the
          colour on the screen, so this does too — only the broadcaster's is
          set, to the main colour.
        */
        css: `:scope {
  --neon: #ffffff; /* Main colour */
  --ground: #0a0a0b99; /* Behind each line */
  --ink: #ffffff; /* The words */
  --line: #ffffff1a; /* The rule under each line */
}

[data-chat="row"] {
  background: var(--chat-row-bg, linear-gradient(90deg, var(--ground), #0000)) !important;
  border-radius: var(--chat-row-radius, 0) !important;
  border-bottom: 1px solid var(--line) !important;
  padding: var(--chat-row-padding, 6px 10px) !important;
  gap: 6px !important;
  font-family: 'Chakra Petch', sans-serif;
}

[data-chat="user"] { font-weight: var(--chat-user-weight, 700) !important; letter-spacing: .01em !important; }

[data-chat="text"] { color: var(--chat-text, var(--ink)) !important; font-weight: 500; }

[data-chat="time"] { font-family: 'VT323', monospace; color: #ffffff59 !important; }

[data-chat="avatar"] { border-radius: 0 !important; }

[data-chat-rank="broadcaster"] [data-chat="user"] { color: var(--neon) !important; }

[data-chat="highlight"] {
  border: 0 !important;
  border-radius: 0 !important;
  background: transparent !important;
}`,
      },
      {
        id: 'cyber-images',
        layerType: 'images',
        name: 'Viewport',
        hint: 'The picture in a hairline frame with a square on each corner, held off the edges.',
        css: `:scope {
  --neon: #ffffff; /* Main colour */
  --ground: #0a0a0b; /* The black it sits on */
  --line: #ffffff40; /* Hairlines */
  --square: 6px; /* Corner squares */
  --inset: 16px; /* Room around the picture */
}

[data-images="frame"] {
  background:
    linear-gradient(var(--neon), var(--neon)) left top / var(--square) var(--square) no-repeat,
    linear-gradient(var(--neon), var(--neon)) right top / var(--square) var(--square) no-repeat,
    linear-gradient(var(--neon), var(--neon)) left bottom / var(--square) var(--square) no-repeat,
    linear-gradient(var(--neon), var(--neon)) right bottom / var(--square) var(--square) no-repeat,
    var(--ground);
  box-shadow: inset 0 0 0 1px var(--line);
}

[data-images="picture"] {
  inset: var(--inset) !important;
  width: calc(100% - 2 * var(--inset)) !important;
  height: calc(100% - 2 * var(--inset)) !important;
}`,
      },
      {
        id: 'cyber-headline',
        layerType: 'text',
        name: 'Headline',
        hint: 'Big squared capitals in the main colour, set tight — "STREAM STARTING".',
        css: `:scope {
  --neon: #ffffff; /* Main colour */
}

[data-text="words"] {
  color: var(--neon);
  font-family: 'Chakra Petch', sans-serif;
  font-weight: 700 !important;
  text-transform: uppercase;
  line-height: .9 !important;
  letter-spacing: 0 !important;
}`,
      },
      {
        id: 'cyber-tag',
        layerType: 'text',
        name: 'Notched tag',
        hint: 'The words in a small chip of the main colour with its top left corner cut off — the reference\'s "01".',
        css: `:scope {
  --neon: #ffffff; /* Main colour */
  --on-neon: #0a0a0b; /* Text on the main colour */
}

[data-text="words"] {
  width: auto !important;
  background: var(--neon);
  color: var(--on-neon);
  font-family: 'Chakra Petch', sans-serif;
  font-weight: 700 !important;
  padding: .05em 1.2em .05em .5em;
  clip-path: polygon(.45em 0, 100% 0, 100% 100%, 0 100%, 0 .45em);
}`,
      },
      {
        id: 'cyber-status',
        layerType: 'text',
        name: 'Status box',
        hint: 'Pixel print in a hairline box hatched at both ends — the reference\'s "CONNECTED".',
        css: `@property --hatch { syntax: "<length>"; inherits: true; initial-value: 0px; }
@keyframes cyberHatch4 { to { --hatch: 4px; } }

:scope {
  --neon: #ffffff; /* Main colour */
  --ground: #0a0a0b; /* The black it sits on */
  --speed: 0.6s; /* Seconds per stripe | 0.1-4 */
}

[data-text="words"] {
  animation: cyberHatch4 var(--speed) linear infinite;
  width: auto !important;
  color: var(--neon);
  font-family: 'VT323', monospace;
  text-transform: uppercase;
  letter-spacing: .12em !important;
  border: 1px solid var(--neon);
  padding: .05em 2.4em;
  background:
    repeating-linear-gradient(-45deg, var(--neon) var(--hatch) calc(var(--hatch) + 1px), #0000 calc(var(--hatch) + 1px) calc(var(--hatch) + 4px)) left / 1.8em 100% no-repeat,
    repeating-linear-gradient(-45deg, var(--neon) var(--hatch) calc(var(--hatch) + 1px), #0000 calc(var(--hatch) + 1px) calc(var(--hatch) + 4px)) right / 1.8em 100% no-repeat,
    var(--ground);
}`,
      },
      {
        id: 'cyber-goal',
        layerType: 'goal',
        name: 'Fund meter',
        hint: 'The percent huge and square in the main colour, the label and the numbers in pixel print, and a thin track hatched where it still has to go.',
        css: `@property --hatch { syntax: "<length>"; inherits: true; initial-value: 0px; }
@keyframes cyberHatch { to { --hatch: 6px; } }

:scope {
  --neon: #ffffff; /* Main colour */
  --ink: #ffffff; /* The words */
  --line: #ffffff40; /* Hairlines */
  --speed: 0.6s; /* Seconds per stripe | 0.1-4 */
}

[data-goal="track"] {
  animation: cyberHatch var(--speed) linear infinite;
  background: repeating-linear-gradient(-45deg, var(--goal-track, var(--line)) var(--hatch) calc(var(--hatch) + 2px), #0000 calc(var(--hatch) + 2px) calc(var(--hatch) + 6px)) !important;
  border-radius: 0 !important;
  box-shadow: inset 0 0 0 1px var(--line);
}

[data-goal="fill"] {
  background: var(--goal-bar, var(--neon)) !important;
  border-radius: 0 !important;
}

[data-goal="label"] {
  color: var(--goal-text, var(--ink)) !important;
  font-family: 'VT323', monospace;
  letter-spacing: .12em !important;
  opacity: .85;
}

[data-goal="numbers"] {
  color: var(--goal-text, var(--ink)) !important;
  font-family: 'VT323', monospace;
  letter-spacing: .06em;
}

[data-goal="percent"] {
  color: var(--goal-bar, var(--neon)) !important;
  opacity: 1 !important;
  font-family: 'Chakra Petch', sans-serif;
  font-weight: 700;
  font-size: 2em;
  line-height: 1;
}`,
      },
      {
        id: 'cyber-spotify',
        layerType: 'spotify',
        name: 'Deck player',
        hint: 'A hairline box with the label in pixel print, the song in squared capitals and the progress in the main colour, hatched ahead.',
        css: `@property --hatch { syntax: "<length>"; inherits: true; initial-value: 0px; }
@keyframes cyberHatch { to { --hatch: 6px; } }

:scope {
  --neon: #ffffff; /* Main colour */
  --ground: #0a0a0bdd; /* The black it sits on */
  --ink: #ffffff; /* The words */
  --line: #ffffff40; /* Hairlines */
  --speed: 0.6s; /* Seconds per stripe | 0.1-4 */
}

[data-spotify="player"] {
  background: var(--ground);
  box-shadow: inset 0 0 0 1px var(--line);
  padding: 12px 14px;
  font-family: 'Chakra Petch', sans-serif;
}

[data-spotify="label"] {
  color: var(--neon);
  font-family: 'VT323', monospace;
  letter-spacing: .14em;
  opacity: 1;
}

[data-spotify="art"] { border-radius: 0; }

[data-spotify="title"] { color: var(--ink); text-transform: uppercase; font-weight: 700; }

[data-spotify="elapsed"], [data-spotify="duration"] { font-family: 'VT323', monospace; }

[data-spotify="progress"] {
  animation: cyberHatch var(--speed) linear infinite;
  background: repeating-linear-gradient(-45deg, var(--line) var(--hatch) calc(var(--hatch) + 2px), #0000 calc(var(--hatch) + 2px) calc(var(--hatch) + 6px));
  border-radius: 0;
}

[data-spotify="fill"] { background: var(--neon); border-radius: 0; }`,
      },
      {
        id: 'cyber-plan',
        layerType: 'plan',
        name: 'Mission log',
        hint: 'The heading in pixel print, the line you are on in squared capitals with a square beside it, and the ones done struck through. No ground of its own: lay it on a HUD panel.',
        css: `:scope {
  --neon: #ffffff; /* Main colour */
  --ink: #ffffff; /* The words */
}

[data-plan="list"] {
  background: transparent !important;
  border-radius: 0 !important;
  font-family: 'Chakra Petch', sans-serif;
}

[data-plan="title"] {
  color: var(--neon) !important;
  font-family: 'VT323', monospace;
  letter-spacing: .16em !important;
}

[data-plan="mark"] { border-radius: 0 !important; }

[data-plan-state="now"] [data-plan="mark"] { background: var(--neon) !important; }

[data-plan-state="now"] [data-plan="text"] {
  color: var(--ink) !important;
  opacity: 1 !important;
  text-transform: uppercase;
  font-weight: 700;
}

[data-plan-state="done"] [data-plan="text"] {
  opacity: .35 !important;
  text-decoration: line-through;
}

[data-plan="note"] { font-family: 'VT323', monospace; opacity: .6; }`,
      },
      {
        id: 'cyber-question',
        layerType: 'question',
        name: 'Incoming',
        hint: 'A hairline card with a square on each corner, the label as a notched chip and the question in squared type. Brings its own ground, since it appears over the game.',
        css: `:scope {
  --neon: #ffffff; /* Main colour */
  --on-neon: #0a0a0b; /* Text on the main colour */
  --ground: #0a0a0be6; /* The black it sits on */
  --ink: #ffffff; /* The words */
  --line: #ffffff40; /* Hairlines */
  --square: 6px; /* Corner squares */
}

[data-question="card"] {
  background:
    linear-gradient(var(--neon), var(--neon)) left top / var(--square) var(--square) no-repeat,
    linear-gradient(var(--neon), var(--neon)) right top / var(--square) var(--square) no-repeat,
    linear-gradient(var(--neon), var(--neon)) left bottom / var(--square) var(--square) no-repeat,
    linear-gradient(var(--neon), var(--neon)) right bottom / var(--square) var(--square) no-repeat,
    var(--ground) !important;
  border: 1px solid var(--line) !important;
  border-radius: 0 !important;
  font-family: 'Chakra Petch', sans-serif;
}

[data-question="label"] {
  background: var(--neon);
  color: var(--on-neon) !important;
  padding: .1em .6em .1em .8em;
  clip-path: polygon(.5em 0, 100% 0, 100% 100%, 0 100%, 0 .5em);
  letter-spacing: .12em !important;
}

[data-question="asker"] { font-family: 'VT323', monospace; color: var(--neon) !important; opacity: .8 !important; }

[data-question="text"] { color: var(--ink) !important; font-weight: 600; }`,
      },
      {
        id: 'cyber-panel',
        layerType: 'shape',
        name: 'HUD panel',
        hint: 'Black with a faint grid, a hairline held inside its edge and a square on each corner of it. The ground a screen is built on.',
        css: `:scope {
  --neon: #ffffff; /* Main colour */
  --ground: #0a0a0b; /* The black it sits on */
  --grid: #ffffff0d; /* The grid */
  --cell: 44px; /* Grid size */
  --line: #ffffff33; /* The hairline */
  --in: 16px; /* How far in the hairline sits */
  --square: 7px; /* Corner squares */
}

[data-shape="box"] {
  --at: calc(var(--in) - var(--square) / 2);
  background:
    linear-gradient(var(--neon), var(--neon)) left var(--at) top var(--at) / var(--square) var(--square) no-repeat,
    linear-gradient(var(--neon), var(--neon)) right var(--at) top var(--at) / var(--square) var(--square) no-repeat,
    linear-gradient(var(--neon), var(--neon)) left var(--at) bottom var(--at) / var(--square) var(--square) no-repeat,
    linear-gradient(var(--neon), var(--neon)) right var(--at) bottom var(--at) / var(--square) var(--square) no-repeat,
    linear-gradient(var(--grid) 1px, #0000 1px) 0 0 / var(--cell) var(--cell),
    linear-gradient(90deg, var(--grid) 1px, #0000 1px) 0 0 / var(--cell) var(--cell),
    var(--ground) !important;
  border-radius: 0 !important;
  outline: 1px solid var(--line);
  outline-offset: calc(0px - var(--in));
}`,
      },
      {
        id: 'cyber-slab',
        layerType: 'shape',
        name: 'Stepped slab',
        hint: 'A solid block of the main colour with a step cut into its top left corner, for the side or the foot of a screen.',
        css: `:scope {
  --neon: #ffffff; /* Main colour */
  --step: 24px; /* The step */
}

[data-shape="box"] {
  background: var(--neon) !important;
  border-radius: 0 !important;
  clip-path: polygon(var(--step) 0, 100% 0, 100% 100%, 0 100%, 0 var(--step));
}

[data-shape="rule"] {
  background: var(--neon) !important;
  border-radius: 0 !important;
}`,
      },
      {
        id: 'cyber-hazard',
        layerType: 'shape',
        name: 'Hazard hatch',
        hint: 'Fine diagonal hatching in the main colour, for the end of a bar or a strip that marks something.',
        css: `@property --hatch { syntax: "<length>"; inherits: true; initial-value: 0px; }
@keyframes cyberHatchGap { to { --hatch: var(--gap); } }

:scope {
  --neon: #ffffff; /* Main colour */
  --gap: 6px; /* Stripe spacing */
  --speed: 0.6s; /* Seconds per stripe | 0.1-4 */
}

[data-shape="box"] {
  animation: cyberHatchGap var(--speed) linear infinite;
  background: repeating-linear-gradient(-45deg, var(--neon) var(--hatch) calc(var(--hatch) + 2px), #0000 calc(var(--hatch) + 2px) calc(var(--hatch) + var(--gap))) !important;
  border-radius: 0 !important;
}

[data-shape="rule"] {
  animation: cyberHatchGap var(--speed) linear infinite;
  background: repeating-linear-gradient(-45deg, var(--neon) var(--hatch) calc(var(--hatch) + 2px), #0000 calc(var(--hatch) + 2px) calc(var(--hatch) + var(--gap))) !important;
  border-radius: 0 !important;
}`,
      },
      {
        id: 'cyber-chevron',
        layerType: 'shape',
        name: 'Corner chevron',
        hint: 'The double bracket from the reference\'s top right corner, hatched along its outer arm. Hollow: put it over the corner of a frame.',
        css: `@property --hatch { syntax: "<length>"; inherits: true; initial-value: 0px; }
@keyframes cyberHatch { to { --hatch: 6px; } }

:scope {
  --neon: #ffffff; /* Main colour */
  --arm: 60%; /* How far the bracket reaches */
  --thick: 4px; /* Bracket thickness */
  --speed: 0.6s; /* Seconds per stripe | 0.1-4 */
}

[data-shape="box"] {
  animation: cyberHatch var(--speed) linear infinite;
  background:
    repeating-linear-gradient(-45deg, var(--neon) var(--hatch) calc(var(--hatch) + 2px), #0000 calc(var(--hatch) + 2px) calc(var(--hatch) + 6px)) left top / calc(100% - var(--thick)) var(--thick) no-repeat,
    linear-gradient(var(--neon), var(--neon)) right top / var(--thick) 100% no-repeat,
    linear-gradient(var(--neon), var(--neon)) right calc(var(--thick) * 4) top calc(var(--thick) * 4) / var(--arm) var(--thick) no-repeat,
    linear-gradient(var(--neon), var(--neon)) right calc(var(--thick) * 4) top calc(var(--thick) * 4) / var(--thick) var(--arm) no-repeat !important;
  border: 0 !important;
  border-radius: 0 !important;
}`,
      },
      {
        id: 'cyber-players',
        layerType: 'players',
        name: 'Roster scan',
        hint: 'The players as a scan: a hairline box with a square on each corner, the title as a notched chip, each player a hairline cell with a square of their colour. Anyone out goes dark, the reason in pixel print.',
        css: `:scope {
  --neon: #ffffff; /* Main colour */
  --on-neon: #0a0a0b; /* Text on the main colour */
  --ground: #0a0a0b; /* The black it sits on */
  --line: #ffffff40; /* Hairlines */
  --square: 6px; /* Corner squares */
}

[data-players="list"] {
  background:
    linear-gradient(var(--neon), var(--neon)) left top / var(--square) var(--square) no-repeat,
    linear-gradient(var(--neon), var(--neon)) right top / var(--square) var(--square) no-repeat,
    linear-gradient(var(--neon), var(--neon)) left bottom / var(--square) var(--square) no-repeat,
    linear-gradient(var(--neon), var(--neon)) right bottom / var(--square) var(--square) no-repeat,
    var(--players-background, var(--ground)) !important;
  border-radius: 0 !important;
  box-shadow: inset 0 0 0 1px var(--line);
  color: var(--players-text, #ffffff) !important;
  font-family: 'Chakra Petch', sans-serif;
}

[data-players="title"] {
  align-self: flex-start;
  background: var(--neon);
  color: var(--on-neon);
  padding: .1em .6em .1em .8em;
  clip-path: polygon(.5em 0, 100% 0, 100% 100%, 0 100%, 0 .5em);
  letter-spacing: .12em !important;
}

[data-players="row"] { background: transparent !important; border-radius: 0 !important; box-shadow: inset 0 0 0 1px var(--line); }
[data-players="dot"] { border-radius: 0 !important; }
[data-players="name"] { text-transform: uppercase; letter-spacing: .03em; }
[data-players-state="out"], [data-players-state="ejected"], [data-players-state="dead"] { opacity: .45 !important; }
[data-players="state"] { font-family: 'VT323', monospace; color: var(--neon); letter-spacing: .12em !important; }`,
      },
      {
        id: 'cyber-poll',
        layerType: 'poll',
        name: 'Poll uplink',
        hint: 'The poll as an uplink: a hairline box with a square on each corner, the question in squared type, each answer a hairline cell that fills in the main colour, the numbers in pixel print. The winner is boxed in the main colour.',
        css: `:scope {
  --neon: #ffffff; /* Main colour */
  --ground: #0a0a0b; /* The black it sits on */
  --line: #ffffff40; /* Hairlines */
  --square: 6px; /* Corner squares */
}

[data-poll="card"] {
  background:
    linear-gradient(var(--neon), var(--neon)) left top / var(--square) var(--square) no-repeat,
    linear-gradient(var(--neon), var(--neon)) right top / var(--square) var(--square) no-repeat,
    linear-gradient(var(--neon), var(--neon)) left bottom / var(--square) var(--square) no-repeat,
    linear-gradient(var(--neon), var(--neon)) right bottom / var(--square) var(--square) no-repeat,
    var(--poll-background, var(--ground)) !important;
  border-radius: 0 !important;
  box-shadow: inset 0 0 0 1px var(--line);
  color: var(--poll-text, #ffffff) !important;
  font-family: 'Chakra Petch', sans-serif;
}

[data-poll="question"] { text-transform: uppercase; letter-spacing: .03em; }
[data-poll="option"] { background: transparent !important; border-radius: 0 !important; box-shadow: inset 0 0 0 1px var(--line); }
[data-poll="fill"] { background: var(--poll-bar, var(--neon)) !important; opacity: .22 !important; }
[data-poll="number"], [data-poll="percent"], [data-poll="votes"], [data-poll="timer"] { font-family: 'VT323', monospace; letter-spacing: .06em; }
[data-poll-winner="true"] { box-shadow: inset 0 0 0 2px var(--neon); }
[data-poll="timer"] { color: var(--neon); }`,
      },
      {
        id: 'cyber-voice',
        layerType: 'voice',
        name: 'Comms',
        hint: 'The Discord call as comms: square pictures in hairline boxes, the one talking boxed in the main colour, every name in pixel print.',
        css: `:scope {
  --neon: #ffffff; /* Main colour */
  --ground: #0a0a0b; /* The black it sits on */
  --line: #ffffff40; /* Hairlines */
}

[data-voice="avatar"], [data-voice="picture"] { border-radius: 0 !important; }
[data-voice="avatar"] { box-shadow: 0 0 0 1px var(--line) !important; }
[data-voice-speaking="true"] [data-voice="avatar"] { box-shadow: 0 0 0 max(2px, 3cqw) var(--voice-glow, var(--neon)) !important; }
[data-voice="name"] { font-family: 'VT323', monospace !important; letter-spacing: .1em; text-transform: uppercase; }
[data-voice-speaking="true"] [data-voice="name"] { color: var(--neon) !important; }
[data-voice="status"] { border-radius: 0 !important; background: var(--ground) !important; color: var(--neon) !important; border-color: var(--line) !important; }`,
      },
      {
        id: 'cyber-avatar',
        layerType: 'avatar',
        name: 'Operator',
        hint: 'The avatar in a hairline box with a square on each corner, its text as a notched chip. The box lights in the main colour while you talk.',
        previewConfig: { label: 'Online' },
        css: `:scope {
  --neon: #ffffff; /* Main colour */
  --on-neon: #0a0a0b; /* Text on the main colour */
  --ground: #0a0a0b; /* The black it sits on */
  --line: #ffffff40; /* Hairlines */
  --square: 6px; /* Corner squares */
  --avatar-size: min(90cqw, 90cqh);
}

[data-avatar="frame"] {
  position: relative;
  background:
    linear-gradient(var(--neon), var(--neon)) left top / var(--square) var(--square) no-repeat,
    linear-gradient(var(--neon), var(--neon)) right top / var(--square) var(--square) no-repeat,
    linear-gradient(var(--neon), var(--neon)) left bottom / var(--square) var(--square) no-repeat,
    linear-gradient(var(--neon), var(--neon)) right bottom / var(--square) var(--square) no-repeat,
    var(--ground);
  box-shadow: inset 0 0 0 1px var(--line);
  justify-content: flex-end !important;
}
[data-avatar-talking="true"] { box-shadow: inset 0 0 0 1px var(--neon); }

[data-avatar="label"] {
  position: absolute;
  left: 14px;
  top: 14px;
  margin: 0 !important;
  background: var(--neon);
  color: var(--on-neon) !important;
  padding: .1em .6em .1em .8em;
  clip-path: polygon(.5em 0, 100% 0, 100% 100%, 0 100%, 0 .5em);
  font-family: 'Chakra Petch', sans-serif;
  letter-spacing: .12em !important;
  font-size: min(5.5cqh, 8cqw) !important;
}`,
      },
      {
        id: 'cyber-pngtuber',
        layerType: 'pngtuber',
        name: 'Hologram',
        hint: 'Your pictures as a hologram: cut out with a hairline glow in the main colour that brightens while you talk.',
        css: `:scope {
  --neon: #ffffff; /* Main colour */
  --glow: 6px; /* The glow while quiet | 0-30 */
  --glow-talking: 14px; /* The glow while talking | 0-40 */
}

[data-pngtuber="picture"] {
  filter: drop-shadow(0 0 1px var(--neon)) drop-shadow(0 0 var(--glow) var(--neon));
  transition: filter 80ms linear;
}
[data-pngtuber-talking="true"] [data-pngtuber="picture"] {
  filter: drop-shadow(0 0 1px var(--neon)) drop-shadow(0 0 var(--glow-talking) var(--neon));
}`,
      },
      {
        id: 'cyber-hypetrain',
        layerType: 'hypetrain',
        name: 'Overload',
        hint: 'The Hype Train as an overload meter: a hairline box, the level as a notched chip, a solid bar in the main colour and the time in pixel print.',
        css: `:scope {
  --neon: #ffffff; /* Main colour */
  --on-neon: #0a0a0b; /* Text on the main colour */
  --ground: #0a0a0b; /* The black it sits on */
  --line: #ffffff40; /* Hairlines */
}

[data-hype="frame"] {
  background: var(--ground) !important;
  border-radius: 0 !important;
  box-shadow: inset 0 0 0 1px var(--line);
  font-family: 'Chakra Petch', sans-serif;
}
[data-hype="title"] { text-transform: uppercase; letter-spacing: .08em; }
[data-hype="level"] {
  background: var(--neon);
  color: var(--on-neon) !important;
  padding: .05em .6em .05em .8em;
  clip-path: polygon(.4em 0, 100% 0, 100% 100%, 0 100%, 0 .4em);
}
[data-hype="track"] { border-radius: 0 !important; background: transparent !important; box-shadow: inset 0 0 0 1px var(--line); }
[data-hype="fill"] { border-radius: 0 !important; background: var(--neon) !important; }
[data-hype="time"], [data-hype="top"] { font-family: 'VT323', monospace; letter-spacing: .06em; }`,
      },
      {
        id: 'cyber-shoutout',
        layerType: 'shoutout',
        name: 'Contact',
        hint: 'A shoutout as a contact card: a hairline box with a square on each corner, the picture square, the title as a notched chip, the name in squared capitals and the game in pixel print.',
        css: `:scope {
  --neon: #ffffff; /* Main colour */
  --on-neon: #0a0a0b; /* Text on the main colour */
  --ground: #0a0a0be6; /* The black it sits on */
  --line: #ffffff40; /* Hairlines */
  --square: 6px; /* Corner squares */
}

[data-shoutout="frame"] {
  background:
    linear-gradient(var(--neon), var(--neon)) left top / var(--square) var(--square) no-repeat,
    linear-gradient(var(--neon), var(--neon)) right top / var(--square) var(--square) no-repeat,
    linear-gradient(var(--neon), var(--neon)) left bottom / var(--square) var(--square) no-repeat,
    linear-gradient(var(--neon), var(--neon)) right bottom / var(--square) var(--square) no-repeat,
    var(--ground) !important;
  border-radius: 0 !important;
  box-shadow: inset 0 0 0 1px var(--line);
  font-family: 'Chakra Petch', sans-serif;
}
[data-shoutout="avatar"] { border-radius: 0 !important; box-shadow: 0 0 0 1px var(--line); }
[data-shoutout="title"] {
  align-self: flex-start;
  background: var(--neon);
  color: var(--on-neon);
  padding: 0 .6em 0 .8em;
  clip-path: polygon(.4em 0, 100% 0, 100% 100%, 0 100%, 0 .4em);
  opacity: 1 !important;
}
[data-shoutout="name"] { color: #ffffff !important; text-transform: uppercase; }
[data-shoutout="game"], [data-shoutout="link"], [data-shoutout="viewers"] { font-family: 'VT323', monospace; letter-spacing: .06em; }`,
      },
      {
        id: 'cyber-leaderboard',
        layerType: 'leaderboard',
        name: 'Ranking',
        hint: 'The leaderboard as a ranking readout: hairline rows, the places in pixel print, a solid bar in the main colour, and first place boxed in it.',
        css: `:scope {
  --neon: #ffffff; /* Main colour */
  --on-neon: #0a0a0b; /* Text on the main colour */
  --ground: #0a0a0b; /* The black it sits on */
  --line: #ffffff40; /* Hairlines */
}

[data-board="frame"] {
  background: var(--ground) !important;
  border-radius: 0 !important;
  box-shadow: inset 0 0 0 1px var(--line);
  font-family: 'Chakra Petch', sans-serif;
}
[data-board="title"] { color: var(--neon) !important; text-transform: uppercase; letter-spacing: .1em; }
[data-board="row"] { box-shadow: inset 0 0 0 1px var(--line); padding-right: .5em; }
[data-board="place"], [data-board="xp"] { font-family: 'VT323', monospace; }
[data-board="avatar"] { border-radius: 0 !important; }
[data-board="level"] { color: var(--neon) !important; font-family: 'VT323', monospace; }
[data-board="track"] { border-radius: 0 !important; background: #ffffff14 !important; }
[data-board="fill"] { border-radius: 0 !important; background: var(--neon) !important; }
[data-board-podium="first"] { box-shadow: inset 0 0 0 1px var(--neon); }
[data-board-podium="first"] [data-board="place"] { opacity: 1 !important; color: var(--neon); }`,
      },
      {
        id: 'cyber-giveaway',
        layerType: 'giveaway',
        name: 'Lottery',
        hint: 'A giveaway as a lottery terminal: a hairline box with a square on each corner, the title as a notched chip and the names running past in big pixel print.',
        css: `:scope {
  --neon: #ffffff; /* Main colour */
  --on-neon: #0a0a0b; /* Text on the main colour */
  --ground: #0a0a0be6; /* The black it sits on */
  --line: #ffffff40; /* Hairlines */
  --square: 6px; /* Corner squares */
}

[data-giveaway="frame"] {
  background:
    linear-gradient(var(--neon), var(--neon)) left top / var(--square) var(--square) no-repeat,
    linear-gradient(var(--neon), var(--neon)) right top / var(--square) var(--square) no-repeat,
    linear-gradient(var(--neon), var(--neon)) left bottom / var(--square) var(--square) no-repeat,
    linear-gradient(var(--neon), var(--neon)) right bottom / var(--square) var(--square) no-repeat,
    var(--ground) !important;
  border-radius: 0 !important;
  box-shadow: inset 0 0 0 1px var(--line);
  font-family: 'Chakra Petch', sans-serif;
}
[data-giveaway="title"] {
  background: var(--neon);
  color: var(--on-neon) !important;
  padding: .1em .6em .1em .8em;
  clip-path: polygon(.4em 0, 100% 0, 100% 100%, 0 100%, 0 .4em);
  letter-spacing: .12em;
}
[data-giveaway="prize"] { text-transform: uppercase; }
[data-giveaway="reel"] { font-family: 'VT323', monospace; color: var(--neon) !important; letter-spacing: .06em; }
[data-giveaway="avatar"] { border-radius: 0 !important; }
[data-giveaway="name"] { color: var(--neon) !important; text-transform: uppercase; }
[data-giveaway="count"], [data-giveaway="time"], [data-giveaway="platform"] { font-family: 'VT323', monospace; }`,
      },
    ],
  };

export default look;
