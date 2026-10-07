/**
 * @license
 * SPDX-License-Identifier: Apache-2.0 AND LicenseRef-Commons-Clause-1.0
 *
 * Writing one layer's stylesheet.
 *
 * Folded, next to the other things that decide how a layer is drawn rather
 * than what it draws. This is the last resort for a single layer, the way the
 * layout's stylesheet is the last resort for a canvas.
 *
 * The one thing worth saying out loud is what `:scope` means here, because it
 * means something different one level up: on the layout it is the canvas, and
 * here it is this layer. Anything else written here can only reach inside the
 * layer, which is what makes it safe to experiment in.
 */
import React from 'react';
import { StylesheetPanel } from './StylesheetPanel';

interface Props {
  layer: Record<string, any>;
  patch: (next: Record<string, any>) => void;
  t: any;
}



/**
 * Layers whose look is not decided here.
 *
 * A layout holds a single alerts layer and every alert on the channel plays
 * through it, so a stylesheet written here would be one rule for a follow, a
 * raid, a donation and a redeem alike — while the thing anybody actually
 * wants is to style one of them. Offering the box anyway would be offering
 * the wrong granularity and letting somebody find that out after writing the
 * stylesheet.
 *
 * The chat was here too, when there was one chat on a screen of its own. It
 * is a layer like the rest now: its look is in its settings (the chat
 * stylesheet, which the Library writes), and this box is the layer's own, as
 * on every other — a fade along its top edge, say, which is not the chat's
 * look but where it sits.
 */
const STYLED_ELSEWHERE = ['alerts'];

/**
 * Moments a stylesheet can catch, as opposed to parts it can name.
 *
 * A part is a thing that is always there. These are the opposite: what a slot
 * is doing right now, which is how a theme reaches the piece of a layer that
 * only exists for a moment. Both shipped bar themes lean on them — one draws
 * its cells shut on the way out, and neither could before the bar had a way
 * of saying a slot was leaving — and until they were written down here the
 * only way to find out they existed was to read somebody else's stylesheet.
 *
 * Declared above the parts on purpose: the check that every offered part is
 * real reads from the parts list to the end of it, and would sweep these up
 * as parts that no component has.
 */
const LAYER_STATES: Record<string, string[]> = {
  stopwatch: [
    '[data-stopwatch-mode="idle"]',
    '[data-stopwatch-mode="running"]',
    '[data-stopwatch-mode="paused"]',
    '[data-stopwatch-mode="finished"]',
  ],
  avatar: [
    '[data-avatar-talking="true"]',
  ],
  voice: [
    '[data-voice-reacting="true"]',
  ],
  pngtuber: [
    '[data-pngtuber-talking="true"]',
    '[data-pngtuber-loud="true"]',
  ],
  giveaway: [
    '[data-giveaway-state="open"]',
    '[data-giveaway-state="closed"]',
    '[data-giveaway-state="drawing"]',
    '[data-giveaway-state="drawn"]',
  ],
  leaderboard: [
    '[data-board-podium="first"]',
    '[data-board-podium="second"]',
    '[data-board-podium="third"]',
    '[data-board-empty="true"]',
  ],
  hypetrain: [
    '[data-hype-state="running"]',
    '[data-hype-state="done"]',
    '[data-hype-levelup="true"]',
    '[data-hype-golden="true"]',
  ],
  omnibar: [
    '[data-omnibar-state="pinned"]',
    '[data-omnibar-state="leaving"]',
    '[data-omnibar-fresh="yes"]',
  ],
};

/**
 * Parts inside a layer that a stylesheet may name.
 *
 * Only what the app promises to keep. Everything else in a layer is markup
 * generated from its component and rewritten whenever that component is
 * touched, so naming it is writing a rule that breaks on an update for a
 * reason nobody can see. Listed here rather than in documentation because
 * this is where somebody is standing when they need to know.
 */
