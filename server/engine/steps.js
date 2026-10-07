/**
 * @license
 * SPDX-License-Identifier: Apache-2.0 AND LicenseRef-Commons-Clause-1.0
 *
 * Action step executor.
 *
 * Executes an ActionStep[] tree against the live platform services. Steps run
 * sequentially and awaited, so `obs_scene` followed by `obs_text` is ordered
 * the way the author wrote it.
 *
 * Two safety properties V2 lacked:
 *   - `trigger_action` is depth-limited and cycle-guarded. An action that
 *     triggers itself used to recurse until the stack blew.
 *   - A failing step is logged and skipped rather than aborting the whole run,
 *     so one bad OBS source name doesn't silently kill the chat reply after it.
 */

import { evaluate } from './conditions.js';
import { interpolate, nowPlayingVars } from './variables.js';
import { createLogger } from '../core/logger.js';
import { bus, EVENTS } from '../core/bus.js';
import { OVERLAY_VARS } from '../../shared/overlay-vars.js';
import { youtubeCategoryName } from '../../shared/youtube-categories.js';

const log = createLogger('steps');

const MAX_DEPTH = 8;

/** Which run card field each single-field step writes. */
const RUN_FIELDS = {
  run_set_game: 'game',
  run_set_platform: 'platform',
  run_set_year: 'year',
  run_set_category: 'category',
  run_set_estimate: 'estimate',
};

/** Every value a text layer fills in for itself, by name. */
const OVERLAY_VALUE_NAMES = new Set(OVERLAY_VARS.map((v) => v.name));

/**
 * Fill in an action's own values, and leave the overlay's for the layer.
 *
 * "{user} asked for {followers} followers" written into a text layer should
 * say who asked once, and keep the follower count live afterwards — the layer
 * fills that in, and freezing it at the moment the command ran would turn a
 * counter into a number that never moves. Where a name means something to
 * both, the overlay's meaning wins: {platform} in a text layer is the run
 * card's platform, which is what the layer's own editor offers it as.
 */
function keepOverlayValuesLive(text, ctx) {
  const held = String(text ?? '').replace(/\{([A-Za-z]+)\}/g, (all, name) => (
    OVERLAY_VALUE_NAMES.has(name) ? `\u0000${name}\u0000` : all
  ));
  return interpolate(held, ctx).replace(/\u0000([A-Za-z]+)\u0000/g, '{$1}');
}

/** The timer's time, as the clock on stream writes it: 1:02:03.4, or 12:34.5. */
function formatTimer(s) {
  const ms = s.mode === 'running' && s.startedAt ? Math.max(0, Date.now() - s.startedAt) : (s.elapsedMs || 0);
  const tenths = Math.floor(ms / 100) % 10;
  const total = Math.floor(ms / 1000);
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const sec = total % 60;
  const pad = (n) => String(n).padStart(2, '0');
  return h > 0 ? `${h}:${pad(m)}:${pad(sec)}.${tenths}` : `${pad(m)}:${pad(sec)}.${tenths}`;
}

/** Chat text onto one line, since what it lands on is a single line on stream. */
const flat = (text) => String(text ?? '').replace(/\s+/g, ' ').trim();

/**
 * @param {Array} steps
 * @param {object} ctx      evaluation context from buildContext()
 * @param {object} services { twitch, obs, discord, spotify, actions }
 * @param {object} runState { depth, visited:Set }
 */
export async function runSteps(steps, ctx, services, runState = { depth: 0, visited: new Set() }) {
  if (!Array.isArray(steps)) return;
  // `{plan.current}` and the rest, present in every action the way the Spotify
  // ones are, so a message can say where the plan is without moving it.
  if (ctx && ctx.plan === undefined && services?.plan?.vars) ctx.plan = services.plan.vars();

  for (const step of steps) {
    try {
      await runStep(step, ctx, services, runState);
    } catch (err) {
      log.error(`step "${step?.type}" failed:`, err);
    }
  }
}

