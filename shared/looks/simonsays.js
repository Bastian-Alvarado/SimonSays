/**
 * @license
 * SPDX-License-Identifier: Apache-2.0 AND LicenseRef-Commons-Clause-1.0
 *
 * The "SimonSays Default" theme: every look it has, for every kind of layer it dresses.
 * One of the themes in the Library (shared/looks/index.js lists them, in order).
 */

const look =
  {
    id: 'simonsays',
    name: 'SimonSays Default',
    hint: 'Flat black and one colour. The colour follows the layout accent, white when there is none, and any piece can be given its own.',
    /*
      Marathon's pieces with the spectrum taken out, so that the one colour
      left is a choice rather than an opinion.

      Every look declares that colour the same way:

        --color: var(--overlay-accent, #ffffff);

      which is three answers in order. A colour set in the layer's Custom
      fields wins, because it is written after the stylesheet; without one,
      the layout's accent; without that, white. Putting a field back is
      forgetting it, so a piece put back follows the layout again.

      The corner squares, the colour slab and the camera frame come from the
      reference layouts this was asked for with, where every screen picks its
      own colour and the black and the hairlines stay the same.
    */
    objects: [
      {
        id: 'simonsays-omnibar',
        layerType: 'omnibar',
        name: 'Label bar',
        hint: 'The label as a filled cell at the left, the rest on black under a coloured edge.',
        css: `:scope {
  --color: var(--overlay-accent, #ffffff); /* Colour */
  --on-color: #0a0a0b; /* Text on the colour */
  --ground: #0a0a0b; /* The black it sits on */
  --cell: #141416; /* The raised cell */
  --edge: 3px; /* Coloured edge */
}

[data-omnibar="bar"] {
  background: var(--omnibar-background, var(--ground)) !important;
  border-top: var(--edge) solid var(--omnibar-accent, var(--color));
  gap: 0 !important;
  padding: 0 !important;
}

[data-omnibar="slot"] {
  align-items: stretch !important;
  height: 100%;
  gap: 0 !important;
  flex: 1 1 auto;
}

[data-omnibar-state="pinned"] { flex: 0 0 auto; }

[data-omnibar="label"] {
  display: flex;
  align-items: center;
  padding: 0 20px;
  background: var(--omnibar-accent, var(--color));
  color: var(--on-color) !important;
  letter-spacing: .2em;
}

[data-omnibar="value"] {
  display: flex;
  align-items: center;
  padding: 0 24px;
  background: var(--cell);
  border-right: 1px solid rgba(255,255,255,.12);
  letter-spacing: .08em;
  flex: 1 1 auto;
}`,
      },
      {
        id: 'simonsays-tallbar',
        layerType: 'omnibar',
        name: 'Tall label bar',
        hint: 'For a tall omnibar: the label box filled with the colour, the card a raised cell, goal bars and chips in the colour, the total on black.',
        previewTall: true,
        previewSize: { width: 1100, height: 110 },
        css: `:scope {
  --color: var(--overlay-accent, #ffffff); /* Colour */
  --on-color: #0a0a0b; /* Text on the colour */
  --ground: #0a0a0b; /* The black it sits on */
  --cell: #141416; /* The raised cell */
  --edge: 3px; /* Coloured edge */
}

[data-tallbar="bar"] {
  background: var(--omnibar-background, var(--ground)) !important;
  border-top: var(--edge) solid var(--omnibar-accent, var(--color));
}

[data-tallbar="context"] {
  background: var(--omnibar-accent, var(--color));
  border-right: 0 !important;
}
[data-tallbar="label"] { color: var(--on-color) !important; letter-spacing: .16em; }
[data-tallbar="sub"] { color: var(--on-color) !important; opacity: .75; letter-spacing: .14em; }

[data-tallbar="card"] {
  background: var(--cell);
  border-right: 1px solid rgba(255,255,255,.12);
}

[data-tallbar="chip"] { border-color: rgba(255,255,255,.18) !important; border-radius: 0 !important; }
[data-tallbar="chip-value"] { background: var(--omnibar-accent, var(--color)) !important; color: var(--on-color) !important; }

[data-tallbar="goal-track"] {
  background: var(--ground) !important;
  border-color: rgba(255,255,255,.16) !important;
}
[data-tallbar="goal-fill"] { background: var(--omnibar-accent, var(--color)) !important; }
[data-tallbar="goal-marker"] {
  background: var(--omnibar-accent, var(--color)) !important;
  color: var(--on-color) !important;
  border: 0 !important;
}

[data-tallbar="pinned"] {
  background: var(--omnibar-background, var(--ground));
  border-left: 1px solid rgba(255,255,255,.12) !important;
}
[data-tallbar="pinned-figure"] { color: var(--omnibar-accent, var(--color)) !important; }
[data-tallbar="pinned-caption"] { color: #ffffff99 !important; letter-spacing: .16em; }`,
      },
      {
        id: 'simonsays-runcard',
        layerType: 'runcard',
        name: 'Game panel',
        hint: 'Black with a coloured edge top and bottom, the category as a filled chip.',
        css: `:scope {
  --color: var(--overlay-accent, #ffffff); /* Colour */
  --on-color: #0a0a0b; /* Text on the colour */
  --ground: #0a0a0b; /* The black it sits on */
  --edge: 3px; /* Coloured edge */
}

[data-runcard="card"] {
  background: var(--ground) !important;
  border-top: var(--edge) solid var(--runcard-accent, var(--color)) !important;
  border-bottom: var(--edge) solid var(--runcard-accent, var(--color)) !important;
  border-radius: 0 !important;
}

[data-runcard="title"] { color: var(--runcard-accent, var(--color)) !important; letter-spacing: .02em; }

[data-runcard="machine"] { opacity: .55 !important; letter-spacing: .18em; }

[data-runcard="details"] { margin-top: 6px !important; gap: 0 !important; }

[data-runcard="category"] {
  background: var(--runcard-accent, var(--color));
  color: var(--on-color) !important;
  padding: 2px 12px;
  letter-spacing: .18em;
}

[data-runcard="estimate"] {
  padding: 2px 12px;
  border: 1px solid rgba(255,255,255,.18);
  border-left: 0;
  letter-spacing: .14em;
}`,
      },
      {
        id: 'simonsays-nameplate',
        layerType: 'nameplate',
        name: 'Name tag',
        hint: 'Black with a coloured slab down the left, and the second line as a filled chip.',
        css: `:scope {
  --color: var(--overlay-accent, #ffffff); /* Colour */
  --on-color: #0a0a0b; /* Text on the colour */
  --ground: #0a0a0b; /* The black it sits on */
  --slab: 8px; /* The slab down the side */
}

[data-nameplate="plate"] {
  background: var(--nameplate-background, var(--ground)) !important;
  border-radius: 0 !important;
  border: 0 !important;
  border-left: var(--slab) solid var(--nameplate-accent, var(--color)) !important;
  box-shadow: inset 0 0 0 1px rgba(255,255,255,.1);
}

[data-nameplate="name"] { letter-spacing: .06em !important; }

[data-nameplate="subtitle"] {
  background: var(--nameplate-accent, var(--color));
  color: var(--on-color) !important;
  padding: 2px 10px;
  letter-spacing: .16em;
  align-self: flex-start;
}`,
      },
      {
        id: 'simonsays-roster',
        layerType: 'roster',
        name: 'Seat tags',
        hint: 'Each seat a black plate with the role as a filled tab and the pronouns as a chip. The host has a colour of its own; a free seat keeps its plate with the light off.',
        previewSize: { width: 620, height: 150 },
        css: `:scope {
  --color: var(--overlay-accent, #ffffff); /* Colour */
  --on-color: #0a0a0b; /* Text on the colour */
  --host: #ffffff; /* The host's tab */
  --ground: #0a0a0b; /* The black it sits on */
  --free: #26262a; /* A free seat */
}

[data-roster="seat"] {
  --tab: var(--color);
  background: var(--ground) !important;
  border-radius: 0 !important;
  border-top: 3px solid var(--tab);
  box-shadow: inset 0 0 0 1px rgba(255,255,255,.1);
  opacity: 1 !important;
}
[data-roster="seat"][data-roster-role="host"] { --tab: var(--host); }

[data-roster="tab"] { background: var(--tab) !important; }
[data-roster="role"] { color: var(--on-color) !important; }

[data-roster="name"] { letter-spacing: .06em; }
[data-roster="pronouns"] {
  background: var(--tab) !important;
  color: var(--on-color) !important;
  letter-spacing: .14em;
  padding: 1px 8px !important;
}

[data-roster="seat"][data-roster-empty="yes"] { --tab: var(--free); }
[data-roster="seat"][data-roster-empty="yes"] [data-roster="tab"] { display: none; }
[data-roster="seat"][data-roster-empty="yes"] [data-roster="name"] { color: #52525b !important; }`,
      },
      {
        id: 'simonsays-viewers',
        layerType: 'viewers',
        name: 'Viewer tag',
        hint: 'The mark in a filled cell, the count on black beside it.',
        css: `:scope {
  --color: var(--overlay-accent, #ffffff); /* Colour */
  --on-color: #0a0a0b; /* Text on the colour */
  --ground: #0a0a0b; /* The black it sits on */
}

[data-viewers="box"] {
  background: var(--viewers-background, var(--ground)) !important;
  border-radius: 0 !important;
  padding: 0 !important;
  gap: 0 !important;
  align-items: stretch !important;
  overflow: hidden;
  box-shadow: inset 0 0 0 1px rgba(255,255,255,.1);
}

[data-viewers="row"] {
  gap: 0 !important;
  align-items: stretch !important;
}

[data-viewers="icon"] {
  display: flex;
  align-items: center;
  padding: 0 .4em;
  background: var(--viewers-accent, var(--color));
  color: var(--on-color) !important;
}

[data-viewers="count"] {
  display: flex;
  align-items: center;
  padding: .25em .55em;
  letter-spacing: .08em;
}`,
      },
      {
        id: 'simonsays-alert',
        layerType: 'alert',
        applies: 'alert',
        name: 'Slab alert',
        hint: 'A black panel with a slab of the colour down its left, the name in the colour and the message beside it. Built in two pieces so a motion can assemble it.',
        css: `:scope {
  --color: var(--overlay-accent, #ffffff); /* Colour */
  --ground: #0a0a0b; /* The black it sits on */
  --ink: #ffffff; /* The words */
  --slab: 12px; /* The slab down the side */
}

:scope {
  position: relative;
  z-index: 0;
  background: transparent;
  padding: 20px 30px 18px calc(var(--slab) + 26px);
}

/* The slab. */
:scope::before {
  content: '';
  position: absolute;
  left: 0; top: 0; bottom: 0;
  width: var(--slab);
  background: var(--color);
  transform-origin: center top;
  z-index: -1;
}

/* The panel beside it, with a hairline held inside its edge. */
:scope::after {
  content: '';
  position: absolute;
  left: var(--slab); right: 0; top: 0; bottom: 0;
  background: var(--ground);
  outline: 1px solid rgba(255,255,255,.14);
  outline-offset: -8px;
  box-shadow: 0 20px 44px rgba(0,0,0,.6);
  transform-origin: left center;
  z-index: -1;
}

[data-alert="body"] { gap: 16px; }

[data-alert="media"] { border-radius: 0; }

[data-alert="caption"] {
  letter-spacing: .04em;
  text-shadow: none !important;
}

[data-alert="name"] {
  display: inline-block;
  color: var(--alert-name, var(--color)) !important;
}

[data-alert="message"] {
  display: inline-block;
  color: var(--alert-text, var(--ink)) !important;
}`,
      },
      {
        id: 'simonsays-countdown',
        layerType: 'countdown',
        name: 'Big countdown',
        hint: 'The label as a filled chip over the digits, on black under a coloured edge.',
        css: `:scope {
  --color: var(--overlay-accent, #ffffff); /* Colour */
  --on-color: #0a0a0b; /* Text on the colour */
  --ground: #0a0a0b; /* The black it sits on */
  --ink: #ffffff; /* The digits */
}

:scope {
  background: var(--ground);
  border-top: 3px solid var(--color);
}

[data-countdown="clock"] {
  background: transparent !important;
  gap: 0 !important;
}

[data-countdown="label"] {
  background: var(--countdown-label, var(--color));
  color: var(--on-color) !important;
  padding: .12em .5em .12em .8em;
  margin-bottom: .3em;
}

[data-countdown="digits"] {
  color: var(--countdown-text, var(--ink)) !important;
  letter-spacing: .02em;
}

[data-countdown="paused"] {
  background: var(--countdown-label, var(--color));
  color: var(--on-color) !important;
  padding: .1em .4em .1em .6em;
  margin-top: .35em;
}`,
      },
      {
        id: 'simonsays-stopwatch',
        layerType: 'stopwatch',
        name: 'Split clock',
        hint: 'The run timer on the same black as the countdown: white while it runs, grey when paused, the colour when the run is done.',
        css: `:scope {
  --color: var(--overlay-accent, #ffffff); /* Colour */
  --ground: #0a0a0b; /* The black it sits on */
  --ink: #ffffff; /* Running digits */
  --held: #71717a; /* Paused digits */
}

:scope {
  background: var(--ground);
  border-top: 3px solid var(--color);
}

[data-stopwatch="clock"] { background: transparent !important; }

[data-stopwatch="digits"] {
  color: var(--stopwatch-colour, var(--ink)) !important;
  letter-spacing: .02em;
}

[data-stopwatch-mode="idle"] [data-stopwatch="digits"] { opacity: .5; }
[data-stopwatch-mode="paused"] [data-stopwatch="digits"] { color: var(--stopwatch-colour, var(--held)) !important; }
[data-stopwatch-mode="finished"] [data-stopwatch="digits"] { color: var(--stopwatch-colour, var(--color)) !important; }`,
      },
      {
        id: 'simonsays-chat',
        layerType: 'chat',
        applies: 'chat',
        name: 'Edge chat',
        hint: 'Flat rows with a coloured edge and the name in the colour. Applying it turns the chat theme to Custom.',
        css: `:scope {
  --color: var(--overlay-accent, #ffffff); /* Colour */
  --on-color: #0a0a0b; /* Text on the colour */
  --ground: #0a0a0bcc; /* The black it sits on */
  --ink: #ffffff; /* The words */
}

[data-chat="row"] {
  background: var(--chat-row-bg, var(--ground)) !important;
  border-radius: var(--chat-row-radius, 0) !important;
  border-left: 3px solid var(--color) !important;
  padding: var(--chat-row-padding, 7px 12px) !important;
  gap: 8px !important;
}

[data-chat="user"] {
  color: var(--color) !important;
  letter-spacing: .04em !important;
}

[data-chat="text"] { color: var(--chat-text, var(--ink)) !important; }

[data-chat="time"] { color: rgba(255,255,255,.3) !important; }

[data-chat="avatar"] { border-radius: 0 !important; }

/* The broadcaster's name is filled rather than coloured. */
[data-chat-rank="broadcaster"] [data-chat="user"] {
  background: var(--color);
  color: var(--on-color) !important;
  padding: 0 .35em;
}

[data-chat="highlight"] {
  border: 0 !important;
  border-radius: 0 !important;
  background: transparent !important;
}`,
      },
      {
        id: 'simonsays-images',
        layerType: 'images',
        name: 'Framed picture',
        hint: 'A black panel with a hairline held inside its edge and the colour along the top, holding the picture off the edges.',
        css: `:scope {
  --color: var(--overlay-accent, #ffffff); /* Colour */
  --ground: #0a0a0b; /* The black it sits on */
  --inset: 16px; /* Room around the picture */
}

[data-images="frame"] {
  background: var(--ground);
  border-top: 3px solid var(--color);
  outline: 1px solid rgba(255,255,255,.12);
  outline-offset: -8px;
}

[data-images="picture"] {
  inset: var(--inset) !important;
  width: calc(100% - 2 * var(--inset)) !important;
  height: calc(100% - 2 * var(--inset)) !important;
}`,
      },
      {
        id: 'simonsays-title',
        layerType: 'text',
        name: 'Screen title',
        hint: 'Heavy capitals in the colour, set tight, for the big words on a starting, ending or break screen.',
        css: `:scope {
  --color: var(--overlay-accent, #ffffff); /* Colour */
}

[data-text="words"] {
  color: var(--color);
  text-transform: uppercase;
  font-weight: 900 !important;
  line-height: .9 !important;
  letter-spacing: .01em !important;
}`,
      },
      {
        id: 'simonsays-chip',
        layerType: 'text',
        name: 'Filled chip',
        hint: 'The words in a small filled box, for a screen number, a section name or a hashtag.',
        css: `:scope {
  --color: var(--overlay-accent, #ffffff); /* Colour */
  --on-color: #0a0a0b; /* Text on the colour */
}

/* The chip hugs the words, so the alignment controls say where it sits. */
[data-text="words"] {
  width: auto !important;
  background: var(--color);
  color: var(--on-color);
  text-transform: uppercase;
  letter-spacing: .14em !important;
  padding: .1em .45em .1em .6em;
}`,
      },
      {
        id: 'simonsays-goal',
        layerType: 'goal',
        name: 'Fund bar',
        hint: 'The percent large in the colour, the label small above it, and a thin bar underneath.',
        css: `:scope {
  --color: var(--overlay-accent, #ffffff); /* Colour */
  --ground: #0a0a0b; /* The black it sits on */
  --ink: #ffffff; /* The words */
}

[data-goal="track"] {
  background: var(--goal-track, var(--ground)) !important;
  border-radius: 0 !important;
  box-shadow: inset 0 0 0 1px rgba(255,255,255,.14);
}

[data-goal="fill"] {
  background: var(--goal-bar, var(--color)) !important;
  border-radius: 0 !important;
}

[data-goal="label"] {
  color: var(--goal-text, var(--ink)) !important;
  opacity: .6;
  letter-spacing: .2em !important;
}

[data-goal="numbers"] { color: var(--goal-text, var(--ink)) !important; }

[data-goal="target"] { opacity: .45 !important; }

[data-goal="percent"] {
  color: var(--goal-bar, var(--color)) !important;
  opacity: 1 !important;
  font-weight: 900;
  font-size: 1.6em;
  line-height: 1;
}`,
      },
      {
        id: 'simonsays-spotify',
        layerType: 'spotify',
        name: 'Track panel',
        hint: 'Black with a coloured edge, the label as a filled chip and the progress in the colour.',
        css: `:scope {
  --color: var(--overlay-accent, #ffffff); /* Colour */
  --on-color: #0a0a0b; /* Text on the colour */
  --ground: #0a0a0bdd; /* The black it sits on */
  --ink: #ffffff; /* The words */
  --cell: #1a1a1d; /* The progress, still to go */
}

[data-spotify="player"] {
  background: var(--ground);
  padding: 12px 14px;
  border-top: 3px solid var(--color);
}

[data-spotify="label"] {
  background: var(--color);
  color: var(--on-color);
  padding: 0 .5em 0 .7em;
  justify-self: start;
  opacity: 1;
}

[data-spotify="art"] { border-radius: 0; }

[data-spotify="title"] { color: var(--ink); }

[data-spotify="progress"] { background: var(--cell); border-radius: 0; }

[data-spotify="fill"] { background: var(--color); border-radius: 0; }`,
      },
      {
        id: 'simonsays-plan',
        layerType: 'plan',
        name: 'Run of show',
        hint: 'The heading as a filled chip, the line you are on marked in the colour and the ones behind you faded. No ground of its own: lay it on a Black panel.',
        css: `:scope {
  --color: var(--overlay-accent, #ffffff); /* Colour */
  --on-color: #0a0a0b; /* Text on the colour */
  --ink: #ffffff; /* The words */
}

[data-plan="list"] {
  background: transparent !important;
  border-radius: 0 !important;
}

[data-plan="title"] {
  background: var(--color);
  color: var(--on-color) !important;
  align-self: flex-start;
  padding: .12em .5em .12em .7em;
  letter-spacing: .2em !important;
  margin-bottom: .3em;
}

[data-plan="mark"] { border-radius: 0 !important; }

[data-plan-state="now"] [data-plan="mark"] {
  background: var(--color) !important;
  width: .3em !important;
}

[data-plan-state="now"] [data-plan="text"] {
  color: var(--ink) !important;
  opacity: 1 !important;
}

[data-plan-state="done"] [data-plan="text"] { opacity: .32 !important; }

[data-plan="note"] { opacity: .55; }`,
      },
      {
        id: 'simonsays-question',
        layerType: 'question',
        name: 'Question panel',
        hint: 'A black card with the colour down its edge and the label as a filled chip. Brings its own ground, since it appears over the game.',
        css: `:scope {
  --color: var(--overlay-accent, #ffffff); /* Colour */
  --on-color: #0a0a0b; /* Text on the colour */
  --ground: #0a0a0be6; /* The black it sits on */
  --ink: #ffffff; /* The words */
}

[data-question="card"] {
  background: var(--ground) !important;
  border-radius: 0 !important;
  border-left: 5px solid var(--color) !important;
}

[data-question="label"] {
  background: var(--color);
  color: var(--on-color) !important;
  padding: .12em .45em .12em .65em;
  letter-spacing: .2em !important;
}

[data-question="asker"] {
  color: var(--ink) !important;
  opacity: .5 !important;
}

[data-question="text"] { color: var(--ink) !important; }`,
      },
      {
        id: 'simonsays-panel',
        layerType: 'shape',
        name: 'Black panel',
        hint: 'The ground a screen is built on: black, a hairline held inside its edge, and a small square in each corner.',
        /*
          The squares are four gradients rather than four elements, and each
          says its size, position and repeat with !important, because the
          shape writes background inline and that shorthand resets all three.
        */
        css: `:scope {
  --ground: #0a0a0b; /* The black it sits on */
  --mark: #ffffff; /* The corner squares */
  --line: #ffffff24; /* The hairline */
  --in: 14px; /* How far in the hairline sits */
  --square: 7px; /* Corner square */
}

[data-shape="box"] {
  --at: calc(var(--in) - var(--square) / 2);
  background:
    linear-gradient(var(--mark), var(--mark)) left var(--at) top var(--at) / var(--square) var(--square) no-repeat,
    linear-gradient(var(--mark), var(--mark)) right var(--at) top var(--at) / var(--square) var(--square) no-repeat,
    linear-gradient(var(--mark), var(--mark)) left var(--at) bottom var(--at) / var(--square) var(--square) no-repeat,
    linear-gradient(var(--mark), var(--mark)) right var(--at) bottom var(--at) / var(--square) var(--square) no-repeat,
    var(--ground) !important;
  border-radius: 0 !important;
  outline: 1px solid var(--line);
  outline-offset: calc(0px - var(--in));
}`,
      },
      {
        id: 'simonsays-slab',
        layerType: 'shape',
        name: 'Colour slab',
        hint: 'A solid block of the colour with a dark hairline held inside it, for the side or the foot of a screen.',
        css: `:scope {
  --color: var(--overlay-accent, #ffffff); /* Colour */
  --line: #0a0a0b40; /* The hairline */
  --in: 14px; /* How far in the hairline sits */
}

[data-shape="box"] {
  background: var(--color) !important;
  border-radius: 0 !important;
  outline: 1px solid var(--line);
  outline-offset: calc(0px - var(--in));
}

[data-shape="rule"] {
  background: var(--color) !important;
  border-radius: 0 !important;
}`,
      },
      {
        id: 'simonsays-camera',
        layerType: 'shape',
        name: 'Camera frame',
        hint: 'Hollow, for a webcam: the colour down the left and heavier along the foot, and a bracket at the top left. Put it above the camera.',
        css: `:scope {
  --color: var(--overlay-accent, #ffffff); /* Colour */
  --side: 5px; /* Down the left */
  --foot: 10px; /* Along the foot */
  --arm: 34px; /* Bracket length */
}

[data-shape="box"] {
  background:
    linear-gradient(var(--color), var(--color)) left 10px top 10px / var(--arm) 2px no-repeat,
    linear-gradient(var(--color), var(--color)) left 10px top 10px / 2px var(--arm) no-repeat !important;
  border-radius: 0 !important;
  border-style: solid !important;
  border-color: var(--color) !important;
  border-width: 0 0 var(--foot) var(--side) !important;
  box-shadow: inset 0 0 0 1px #ffffff1a;
}`,
      },
      {
        id: 'simonsays-corners',
        layerType: 'shape',
        name: 'Colour corners',
        hint: 'Marks the corners in the colour without boxing anything in.',
        css: `:scope {
  --color: var(--overlay-accent, #ffffff); /* Colour */
  --arm: 36px; /* Bracket length */
  --thick: 3px; /* Bracket thickness */
}

[data-shape="box"] {
  background: transparent !important;
  border: 0 !important;
  border-radius: 0 !important;
  background-image:
    linear-gradient(var(--color), var(--color)), linear-gradient(var(--color), var(--color)),
    linear-gradient(var(--color), var(--color)), linear-gradient(var(--color), var(--color)),
    linear-gradient(var(--color), var(--color)), linear-gradient(var(--color), var(--color)),
    linear-gradient(var(--color), var(--color)), linear-gradient(var(--color), var(--color)) !important;
  background-size: var(--arm) var(--thick), var(--thick) var(--arm), var(--arm) var(--thick), var(--thick) var(--arm),
    var(--arm) var(--thick), var(--thick) var(--arm), var(--arm) var(--thick), var(--thick) var(--arm) !important;
  background-position:
    left top, left top, right top, right top,
    left bottom, left bottom, right bottom, right bottom !important;
  background-repeat: no-repeat !important;
}`,
      },
      /*
        The pixel avatar, four ways. Each stands it on the foot of its box,
        so the body runs off the edge like a bust rather than floating, and
        each keeps the pixels square: nothing here scales the drawing except
        the box it is in.
      */
      {
        id: 'simonsays-avatar',
        layerType: 'avatar',
        name: 'Avatar on black',
        hint: 'The avatar on the black panel, standing on its foot, the hairline lit in the colour while it talks. Its text is a filled chip.',
        previewConfig: { label: 'Back soon' },
        css: `:scope {
  --color: var(--overlay-accent, #ffffff); /* Colour */
  --on-color: #0a0a0b; /* Text on the colour */
  --ground: #0a0a0b; /* The black it sits on */
  --line: #ffffff24; /* The hairline */
  --in: 12px; /* How far in the hairline sits */
  --square: 7px; /* Corner square */
  --avatar-size: min(100cqw, 100cqh);
}

[data-avatar="frame"] {
  --at: calc(var(--in) - var(--square) / 2);
  position: relative;
  background:
    linear-gradient(var(--color), var(--color)) left var(--at) top var(--at) / var(--square) var(--square) no-repeat,
    linear-gradient(var(--color), var(--color)) right var(--at) top var(--at) / var(--square) var(--square) no-repeat,
    linear-gradient(var(--color), var(--color)) left var(--at) bottom var(--at) / var(--square) var(--square) no-repeat,
    linear-gradient(var(--color), var(--color)) right var(--at) bottom var(--at) / var(--square) var(--square) no-repeat,
    var(--ground);
  outline: 1px solid var(--line);
  outline-offset: calc(0px - var(--in));
  padding: calc(var(--in) * 2) calc(var(--in) * 2) 0;
  justify-content: flex-end !important;
  transition: outline-color 120ms linear;
}

/* Talking: the hairline takes the colour. */
[data-avatar-talking="true"] { outline-color: var(--color); }

[data-avatar="label"] {
  position: absolute;
  left: calc(var(--in) + 8px);
  top: calc(var(--in) + 8px);
  max-width: calc(100% - var(--in) * 2 - 16px);
  background: var(--color);
  color: var(--on-color) !important;
  padding: .2em .6em .2em .75em;
  letter-spacing: .16em !important;
  margin: 0 !important;
  font-size: min(5.5cqh, 8cqw) !important;
}`,
      },
      {
        id: 'simonsays-avatar-slab',
        layerType: 'avatar',
        name: 'Avatar on colour',
        hint: 'The avatar on a solid block of the colour, cut out with a black edge so an avatar dressed in the same colour still stands apart. Its text is a black chip at the top.',
        previewConfig: { label: 'Live' },
        css: `:scope {
  --color: var(--overlay-accent, #ffffff); /* Colour */
  --ground: #0a0a0b; /* The chip and the edge */
  --line: #0a0a0b40; /* The hairline */
  --in: 12px; /* How far in the hairline sits */
  --thick: 1cqh; /* Edge thickness, 1 is a pixel of the drawing | 0-4 */
  --avatar-size: min(100cqw, 100cqh);
}

/* Cut out in black: in the layout colour, an avatar dressed in it is the colour of the block. */
[data-avatar="svg"] {
  filter:
    drop-shadow(var(--thick) 0 0 var(--ground)) drop-shadow(calc(0px - var(--thick)) 0 0 var(--ground))
    drop-shadow(0 var(--thick) 0 var(--ground)) drop-shadow(0 calc(0px - var(--thick)) 0 var(--ground));
}

[data-avatar="frame"] {
  position: relative;
  background: var(--color);
  outline: 1px solid var(--line);
  outline-offset: calc(0px - var(--in));
  padding: calc(var(--in) * 2) calc(var(--in) * 2) 0;
  justify-content: flex-end !important;
}

[data-avatar="label"] {
  position: absolute;
  left: calc(var(--in) + 8px);
  top: calc(var(--in) + 8px);
  max-width: calc(100% - var(--in) * 2 - 16px);
  background: var(--ground);
  color: #ffffff !important;
  padding: .2em .6em .2em .75em;
  letter-spacing: .16em !important;
  margin: 0 !important;
  font-size: min(5.5cqh, 8cqw) !important;
}`,
      },
      {
        id: 'simonsays-avatar-cam',
        layerType: 'avatar',
        name: 'Camera stand-in',
        hint: 'For where the camera goes when it is off: black with a faint grid, the colour down the left and along the foot, and a blinking square beside its text. Make the layer the size of the camera.',
        previewSize: { width: 400, height: 225 },
        previewConfig: { label: 'Cam off' },
        css: `:scope {
  --color: var(--overlay-accent, #ffffff); /* Colour */
  --ground: #0a0a0b; /* The black it sits on */
  --grid: #ffffff0d; /* The grid */
  --side: 5px; /* Down the left */
  --foot: 10px; /* Along the foot */
  --avatar-size: min(100cqw, 100cqh);
}

[data-avatar="frame"] {
  position: relative;
  background:
    linear-gradient(90deg, var(--grid) 1px, transparent 1px) 0 0 / 24px 24px,
    linear-gradient(var(--grid) 1px, transparent 1px) 0 0 / 24px 24px,
    var(--ground);
  border-style: solid;
  border-color: var(--color);
  border-width: 0 0 var(--foot) var(--side);
  box-shadow: inset 0 0 0 1px #ffffff1a;
  padding-top: 8%;
  justify-content: flex-end !important;
}

[data-avatar="label"] {
  position: absolute;
  top: 14px;
  right: 16px;
  display: flex;
  align-items: center;
  gap: .5em;
  color: #ffffff !important;
  letter-spacing: .2em !important;
  margin: 0 !important;
  font-size: min(6cqh, 4cqw) !important;
}

[data-avatar="label"]::before {
  content: '';
  width: .7em;
  height: .7em;
  background: var(--color);
  animation: simonsaysAvatarRec 1.2s steps(1) infinite;
}

@keyframes simonsaysAvatarRec { 50% { opacity: 0; } }`,
      },
      {
        id: 'simonsays-pngtuber',
        layerType: 'pngtuber',
        name: 'PNGtuber sticker',
        hint: 'Your pictures cut out with a black edge and a hard shadow in the colour, the shadow jumping out further while you talk.',
        css: `:scope {
  --color: var(--overlay-accent, #ffffff); /* Colour */
  --edge: #0a0a0b; /* The cut-out edge */
  --thick: 4px; /* Edge thickness */
  --drop: 8px; /* How far the shadow falls */
  --drop-talking: 14px; /* How far it falls while talking */
}

[data-pngtuber="picture"] {
  filter:
    drop-shadow(var(--thick) 0 0 var(--edge)) drop-shadow(calc(0px - var(--thick)) 0 0 var(--edge))
    drop-shadow(0 var(--thick) 0 var(--edge)) drop-shadow(0 calc(0px - var(--thick)) 0 var(--edge))
    drop-shadow(var(--drop) var(--drop) 0 var(--color));
}

[data-pngtuber-talking="true"] [data-pngtuber="picture"] {
  filter:
    drop-shadow(var(--thick) 0 0 var(--edge)) drop-shadow(calc(0px - var(--thick)) 0 0 var(--edge))
    drop-shadow(0 var(--thick) 0 var(--edge)) drop-shadow(0 calc(0px - var(--thick)) 0 var(--edge))
    drop-shadow(var(--drop-talking) var(--drop-talking) 0 var(--color));
}`,
      },
      {
        id: 'simonsays-avatar-sticker',
        layerType: 'avatar',
        name: 'Avatar sticker',
        hint: 'No box: the avatar cut out with a black edge and a hard shadow in the colour, for a starting screen or a corner of the game. Its text is underlined in the colour.',
        previewConfig: { label: 'Starting soon' },
        css: `:scope {
  --color: var(--overlay-accent, #ffffff); /* Colour */
  --edge: #0a0a0b; /* The cut-out edge */
  --thick: 1cqh; /* Edge thickness, 1 is a pixel of the drawing | 0-4 */
  --drop: 2cqh; /* How far the shadow falls | 0-8 */
}

[data-avatar="svg"] {
  filter:
    drop-shadow(var(--thick) 0 0 var(--edge)) drop-shadow(calc(0px - var(--thick)) 0 0 var(--edge))
    drop-shadow(0 var(--thick) 0 var(--edge)) drop-shadow(0 calc(0px - var(--thick)) 0 var(--edge))
    drop-shadow(var(--drop) var(--drop) 0 var(--color));
}

[data-avatar="label"] {
  color: #ffffff !important;
  letter-spacing: .18em !important;
  padding-bottom: .2em;
  border-bottom: .22em solid var(--color);
  text-shadow: 0 2px 0 var(--edge);
}`,
      },
      {
        id: 'simonsays-hypetrain',
        layerType: 'hypetrain',
        name: 'Hype Train bar',
        hint: 'Black with a hairline, the level as a chip in the colour and a square bar that fills in it. A level up flashes the chip.',
        css: `:scope {
  --color: var(--overlay-accent, #ffffff); /* Colour */
  --on-color: #0a0a0b; /* Text on the colour */
  --ground: #0a0a0b; /* The black it sits on */
  --line: #ffffff24; /* The hairline */
}

[data-hype="frame"] {
  background: var(--ground) !important;
  border-radius: 0 !important;
  box-shadow: inset 0 0 0 1px var(--line);
}

[data-hype="title"] { color: #ffffff; letter-spacing: .24em; }

[data-hype="level"] {
  background: var(--color);
  color: var(--on-color) !important;
  padding: .1em .45em;
}

[data-hype="track"] {
  border-radius: 0 !important;
  background: #ffffff14 !important;
}

[data-hype="fill"] {
  border-radius: 0 !important;
  background: var(--color) !important;
}

[data-hype="time"] { opacity: .55 !important; }

[data-hype-levelup="true"] [data-hype="level"] { animation: simonsaysHypeLevel 500ms steps(2) 5; }

@keyframes simonsaysHypeLevel { 50% { background: #ffffff; } }`,
      },
      {
        id: 'simonsays-shoutout',
        layerType: 'shoutout',
        name: 'Shoutout plate',
        hint: 'Black with a hairline, a square picture edged in the colour, the name large and the rest small.',
        css: `:scope {
  --color: var(--overlay-accent, #ffffff); /* Colour */
  --ground: #0a0a0b; /* The black it sits on */
  --line: #ffffff24; /* The hairline */
}

[data-shoutout="frame"] {
  background: var(--ground) !important;
  border-radius: 0 !important;
  box-shadow: inset 0 0 0 1px var(--line);
}

[data-shoutout="avatar"] {
  border-radius: 0 !important;
  box-shadow: 0 0 0 3px var(--color);
}

[data-shoutout="title"] { letter-spacing: .24em !important; }

[data-shoutout="name"] { color: #ffffff !important; }

[data-shoutout="game"] { color: var(--color); }

[data-shoutout="viewers"] {
  color: var(--color);
  border: 2px solid var(--color);
  padding: .1em .4em;
}`,
      },
      {
        id: 'simonsays-leaderboard',
        layerType: 'leaderboard',
        name: 'Leaderboard',
        hint: 'Black with a hairline, square pictures, the level as a chip in the colour and a thin square bar. The first place is edged in the colour.',
        css: `:scope {
  --color: var(--overlay-accent, #ffffff); /* Colour */
  --on-color: #0a0a0b; /* Text on the colour */
  --ground: #0a0a0b; /* The black it sits on */
  --line: #ffffff24; /* The hairline */
}

[data-board="frame"] {
  background: var(--ground) !important;
  border-radius: 0 !important;
  box-shadow: inset 0 0 0 1px var(--line);
}

[data-board="title"] { color: #ffffff !important; letter-spacing: .24em; }

[data-board="avatar"] { border-radius: 0 !important; }

[data-board="level"] {
  background: var(--color);
  color: var(--on-color) !important;
  padding: .1em .45em;
}

[data-board="track"] {
  border-radius: 0 !important;
  background: #ffffff14 !important;
}

[data-board="fill"] {
  border-radius: 0 !important;
  background: var(--color) !important;
}

[data-board-podium="first"] [data-board="avatar"] { box-shadow: 0 0 0 3px var(--color); }

[data-board-podium="first"] [data-board="place"] { color: var(--color); opacity: 1 !important; }`,
      },
      {
        id: 'simonsays-giveaway',
        layerType: 'giveaway',
        name: 'Giveaway card',
        hint: 'Black with a hairline, the title as a chip in the colour and the winner large in the colour.',
        css: `:scope {
  --color: var(--overlay-accent, #ffffff); /* Colour */
  --on-color: #0a0a0b; /* Text on the colour */
  --ground: #0a0a0b; /* The black it sits on */
  --line: #ffffff24; /* The hairline */
}

[data-giveaway="frame"] {
  background: var(--ground) !important;
  border-radius: 0 !important;
  box-shadow: inset 0 0 0 1px var(--line);
}

[data-giveaway="title"] {
  background: var(--color);
  color: var(--on-color) !important;
  padding: .15em .5em;
  letter-spacing: .24em;
}

[data-giveaway="prize"] { color: #ffffff; }

[data-giveaway="avatar"] {
  border-radius: 0 !important;
  box-shadow: 0 0 0 3px var(--color);
}

[data-giveaway-state="drawn"] [data-giveaway="name"] { animation: simonsaysGiveawayWin 600ms steps(2) 4; }

@keyframes simonsaysGiveawayWin { 50% { color: #ffffff; } }`,
      },
      {
        id: 'simonsays-players',
        layerType: 'players',
        name: 'Players on black',
        hint: 'The players list on the black panel: the title as a chip in the colour, each player a dark cell with a square of their own colour, and anyone out dimmed with the reason in the colour.',
        css: `:scope {
  --color: var(--overlay-accent, #ffffff); /* Colour */
  --on-color: #0a0a0b; /* Text on the colour */
  --ground: #0a0a0b; /* The black it sits on */
  --cell: #ffffff0d; /* Each player */
  --line: #ffffff24; /* The hairline */
}

[data-players="list"] {
  background: var(--players-background, var(--ground)) !important;
  border-radius: 0 !important;
  box-shadow: inset 0 0 0 1px var(--line);
  color: var(--players-text, #ffffff) !important;
}

[data-players="title"] {
  align-self: flex-start;
  background: var(--color);
  color: var(--on-color);
  padding: .15em .6em .15em .8em;
  letter-spacing: .24em !important;
}

[data-players="row"] { background: var(--cell) !important; border-radius: 0 !important; }
[data-players="dot"] { border-radius: 0 !important; }
[data-players="name"] { letter-spacing: .04em; }

[data-players-state="out"], [data-players-state="ejected"], [data-players-state="dead"] { opacity: .5 !important; }
[data-players="state"] { color: var(--color); letter-spacing: .2em !important; }`,
      },
      {
        id: 'simonsays-poll',
        layerType: 'poll',
        name: 'Poll on black',
        hint: 'The poll on the black panel: the question in white, each answer a dark cell that fills in the colour, its number as a chip, and the winner edged in the colour when it closes.',
        css: `:scope {
  --color: var(--overlay-accent, #ffffff); /* Colour */
  --on-color: #0a0a0b; /* Text on the colour */
  --ground: #0a0a0b; /* The black it sits on */
  --cell: #ffffff0d; /* Each answer */
  --line: #ffffff24; /* The hairline */
}

[data-poll="card"] {
  background: var(--poll-background, var(--ground)) !important;
  border-radius: 0 !important;
  box-shadow: inset 0 0 0 1px var(--line);
  color: var(--poll-text, #ffffff) !important;
}

[data-poll="question"] { letter-spacing: .02em; }
[data-poll="option"] { background: var(--cell) !important; border-radius: 0 !important; }
[data-poll="fill"] { background: var(--poll-bar, var(--color)) !important; opacity: .3 !important; }

[data-poll="number"] {
  display: grid;
  place-items: center;
  min-width: 1.3em;
  background: var(--color);
  color: var(--on-color);
  opacity: 1 !important;
}

[data-poll-winner="true"] { box-shadow: inset 0 0 0 2px var(--color); }
[data-poll="footer"] { letter-spacing: .14em; text-transform: uppercase; }
[data-poll="timer"] { color: var(--color); }`,
      },
      {
        id: 'simonsays-voice',
        layerType: 'voice',
        name: 'Call on black',
        hint: 'The Discord call as square pictures with a hairline, the one talking edged in the colour, and each name as a black chip under its picture.',
        css: `:scope {
  --color: var(--overlay-accent, #ffffff); /* Colour */
  --ground: #0a0a0b; /* The chips */
  --line: #ffffff24; /* The hairline */
}

[data-voice="avatar"], [data-voice="picture"] { border-radius: 0 !important; }
[data-voice="avatar"] { box-shadow: 0 0 0 1px var(--line) !important; }
[data-voice-speaking="true"] [data-voice="avatar"] { box-shadow: 0 0 0 max(2px, 4cqw) var(--voice-glow, var(--color)) !important; }

[data-voice="name"] {
  background: var(--ground);
  padding: .1em .5em !important;
  letter-spacing: .12em;
  text-transform: uppercase;
}
[data-voice-speaking="true"] [data-voice="name"] { box-shadow: inset 0 -2px 0 var(--color); }

[data-voice="status"] { border-radius: 0 !important; background: var(--ground) !important; color: var(--color) !important; }`,
      },
    ],
  };

export default look;