const LAYER_PARTS: Record<string, string[]> = {
  omnibar: [
    '[data-omnibar="bar"]',
    '[data-omnibar="logo"]',
    '[data-omnibar="stage"]',
    '[data-omnibar="slot"]',
    '[data-omnibar="label"]',
    '[data-omnibar="value"]',
    '[data-omnibar="words"]',
    // A tall bar's, for when this layer shows one.
    '[data-tallbar="bar"]',
    '[data-tallbar="context"]',
    '[data-tallbar="label"]',
    '[data-tallbar="sub"]',
    '[data-tallbar="card"]',
    '[data-tallbar="title"]',
    '[data-tallbar="figure"]',
    '[data-tallbar="detail"]',
    '[data-tallbar="chip"]',
    '[data-tallbar="goal-track"]',
    '[data-tallbar="goal-marker"]',
    '[data-tallbar="pinned"]',
    '[data-tallbar="pinned-figure"]',
    '[data-tallbar="pinned-caption"]',
  ],
  shape: [
    '[data-shape="box"]',
    '[data-shape="rule"]',
  ],
  nameplate: [
    '[data-nameplate="plate"]',
    '[data-nameplate="name"]',
    '[data-nameplate="subtitle"]',
  ],
  viewers: [
    '[data-viewers="box"]',
    '[data-viewers="row"]',
    '[data-viewers="icon"]',
    '[data-viewers="count"]',
  ],
  stopwatch: [
    '[data-stopwatch="clock"]',
    '[data-stopwatch="digits"]',
  ],
  countdown: [
    '[data-countdown="clock"]',
    '[data-countdown="label"]',
    '[data-countdown="digits"]',
    '[data-countdown="paused"]',
  ],
  text: [
    '[data-text="box"]',
    '[data-text="words"]',
  ],
  goal: [
    '[data-goal="head"]',
    '[data-goal="label"]',
    '[data-goal="numbers"]',
    '[data-goal="target"]',
    '[data-goal="percent"]',
    '[data-goal="track"]',
    '[data-goal="fill"]',
  ],
  spotify: [
    '[data-spotify="player"]',
    '[data-spotify="art"]',
    '[data-spotify="label"]',
    '[data-spotify="title"]',
    '[data-spotify="artist"]',
    '[data-spotify="album"]',
    '[data-spotify="elapsed"]',
    '[data-spotify="duration"]',
    '[data-spotify="progress"]',
    '[data-spotify="fill"]',
  ],
  plan: [
    '[data-plan="list"]',
    '[data-plan="title"]',
    '[data-plan="item"]',
    '[data-plan="mark"]',
    '[data-plan="text"]',
    '[data-plan="note"]',
    '[data-plan-leaving]',
  ],
  pngtuber: [
    '[data-pngtuber="frame"]',
    '[data-pngtuber="figure"]',
    '[data-pngtuber="picture"]',
  ],
  giveaway: [
    '[data-giveaway="frame"]',
    '[data-giveaway="title"]',
    '[data-giveaway="prize"]',
    '[data-giveaway="how"]',
    '[data-giveaway="count"]',
    '[data-giveaway="time"]',
    '[data-giveaway="reel"]',
    '[data-giveaway="winner"]',
    '[data-giveaway="avatar"]',
    '[data-giveaway="name"]',
    '[data-giveaway="platform"]',
  ],
  leaderboard: [
    '[data-board="frame"]',
    '[data-board="title"]',
    '[data-board="list"]',
    '[data-board="row"]',
    '[data-board="place"]',
    '[data-board="avatar"]',
    '[data-board="name"]',
    '[data-board="level"]',
    '[data-board="xp"]',
    '[data-board="track"]',
    '[data-board="fill"]',
  ],
  hypetrain: [
    '[data-hype="frame"]',
    '[data-hype="head"]',
    '[data-hype="title"]',
    '[data-hype="level"]',
    '[data-hype="time"]',
    '[data-hype="track"]',
    '[data-hype="fill"]',
    '[data-hype="top"]',
    '[data-hype="done"]',
  ],
  shoutout: [
    '[data-shoutout="frame"]',
    '[data-shoutout="avatar"]',
    '[data-shoutout="text"]',
    '[data-shoutout="title"]',
    '[data-shoutout="name"]',
    '[data-shoutout="game"]',
    '[data-shoutout="link"]',
    '[data-shoutout="viewers"]',
  ],
  avatar: [
    '[data-avatar="frame"]',
    '[data-avatar="figure"]',
    '[data-avatar="svg"]',
    '[data-avatar="head"]',
    '[data-avatar="body"]',
    '[data-avatar="label"]',
  ],
  voice: [
    '[data-voice="list"]',
    '[data-voice="member"]',
    '[data-voice="frame"]',
    '[data-voice="avatar"]',
    '[data-voice="picture"]',
    '[data-voice="status"]',
    '[data-voice="name"]',
    '[data-voice="reaction"]',
  ],
  poll: [
    '[data-poll="card"]',
    '[data-poll="question"]',
    '[data-poll="options"]',
    '[data-poll="option"]',
    '[data-poll="bar"]',
    '[data-poll="fill"]',
    '[data-poll="number"]',
    '[data-poll="label"]',
    '[data-poll="percent"]',
    '[data-poll="count"]',
    '[data-poll="footer"]',
    '[data-poll="hint"]',
    '[data-poll="votes"]',
    '[data-poll="timer"]',
  ],
  players: [
    '[data-players="list"]',
    '[data-players="title"]',
    '[data-players="grid"]',
    '[data-players="row"]',
    '[data-players="dot"]',
    '[data-players="name"]',
    '[data-players="state"]',
    '[data-players="pages"]',
  ],
  question: [
    '[data-question="card"]',
    '[data-question="head"]',
    '[data-question="label"]',
    '[data-question="asker"]',
    '[data-question="window"]',
    '[data-question="text"]',
  ],
  images: [
    '[data-images="frame"]',
    '[data-images="picture"]',
  ],
  roster: [
    '[data-roster="grid"]',
    '[data-roster="seat"]',
    '[data-roster="tab"]',
    '[data-roster="role"]',
    '[data-roster="body"]',
    '[data-roster="name"]',
    '[data-roster="pronouns"]',
  ],
  runcard: [
    '[data-runcard="card"]',
    '[data-runcard="title"]',
    '[data-runcard="machine"]',
    '[data-runcard="details"]',
    '[data-runcard="category"]',
    '[data-runcard="estimate"]',
  ],
};

export const LayerCssPanel = ({ layer, patch, t }: Props) => {
  if (STYLED_ELSEWHERE.includes(layer.type)) return null;
  return (
    <StylesheetPanel
      title={t.layerCss || 'This layer’s CSS'}
      css={layer.css}
      motionCss={layer.motionCss}
      scopeHint={t.layerScopeHint || 'is this layer. Pseudo-elements and @keyframes work here too.'}
      travelsHint={t.layerCssTravels || 'Kept on the layer, so duplicating it brings these rules along.'}
      parts={LAYER_PARTS[layer.type] || []}
      states={LAYER_STATES[layer.type] || []}
      patch={patch}
      t={t}
    />
  );
};