/**
 * One line at random from a message box holding several alternatives.
 *
 * Applied to every step whose editor gives a textarea rather than a
 * single-line input, since a textarea is the thing that lets you type
 * alternatives in the first place: twitch_chat, discord_webhook and
 * browser_tts. The remaining text fields — stream title, OBS scene and text
 * source, browser URL, Spotify URI — are single-line inputs holding one
 * specific value, and are deliberately left alone.
 *
 * A box with one line (or none) is returned untouched, whitespace and all, so
 * every existing single-line message behaves exactly as before.
 */
function pickLine(raw) {
  if (typeof raw !== 'string' || !raw.includes('\n')) return raw;
  const lines = raw.split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
  if (lines.length <= 1) return lines[0] ?? raw;
  return lines[Math.floor(Math.random() * lines.length)];
}

/**
 * Where a chat step's message goes: 'twitch' (also anything older or unknown,
 * as every step saved before there was a choice went there), 'youtube',
 * 'both', or 'origin' — YouTube when what set it off came from YouTube chat,
 * Twitch otherwise.
 */
export function chatDestination(sendTo, ctx) {
  if (sendTo === 'origin') {
    const from = ctx?.user?.platform || ctx?.platform;
    // A command typed in Discord is answered in the channel it was typed in.
    if (from === 'discord' && ctx?.discordChannelId) return 'discord';
    return from === 'youtube' ? 'youtube' : 'twitch';
  }
  return ['youtube', 'both'].includes(sendTo) ? sendTo : 'twitch';
}

async function runStep(step, ctx, services, runState) {
  const cfg = step.config || {};
  const { twitch, obs, discord, spotify, youtube, actions, omnibar, questions, players, poll, giveaway, run, plan, layouts, timer, avatar } = services;

  switch (step.type) {
    // ---------- Control flow ----------
    case 'condition': {
      const passed = evaluate(cfg.logic, ctx);
      const branch = passed ? step.thenActions : step.elseActions;
      await runSteps(branch, ctx, services, runState);
      return;
    }

    case 'trigger_action': {
      if (!cfg.actionId) return;

      if (runState.depth >= MAX_DEPTH) {
        log.warn(`trigger_action stopped: max depth ${MAX_DEPTH} reached`);
        return;
      }
      if (runState.visited.has(cfg.actionId)) {
        log.warn(`trigger_action stopped: cycle detected on ${cfg.actionId}`);
        return;
      }

      const target = actions.getById(cfg.actionId);
      if (!target) {
        log.warn(`trigger_action: no action with id ${cfg.actionId}`);
        return;
      }

      const nextState = {
        depth: runState.depth + 1,
        visited: new Set([...runState.visited, cfg.actionId]),
      };
      await runSteps(target.actions, ctx, services, nextState);
      return;
    }

    // ---------- Twitch ----------
    /*
      To Twitch as ever, or to YouTube, or both — or to where it came from, so
      a command a YouTube viewer typed is answered where they can read it. A
      message to YouTube costs 50 units of the day's allowance, so it is never
      the default; one that cannot go there is logged and the rest runs on.
    */
    case 'twitch_chat': {
      const text = interpolate(pickLine(cfg.message), ctx);
      if (!text) return;
      const to = chatDestination(cfg.sendTo, ctx);
      if (to === 'twitch' || to === 'both') {
        await twitch.say(text, {
          useBot: Boolean(cfg.useBotAccount),
          fallbackToMain: cfg.fallbackToMain !== false,
        });
      }
      if ((to === 'youtube' || to === 'both') && youtube?.say) {
        try {
          await youtube.say(text, { cut: true });
        } catch (err) {
          log.warn(`YouTube chat: ${err.message}`);
        }
      }
      if (to === 'discord' && discord?.sendMessage) {
        try {
          await discord.sendMessage(ctx.discordChannelId, text.slice(0, 2000), undefined, undefined, undefined, { allowed_mentions: { parse: [] } });
        } catch (err) {
          log.warn(`Discord answer: ${err.message}`);
        }
      }
      return;
    }

    case 'twitch_set_title':
      await twitch.setTitle(interpolate(cfg.title, ctx));
      return;

    /*
      The broadcast on air, or the next one scheduled. Nothing is sent for an
      empty result, so "!ytitle" on its own cannot blank a title — and for the
      description, cannot wipe the whole thing. The description keeps its line
      breaks; the title is one line, as YouTube requires.
    */
    case 'youtube_set_title':
    case 'youtube_set_description': {
      if (!youtube) return;
      const isTitle = step.type === 'youtube_set_title';
      const text = isTitle
        ? flat(interpolate(cfg.title || '', ctx))
        : String(interpolate(cfg.description || '', ctx)).trim();
      if (!text) return;
      try {
        await (isTitle ? youtube.setTitle(text) : youtube.setDescription(text));
      } catch (err) {
        log.warn(err.message);
      }
      return;
    }

    /*
      Flips between the two categories the step names, so a single dock button
      can switch a stream between Gaming and People & Blogs. Afterwards
      {youtube.category} is the one it landed on, for a chat step to announce.
    */
    case 'youtube_toggle_category': {
      if (!youtube?.toggleCategory) return;
      try {
        const now = await youtube.toggleCategory(cfg.categoryA || '20', cfg.categoryB || '');
        ctx.youtube = { ...(ctx.youtube || {}), category: youtubeCategoryName(now) };
      } catch (err) {
        log.warn(err.message);
      }
      return;
    }

    case 'twitch_set_category':
      // Interpolated, like every other step. Without this a category action
      // built around "{input}" — the obvious way to write "!game <name>" —
      // sent Twitch the literal text instead of what the viewer typed.
      // `setCategory` looks a name up only when no id is given, so an action
      // carrying a name must leave `gameId` empty.
      await twitch.setCategory(interpolate(cfg.gameId, ctx), interpolate(cfg.gameName, ctx));
      return;

    // ---------- OBS ----------
    case 'obs_scene':
      await obs.setScene(interpolate(cfg.sceneName, ctx));
      return;

    /*
      These three read a missing choice the way their editors show it — Show,
      Enable, Mute — rather than as false. A step saved without one meant what
      it showed, and reading it as off did the opposite of what was on screen.

      Each can also be 'toggle': on if it is off and off if it is on, asked of
      OBS at the time, so one command does both — a !blur that unblurs too.
    */
    case 'obs_visibility':
      if (cfg.visible === 'toggle') await obs.toggleSourceVisible(cfg.sceneName, cfg.sourceName);
      else await obs.setSourceVisible(cfg.sceneName, cfg.sourceName, cfg.visible !== false);
      return;

    case 'obs_text':
      await obs.setText(cfg.sourceName, interpolate(cfg.textContent, ctx));
      return;

    case 'obs_filter_toggle':
      if (cfg.filterEnabled === 'toggle') await obs.toggleFilter(cfg.sourceName, cfg.filterName);
      else await obs.setFilterEnabled(cfg.sourceName, cfg.filterName, cfg.filterEnabled !== false);
      return;

    case 'obs_set_volume':
      await obs.setVolumeDb(cfg.sourceName, Number(cfg.volumeDb ?? 0));
      return;

    case 'obs_set_mute':
      if (cfg.muted === 'toggle') await obs.toggleMuted(cfg.sourceName);
      else await obs.setMuted(cfg.sourceName, cfg.muted !== false);
      return;

    case 'obs_save_replay':
      await obs.saveReplayBuffer();
      return;

    /*
      Ends the stream in OBS — the end of a "goodnight" action, after the
      outro has played. Nothing going is nothing to stop, not a failure.
      OBS then says the stream stopped, which is the "Stream ended" trigger.
    */
    case 'obs_stop_stream':
      if (!(await obs.stopStream())) log.info('stop streaming: OBS was not streaming');
      return;

    case 'obs_set_browser_url':
      await obs.setBrowserUrl(cfg.sourceName, interpolate(cfg.browserUrl, ctx));
      return;

    case 'obs_set_transform':
      await obs.setTransform(cfg.sceneName, cfg.sourceName, {
        positionX: cfg.positionX,
        positionY: cfg.positionY,
        scale: cfg.scale,
        rotation: cfg.rotation,
      });
      return;

    // ---------- Discord ----------
    case 'discord_webhook': {
      const content = interpolate(pickLine(cfg.message), ctx);
      if (!cfg.webhookUrl || !content) return;
      await discord.postWebhook(cfg.webhookUrl, content);
      return;
    }

    /*
      A message from the bot itself, to any channel it can post in — no
      webhook to set up — with an optional card. Only the pings written into
      the step go out, never ones that arrive through a variable.
    */
    case 'discord_send': {
      if (!discord?.sendMessage || !cfg.channelId) return;
      const template = pickLine(cfg.message || '');
      const content = interpolate(template, ctx);
      const card = cfg.card ? {
        title: interpolate(cfg.cardTitle || '', ctx) || undefined,
        description: interpolate(cfg.cardDescription || '', ctx) || undefined,
        color: cfg.cardColor || undefined,
        image: flat(interpolate(cfg.cardImage || '', ctx)) || undefined,
        url: flat(interpolate(cfg.cardUrl || '', ctx)) || undefined,
      } : undefined;
      if (!content && !(card && (card.title || card.description || card.image))) return;
      await discord.sendMessage(cfg.channelId, content, card, undefined, undefined, {
        allowed_mentions: discord.mentionsFrom ? discord.mentionsFrom(`${template} ${cfg.cardDescription || ''}`) : { parse: ['users'] },
      });
      return;
    }

    // ---------- Spotify ----------
    case 'spotify_control': {
      const op = cfg.spotifyOperation;

      if (op === 'queue') {
        const queued = await spotify.queue(interpolate(cfg.spotifyUri, ctx));
        // Steps share one context, so a later chat step in the same action can
        // name what was added — the point of V2's {spotify.queuedTrack}.
        if (queued) {
          ctx.spotify = {
            ...(ctx.spotify || {}),
            queuedTrack: queued.name,
            queuedArtist: queued.artist,
            queuedAlbum: queued.album,
            queuedUrl: queued.url,
          };
        }
        return;
      }

      await spotify.control(op);

      // After a skip the next step usually announces the new track, so wait for
      // Spotify to actually switch before letting it run.
      if (op === 'next' || op === 'previous') {
        const now = await spotify.settleAfterSkip?.();
        if (now) ctx.spotify = { ...(ctx.spotify || {}), ...nowPlayingVars(now) };
      }
      return;
    }

    // ---------- DroidCam ----------
    case 'droidcam_control': {
      if (!services.droidcam?.control) return;
      // Interpolated so a viewer can drive it: "!zoom 3.5" reaching a step
      // configured with {input} is the whole point of exposing this.
      const raw = interpolate(String(cfg.droidcamValue ?? ''), ctx);
      try {
        await services.droidcam.control(cfg.droidcamOperation, raw);
      } catch (err) {
        // runSteps already isolates a failing step, so this is not what keeps
        // the rest of the action running — it names the operation, which the
        // generic handler cannot, and an action with several camera steps is
        // otherwise indistinguishable in the log.
        log.warn(`droidcam ${cfg.droidcamOperation} failed: ${err.message}`);
      }
      return;
    }

    // ---------- Omnibar ----------
    /*
      Put a viewer's message into the question queue.

      A step rather than its own trigger word, so it hangs off an ordinary
      command and inherits what a command already has: who may use it, and how
      often. A question box without a cooldown is a queue one person can fill
      by themselves.

      Defaults to {message}, which is what the viewer typed after the command.
    */
    // ---------- The players list ----------
    /*
      Who joins is whoever the step names — {user} for "!join", so a viewer
      adds themselves — with a colour from what they typed after it. Who may
      use the command is the command's business, as ever.
    */
    case 'players_join': {
      if (!players?.join) return;
      const name = flat(interpolate(pickLine(cfg.name || '{user}'), ctx));
      if (!players.join(name, flat(interpolate(cfg.colour || '', ctx)))) log.warn(`players: could not add "${name}"`);
      return;
    }

    case 'players_state': {
      if (!players?.setState) return;
      players.setState(flat(interpolate(pickLine(cfg.name || '{input}'), ctx)), cfg.playerState || 'out');
      return;
    }

    case 'players_remove': {
      if (!players?.remove) return;
      players.remove(flat(interpolate(pickLine(cfg.name || '{input}'), ctx)));
      return;
    }

    case 'players_reset':
      players?.reset?.();
      return;

    case 'players_clear':
      players?.clear?.();
      return;

    // ---------- The poll ----------
    /*
      "!poll Who is the impostor? | Red | Blue" opens that poll; the command
      alone opens the one set up on the Polls screen. Who may is the
      command's business, as ever — make it a mod command.
    */
    case 'poll_open':
      poll?.open?.(flat(interpolate(cfg.text ?? '{input}', ctx)));
      return;

    case 'poll_close':
      poll?.close?.();
      return;

    case 'poll_reset':
      poll?.reset?.();
      return;

    // The giveaway (giveaway.js). A refusal — nothing to draw, no prize — is the log's, not the action's end.
    case 'giveaway_open':
      await Promise.resolve(giveaway?.open?.(flat(interpolate(cfg.prize ?? '', ctx)))).catch((err) => log.warn(`giveaway: ${err.message}`));
      return;

    case 'giveaway_close':
      await Promise.resolve(giveaway?.close?.()).catch((err) => log.warn(`giveaway: ${err.message}`));
      return;

    case 'giveaway_draw':
      await Promise.resolve(giveaway?.draw?.()).catch((err) => log.warn(`giveaway: ${err.message}`));
      return;

    // ---------- The avatars ----------
    /*
      A face for every avatar on screen: a pixel avatar's expression, or the
      name of a set of pictures on a PNGtuber layer. "!face happy" works with
      {input} as the face.
    */
    case 'avatar_face':
      avatar?.face?.(flat(interpolate(cfg.face ?? '{input}', ctx)), Number(cfg.seconds) || 5);
      return;

    /*
      Viewers dress every pixel avatar on screen: an outfit or a hat, for a
      few minutes. {input} is what they typed — "!outfit" and a name, or the
      text a channel-point reward asks for — and loose words do, in English
      and Spanish.
    */
    /*
      Twitch, from an action: shout somebody out ("!so {input}"), clip the
      stream — {clip.url} is its link for the steps after — or drop a marker
      in the VOD.
    */
    case 'twitch_shoutout': {
      const target = flat(interpolate(cfg.target ?? '{input}', ctx));
      if (target.trim()) await services.twitchExtras?.shoutout?.(target);
      return;
    }

    case 'twitch_clip': {
      const made = await services.twitchExtras?.clip?.();
      ctx.clip = made?.ok ? { url: made.url, id: made.id } : { url: '', id: '', error: made?.error || '' };
      return;
    }

    case 'twitch_marker':
      await services.twitchExtras?.marker?.(flat(interpolate(cfg.description ?? '{input}', ctx)));
      return;

    /*
      Every pixel avatar on screen does something once: drinks a glass of
      water. {input} lets chat pick, by name or a loose word ("!tomar agua").
    */
    case 'avatar_action':
      avatar?.act?.(flat(interpolate(cfg.action ?? 'drink', ctx)));
      return;

    case 'avatar_dress':
      avatar?.dress?.(cfg.what === 'hat' ? 'hat' : 'outfit', flat(interpolate(cfg.name ?? '{input}', ctx)), Number(cfg.minutes) || 5);
      return;

    case 'question_add': {
      if (!questions?.add) return;
      const asked = interpolate(pickLine(cfg.text || '{message}'), ctx);
      if (!asked || !asked.trim()) return;
      /*
        Who asked is whoever ran it, unless the step says otherwise — so a mod
        can pass on a question from somewhere chat cannot see, and the queue
        credits the person it came from rather than the mod who typed it.
      */
      const named = String(cfg.asker ?? '').trim() ? flat(interpolate(cfg.asker, ctx)).trim() : '';
      /*
        ctx.user is the whole chatter — name, id, badges — not a name. Their id
        and the message it came in on go along, so a moderator deleting the
        message or timing them out takes the question too. A question passed
        on for somebody else is not theirs to lose that way.
      */
      questions.add({
        user: named || ctx.user?.name,
        ...(named ? {} : { userId: ctx.user?.id, msgId: ctx.chatId }),
        platform: ctx.platform,
        text: asked,
      });
      return;
    }

    case 'omnibar_set': {
      if (!omnibar?.setItemText) return;
      omnibar.setItemText(cfg.slotId, interpolate(pickLine(cfg.text), ctx));
      return;
    }

    /*
      {input} by default, so "!goal +50" adds fifty. Afterwards {goal.value},
      {goal.target}, {goal.left} and {goal.percent} say where it got to, for a
      chat step after this one.
    */
    /*
      The run timer, from chat or from an action. Afterwards {timer.time} is
      the time on the clock, for a chat step after it: "Finished in {timer.time}".
    */
    case 'timer_control': {
      if (!timer?.control) return;
      const now = timer.control(cfg.timerOp || 'toggle');
      if (now) ctx.timer = { time: formatTimer(now), mode: now.mode };
      return;
    }

    /*
      The countdown: one of the saved setups started from the top, or the
      clock paused, carried on, given or docked time, or put back. After it,
      {countdown.time} is what is left and {countdown.label} what it says,
      for a chat step: "Volvemos en {countdown.time}".
    */
    /*
      Omnilayer: put a layout on stream — the overlay, and where OBS puts the
      game and the camera — with the transition set up for it, or the one
      this step names.
    */
    case 'layout_switch': {
      // A scene type means whichever layout is that type in the profile that is on (scene-types.js).
      // A type since deleted falls back to the layout the step named before it named the type.
      const byType = Boolean(cfg.sceneType && services.omnilayer?.goLiveType && (!services.omnilayer.hasType || services.omnilayer.hasType(cfg.sceneType)));
      if (!byType && (!services.omnilayer?.goLive || !cfg.layoutId)) return;
      try {
        if (byType) await services.omnilayer.goLiveType(cfg.sceneType, { transition: cfg.transition || '' });
        else await services.omnilayer.goLive(cfg.layoutId, { transition: cfg.transition || '' });
      } catch (err) {
        // Off, it does nothing, as its editor says; anything else is worth the log.
        if (err?.code === 'omnilayer_off') return;
        // A profile with nothing of that type is a setup still being made, not a fault: one line, and the Omnilayer card says it too.
        if (err?.code === 'no_type_layout') { log.warn(`go live with a type: ${err.message}`); return; }
        throw err;
      }
      return;
    }

    /*
      Remote players: whose game is on screen — what the stand-in slots
      (ON_SCREEN_SOURCE) show, the Gameplay layouts' game, full screen. A seat by
      number or by who is in it, so "!ver benji" works with {input}. With a
      scene type it then goes live with that type's layout too — but, unless
      the step says any layout will do, only from a layout already showing the
      players: a viewer's command never takes the stream off the start screen,
      BRB or Just Chatting. From one of those it only changes whose game will
      be up when the stream comes back to it.
    */
    case 'remote_on_screen': {
      const rp = services.remotePlayers;
      if (!rp?.putOnScreen) return;
      const n = rp.putOnScreen(flat(interpolate(String(cfg.player ?? '{input}'), ctx)));
      if (!n || !cfg.sceneType || !services.omnilayer?.goLiveType) return;
      if (cfg.anyLayout !== true && !rp.liveShowsPlayers()) return;
      try {
        await services.omnilayer.goLiveType(cfg.sceneType, { transition: cfg.transition || '' });
      } catch (err) {
        if (err?.code === 'omnilayer_off') return;
        if (err?.code === 'no_type_layout') { log.warn(`player on screen: ${err.message}`); return; }
        throw err;
      }
      return;
    }

    case 'countdown_control': {
      if (!services.countdown?.act) return;
      const { after, time } = services.countdown.act(cfg.countdownOp || 'start', {
        timer: cfg.timer || '',
        amount: interpolate(cfg.value ?? '1:00', ctx),
      });
      ctx.countdown = { time, label: after.label || '', mode: after.mode };
      return;
    }

    /*
      The deaths count. {input} by default, so "!muerte" on its own is one more,
      "!muerte -1" takes one back and "!muerte 5" sets it. Afterwards {deaths}
      is the count, for a chat step after this one: "💀 {deaths}".
    */
    case 'deaths_change': {
      if (!services.counters?.change) return;
      const done = services.counters.change('deaths', cfg.deathsOp || 'auto', interpolate(cfg.value ?? '{input}', ctx));
      if (done) ctx.deaths = done.value;
      return;
    }

    case 'goal_change': {
      if (!omnibar?.changeGoal) return;
      const now = omnibar.changeGoal(cfg.slotId, cfg.goalMode || 'auto', interpolate(cfg.value ?? '{input}', ctx));
      if (now) ctx.goal = now;
      return;
    }

    case 'text_layer_set': {
      if (!layouts?.setTextLayer) return;
      layouts.setTextLayer(cfg.layoutId, cfg.layerUid, keepOverlayValuesLive(pickLine(cfg.text), ctx));
      return;
    }

    // ---------- The run card ----------
    /*
      One field each, so the editor lists them by name. The value is written
      whatever it comes to, empty included: "!platform" on its own is how a mod
      takes a platform off the card.
    */
    case 'run_set_game':
    case 'run_set_platform':
    case 'run_set_year':
    case 'run_set_category':
    case 'run_set_estimate': {
      if (!run?.setField) return;
      run.setField(RUN_FIELDS[step.type], flat(interpolate(pickLine(cfg.value), ctx)));
      return;
    }

    /*
      A person's name is always written, like the fields above. The second
      line only when the step has something in its box, so a step that renames
      the runner leaves their pronouns alone — which is also why a blank box
      means "leave it" rather than "empty it".
    */
    case 'run_set_runner':
    case 'run_set_host':
    case 'run_set_commentator': {
      if (!run?.setPerson) return;
      const fields = { name: flat(interpolate(pickLine(cfg.name), ctx)) };
      if (String(cfg.subtitle ?? '').trim()) fields.subtitle = flat(interpolate(pickLine(cfg.subtitle), ctx));
      const role = step.type.slice('run_set_'.length);
      run.setPerson(role, fields, role === 'commentator' ? (cfg.seat ?? 1) : undefined);
      return;
    }

    case 'run_clear': {
      if (!run?.clear) return;
      run.clear(cfg.clearWhat || 'all');
      return;
    }

    // ---------- The stream plan ----------
    /*
      Each refreshes `{plan.*}` afterwards, so a chat step after it can say
      "now: {plan.current}" and mean the activity it moved to.
    */
    case 'plan_add': {
      if (!plan?.add) return;
      plan.add(flat(interpolate(pickLine(cfg.text), ctx)), flat(interpolate(cfg.note || '', ctx)), cfg.where || 'end');
      ctx.plan = plan.vars();
      return;
    }

    case 'plan_next':
    case 'plan_back': {
      if (!plan?.step) return;
      plan.step(step.type === 'plan_next' ? 1 : -1);
      ctx.plan = plan.vars();
      return;
    }

    // ---------- Device (browser-only capability) ----------
    case 'browser_tts': {
      const text = interpolate(pickLine(cfg.ttsText || cfg.message), ctx);
      if (!text) return;

      // The voice name only means something to the provider that is speaking.
      // A Gemini voice ("Puck") is not a browser voiceURI, so a fallback must
      // drop it and let the surface use its default rather than warning about
      // a voice it could never have.
      const speakInBrowser = (voiceURI) => bus.emit(EVENTS.DEVICE, {
        kind: 'play_tts',
        text,
        rate: cfg.ttsRate ?? 1,
        pitch: cfg.ttsPitch ?? 1,
        volume: cfg.ttsVolume ?? 1,
        voiceURI,
      });

      if (cfg.ttsProvider === 'gemini') {
        // Gemini synthesis happens server-side; the browser only plays the
        // resulting audio, so this still works with zero UI tabs open as long
        // as one playback surface (dock/overlay) is connected.
        const audioBase64 = await services.tts.synthesise(text, cfg.ttsVoice);
        if (audioBase64) {
          bus.emit(EVENTS.DEVICE, { kind: 'play_audio', audioBase64, rate: cfg.ttsRate ?? 1 });
          return;
        }

        // Synthesis failed — no key, a quota refusal, a network blip, or the
        // pinned model having been retired (every Gemini TTS model is a
        // preview build, so that is a question of when).
        //
        // This used to return here, which meant TTS simply went silent
        // mid-stream with one line in a log nobody is watching. Speaking in a
        // different voice is a far better failure than not speaking at all.
        log.warn('Gemini speech failed — falling back to the browser voice for this message');
        speakInBrowser(undefined);
        return;
      }

      speakInBrowser(cfg.ttsVoice);
      return;
    }

    default:
      log.warn(`unknown step type "${step.type}"`);
  }
}
