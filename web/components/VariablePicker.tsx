/**
 * @license
 * SPDX-License-Identifier: Apache-2.0 AND LicenseRef-Commons-Clause-1.0
 *
 * The list of things you can put in curly braces.
 *
 * Every template field in the app runs through the server's `interpolate()`,
 * which replaces `{path}` by walking the run context. An unknown path is left
 * on screen as-is on purpose — so a typo is visible rather than silently
 * becoming "undefined" in front of chat. That design only helps if the author
 * can find out what the real names are, which is what this panel is for.
 *
 * The catalogue below is written against `server/engine/variables.js` and the
 * event payloads in `server/platforms/*`. If a variable is added there and not
 * here, it still works — this is documentation, not the source of truth.
 */
import React, { useMemo, useState } from 'react';
import { X, Search, Check, Copy, Braces, AlertTriangle } from 'lucide-react';
import { copyText } from '../utils';

type Lang = 'en' | 'es';

interface Variable {
  /** Written without braces; the row adds them. */
  token: string;
  en: string;
  es: string;
  /** Shown in a muted column — what it actually looks like when it resolves. */
  sample?: string;
  /** True when the value is only there under some conditions. */
  conditional?: boolean;
}

interface Group {
  id: string;
  en: string;
  es: string;
  /** A one-line caveat shown under the group heading. */
  noteEn?: string;
  noteEs?: string;
  vars: Variable[];
}

/** Groups that apply no matter what fired the action. */
export const VARIABLE_GROUPS: Group[] = [
  {
    id: 'viewer',
    en: 'Viewer', es: 'Espectador',
    vars: [
      { token: 'user', en: 'Who set this off. Short for {user.name}.', es: 'Quien lo activo. Atajo de {user.name}.', sample: 'Nightbot' },
      { token: 'user.name', en: 'The display name.', es: 'El nombre visible.', sample: 'Nightbot' },
      { token: 'username', en: 'Another name for {user}. Kept for templates brought over from V2.', es: 'Otro nombre para {user}. Se mantiene para plantillas traidas de V2.', sample: 'Nightbot' },
      { token: 'user.id', en: 'Platform user id.', es: 'ID del usuario en la plataforma.', sample: '12345678' },
      { token: 'user.avatar', en: 'Avatar image URL.', es: 'URL de la imagen de perfil.' },
      { token: 'user.isSub', en: 'true / false.', es: 'true / false.', sample: 'true' },
      { token: 'user.isMod', en: 'true / false.', es: 'true / false.', sample: 'false' },
      { token: 'user.isVip', en: 'true / false.', es: 'true / false.', sample: 'false' },
      { token: 'user.isBroadcaster', en: 'true / false.', es: 'true / false.', sample: 'false' },
      { token: 'user.platform', en: 'Where they are: twitch, tiktok, discord.', es: 'Donde estan: twitch, tiktok, discord.', sample: 'twitch' },
    ],
  },
  {
    id: 'message',
    en: 'Message', es: 'Mensaje',
    noteEn: 'On a command, {message} is the text AFTER the trigger word. "!tts hola" gives "hola".',
    noteEs: 'En un comando, {message} es el texto DESPUES de la palabra clave. "!tts hola" da "hola".',
    vars: [
      { token: 'message', en: 'What they said, without the trigger word.', es: 'Lo que dijeron, sin la palabra clave.', sample: 'hola mundo' },
      { token: 'message.raw', en: 'The whole line, trigger word included.', es: 'La linea completa, con la palabra clave.', sample: '!tts hola mundo' },
      { token: 'message.content', en: 'The long name for {message}. Identical value.', es: 'El nombre largo de {message}. Mismo valor.', sample: 'hola mundo' },
      { token: 'message.args', en: 'Same as {message} on a command.', es: 'Igual que {message} en un comando.', sample: 'hola mundo' },
      { token: 'args', en: 'Another name for {message.args}. Kept for templates brought over from V2.', es: 'Otro nombre para {message.args}. Se mantiene para plantillas traidas de V2.', sample: 'hola mundo' },
      { token: 'message.words', en: 'Every word of the WHOLE line, trigger included, comma-separated when printed.', es: 'Cada palabra de la linea COMPLETA, con la palabra clave, separada por comas al imprimirse.', sample: '!tts,hola,mundo' },
      { token: 'input', en: 'Text after the trigger, or what a viewer typed into a channel-point reward.', es: 'Texto tras la palabra clave, o lo que el espectador escribio en una recompensa de puntos.', sample: 'hola mundo' },
    ],
  },
  {
    id: 'command',
    en: 'Command', es: 'Comando',
    noteEn: 'Only when a command fired the action. Empty on event triggers.',
    noteEs: 'Solo cuando un comando activo la accion. Vacio en disparadores de evento.',
    vars: [
      { token: 'command.name', en: 'The command name you gave it.', es: 'El nombre que le pusiste al comando.', sample: 'Discord', conditional: true },
      { token: 'command.trigger', en: 'Which of its trigger words was typed.', es: 'Cual de sus palabras clave se escribio.', sample: '!discord', conditional: true },
      { token: 'command.args', en: 'Text after the trigger word.', es: 'Texto tras la palabra clave.', conditional: true },
    ],
  },
  {
    id: 'youtube',
    en: 'YouTube', es: 'YouTube',
    noteEn: 'Only after a YouTube: toggle category step, so put the message after it.',
    noteEs: 'Solo despues de un paso de YouTube: alternar categoria, asi que pon el mensaje despues.',
    vars: [
      { token: 'youtube.category', en: 'The category the stream is in now.', es: 'La categoria en la que esta el stream ahora.', sample: 'Gaming', conditional: true },
    ],
  },
  {
    id: 'plan',
    en: 'Stream plan', es: 'Plan del stream',
    noteEn: 'Always present. After a Plan step they describe where it moved to, so put the message after the step.',
    noteEs: 'Siempre disponibles. Tras un paso de Plan describen a donde se movio, asi que pon el mensaje despues del paso.',
    vars: [
      { token: 'plan.current', en: 'The activity on now. Empty before the plan starts and after it ends.', es: 'La actividad actual. Vacia antes de empezar y al terminar.', sample: 'Ranked' },
      { token: 'plan.next', en: 'The activity after it.', es: 'La actividad que sigue.', sample: 'Viewer games' },
      { token: 'plan.previous', en: 'The activity before it.', es: 'La actividad anterior.', sample: 'Warm up' },
      { token: 'plan.done', en: 'How many are marked done.', es: 'Cuantas estan hechas.', sample: '1' },
      { token: 'plan.total', en: 'How many the plan holds.', es: 'Cuantas tiene el plan.', sample: '3' },
    ],
  },
  {
    id: 'goal',
    en: 'Goal', es: 'Meta',
    noteEn: 'Only after a "Goal: change number" step, and about the goal it changed. Put the message after the step.',
    noteEs: 'Solo despues de un paso "Meta: cambiar numero", y sobre la meta que cambio. Pon el mensaje despues del paso.',
    vars: [
      { token: 'goal.value', en: 'Where the goal is now.', es: 'Donde va la meta.', sample: '530', conditional: true },
      { token: 'goal.target', en: 'What it is counting to.', es: 'Hasta donde cuenta.', sample: '1000', conditional: true },
      { token: 'goal.left', en: 'How much is left to go.', es: 'Cuanto falta.', sample: '470', conditional: true },
      { token: 'goal.percent', en: 'How far along it is, in %.', es: 'Que tan avanzada va, en %.', sample: '53', conditional: true },
    ],
  },
  {
    id: 'timer',
    en: 'Run timer', es: 'Cronometro',
    noteEn: 'Only after a "Run timer" step. Put the message after the step.',
    noteEs: 'Solo despues de un paso "Cronometro". Pon el mensaje despues del paso.',
    vars: [
      { token: 'timer.time', en: 'The time on the clock, as it shows on stream.', es: 'El tiempo en el reloj, como se ve en el stream.', sample: '1:02:03.4', conditional: true },
      { token: 'timer.mode', en: 'idle, running, paused or finished.', es: 'idle, running, paused o finished.', sample: 'finished', conditional: true },
    ],
  },
  {
    id: 'countdown',
    en: 'Countdown', es: 'Cuenta regresiva',
    noteEn: 'Only after a "Countdown" step. Put the message after the step.',
    noteEs: 'Solo despues de un paso "Cuenta regresiva". Pon el mensaje despues del paso.',
    vars: [
      { token: 'countdown.time', en: 'What is left, as the clock shows it.', es: 'Lo que queda, como lo muestra el reloj.', sample: '4:58', conditional: true },
      { token: 'countdown.label', en: 'What the countdown says above the time.', es: 'Lo que dice la cuenta regresiva sobre el tiempo.', sample: 'Volvemos enseguida', conditional: true },
      { token: 'countdown.mode', en: 'idle, running, paused or finished.', es: 'idle, running, paused o finished.', sample: 'running', conditional: true },
    ],
  },
  {
    id: 'spotify',
    en: 'Spotify', es: 'Spotify',
    noteEn: 'Always present. Empty when nothing is playing or Spotify is not signed in.',
    noteEs: 'Siempre disponibles. Vacias si no suena nada o Spotify no esta conectado.',
    vars: [
      { token: 'spotify.track', en: 'Song title playing now.', es: 'Titulo de la cancion actual.', sample: 'Blue Monday' },
      { token: 'spotify.artist', en: 'Artist playing now.', es: 'Artista actual.', sample: 'New Order' },
      { token: 'spotify.album', en: 'Album playing now.', es: 'Album actual.' },
      { token: 'spotify.coverUrl', en: 'Cover art URL.', es: 'URL de la portada.' },
      { token: 'spotify.isPlaying', en: 'true / false.', es: 'true / false.', sample: 'true' },
      { token: 'spotify.queuedTrack', en: 'Song a Queue step just added. Put that step BEFORE the message.', es: 'Cancion que un paso de Cola acaba de anadir. Pon ese paso ANTES del mensaje.', conditional: true },
      { token: 'spotify.queuedArtist', en: 'Artist of the queued song.', es: 'Artista de la cancion encolada.', conditional: true },
      { token: 'spotify.queuedAlbum', en: 'Album of the queued song.', es: 'Album de la cancion encolada.', conditional: true },
      { token: 'spotify.queuedUrl', en: 'Spotify link to the queued song.', es: 'Enlace de Spotify a la cancion encolada.', conditional: true },

      { token: 'spotify.nextTrack', en: 'The song Spotify plays after this one. Follows shuffle and playlist order.', es: 'La cancion que Spotify pondra despues de esta. Respeta el aleatorio y el orden de la lista.', sample: 'Burn This City', conditional: true },
      { token: 'spotify.nextArtist', en: 'Artist of the next song.', es: 'Artista de la siguiente cancion.', sample: 'Chetta', conditional: true },
      { token: 'spotify.nextAlbum', en: 'Album of the next song.', es: 'Album de la siguiente cancion.', conditional: true },
      { token: 'spotify.nextCoverUrl', en: 'Cover art URL of the next song.', es: 'URL de la portada de la siguiente cancion.', conditional: true },
      { token: 'spotify.nextUrl', en: 'Spotify link to the next song.', es: 'Enlace de Spotify a la siguiente cancion.', conditional: true },
    ],
  },
  {
    id: 'misc',
    en: 'Other', es: 'Otros',
    vars: [
      { token: 'platform', en: 'Where the trigger came from.', es: 'De donde vino el disparador.', sample: 'twitch' },
      { token: 'random.1-100', en: 'A whole number in that range. Any two numbers work: {random.1-6}.', es: 'Un numero entero en ese rango. Sirve cualquier par: {random.1-6}.', sample: '37' },
      { token: 'event.type', en: 'Which event fired it.', es: 'Que evento lo activo.', sample: 'twitch_raid', conditional: true },
    ],
  },
];

/**
 * Event payloads, keyed by trigger type.
 *
 * Taken from what each platform actually emits. A trigger with no entry here
 * carries no extra fields — the viewer group is all there is.
 */
export const EVENT_VARS: Record<string, Variable[]> = {
  twitch_cheer: [
    { token: 'event.bits', en: 'Bits cheered.', es: 'Bits donados.', sample: '500' },
    { token: 'event.amount', en: 'Same number as bits.', es: 'El mismo numero que bits.', sample: '500' },
    { token: 'event.currency', en: 'Always BITS.', es: 'Siempre BITS.', sample: 'BITS' },
    { token: 'event.message', en: 'Message attached to the cheer.', es: 'Mensaje que acompana al cheer.' },
  ],
  twitch_raid: [
    { token: 'event.viewers', en: 'How many came with the raid.', es: 'Cuantos vinieron en la raid.', sample: '20' },
    { token: 'event.amount', en: 'Same number as viewers.', es: 'El mismo numero que viewers.', sample: '20' },
    { token: 'event.currency', en: 'Always VIEWERS.', es: 'Siempre VIEWERS.', sample: 'VIEWERS' },
  ],
  twitch_sub: [
    { token: 'event.tier', en: 'Sub tier.', es: 'Nivel de suscripcion.', sample: '1000' },
    { token: 'event.months', en: 'Months, on a resub only.', es: 'Meses, solo en resub.', sample: '6', conditional: true },
    { token: 'event.giftedBy', en: 'Who gifted it, on a gift sub only.', es: 'Quien la regalo, solo en sub regalada.', conditional: true },
  ],
  twitch_redemption: [
    { token: 'event.reward', en: 'Reward title.', es: 'Titulo de la recompensa.', sample: 'Hydrate' },
    { token: 'event.rewardName', en: 'Same as {event.reward}.', es: 'Igual que {event.reward}.', sample: 'Hydrate' },
    { token: 'event.rewardId', en: 'Reward id.', es: 'ID de la recompensa.' },
    { token: 'event.cost', en: 'Channel points it cost.', es: 'Puntos de canal que costo.', sample: '500' },
    { token: 'event.input', en: 'What the viewer typed into the reward.', es: 'Lo que el espectador escribio en la recompensa.' },
  ],
  tiktok_gift: [
    { token: 'event.giftName', en: 'Gift name.', es: 'Nombre del regalo.', sample: 'Rose' },
    { token: 'event.count', en: 'How many were sent.', es: 'Cuantos se enviaron.', sample: '5' },
    { token: 'event.diamonds', en: 'Diamond value.', es: 'Valor en diamantes.', sample: '5' },
    { token: 'event.amount', en: 'Same number as diamonds.', es: 'El mismo numero que diamonds.', sample: '5' },
    { token: 'event.currency', en: 'Always DIAMONDS.', es: 'Siempre DIAMONDS.', sample: 'DIAMONDS' },
  ],
  spotify_track_change: [
    { token: 'event.title', en: 'Song that just started.', es: 'Cancion que acaba de empezar.', sample: 'Blue Monday' },
    { token: 'event.artist', en: 'Its artist.', es: 'Su artista.', sample: 'New Order' },
    { token: 'event.album', en: 'Its album.', es: 'Su album.' },
    { token: 'event.coverUrl', en: 'Its cover art URL.', es: 'URL de su portada.' },
  ],
  discord_call_join: [
    { token: 'event.count', en: 'How many are in the call now. {user} is their name on stream.', es: 'Cuántos hay ahora en la llamada. {user} es su nombre en el directo.', sample: '3' },
    { token: 'event.userId', en: 'Their Discord id.', es: 'Su id de Discord.', sample: '306050655881793586' },
  ],
  discord_call_leave: [
    { token: 'event.count', en: 'How many are left in the call. {user} is their name on stream.', es: 'Cuántos quedan en la llamada. {user} es su nombre en el directo.', sample: '2' },
  ],
  discord_call_count: [
    { token: 'event.count', en: 'How many are in the call now.', es: 'Cuántos hay ahora en la llamada.', sample: '4' },
    { token: 'event.previous', en: 'How many there were before.', es: 'Cuántos había antes.', sample: '3' },
  ],
  discord_call_talking: [
    { token: 'event.quietFor', en: 'How long they had been quiet, in milliseconds. {user} is their name on stream.', es: 'Cuánto llevaban callados, en milisegundos. {user} es su nombre en el directo.', sample: '45000' },
  ],
  discord_join: [
    { token: 'event.username', en: 'Their Discord username. {user} is the name they show in the server.', es: 'Su nombre de usuario de Discord. {user} es el nombre que muestran en el servidor.', sample: 'nuevo_123' },
    { token: 'event.accountAge', en: 'How old their account is.', es: 'La edad de su cuenta.', sample: '2 años' },
    { token: 'event.created', en: 'When their account was made.', es: 'Cuándo creó su cuenta.', sample: '1 de julio de 2024' },
    { token: 'event.count', en: 'How many are in the server now.', es: 'Cuántos hay ahora en el servidor.', sample: '54' },
  ],
  discord_boost: [
    { token: 'event.username', en: 'Their Discord username. {user} is the name they show in the server.', es: 'Su nombre de usuario de Discord. {user} es el nombre que muestran en el servidor.', sample: 'booster' },
    { token: 'event.boosts', en: 'How many boosts the server has now.', es: 'Cuántos boosts tiene ahora el servidor.', sample: '3' },
    { token: 'event.accountAge', en: 'How old their account is.', es: 'La edad de su cuenta.', sample: '2 años' },
  ],
  layout_changed: [
    { token: 'event.name', en: 'The layout that went live.', es: 'El layout que salió en vivo.', sample: 'SimonSays - Game 16:9' },
    { token: 'event.from', en: 'The layout that was live before it.', es: 'El layout que estaba en vivo antes.', sample: 'SimonSays - Starting' },
  ],
  countdown_finished: [
    { token: 'event.label', en: 'The label the countdown was showing.', es: 'La etiqueta que mostraba la cuenta atras.', sample: 'STARTING SOON' },
    { token: 'event.name', en: 'The saved timer it was, by its name. Empty if none was loaded.', es: 'El temporizador guardado que era, por su nombre. Vacio si no habia ninguno cargado.', sample: 'Starting soon' },
  ],
  poll_opened: [
    { token: 'event.question', en: 'The question being asked. Also in {user}.', es: 'La pregunta que se hace. Tambien en {user}.', sample: 'Quien es el impostor?' },
    { token: 'event.answers', en: 'The answers, split by " / ".', es: 'Las respuestas, separadas por " / ".', sample: 'Rojo / Azul / Verde' },
    { token: 'event.count', en: 'How many answers there are.', es: 'Cuantas respuestas hay.', sample: '3' },
    { token: 'event.seconds', en: 'How long it runs, in seconds. 0 is until it is closed.', es: 'Cuanto dura, en segundos. 0 es hasta que se cierre.', sample: '60' },
  ],
  giveaway_winner: [
    { token: 'event.prize', en: 'What they won. {user} is the winner.', es: 'Lo que ganaron. {user} es quien ganó.', sample: 'Un juego de Steam' },
    { token: 'event.entrants', en: 'How many entered.', es: 'Cuántos participaron.', sample: '42' },
    { token: 'event.reroll', en: 'true when drawn again after a reroll.', es: 'true si salió en un nuevo sorteo.', sample: 'false' },
  ],
  chat_highlight: [
    { token: 'event.count', en: 'Messages in that minute, every platform together.', es: 'Mensajes en ese minuto, todas las plataformas juntas.', sample: '42' },
    { token: 'event.ratio', en: 'How many times the usual pace.', es: 'Cuántas veces el ritmo de siempre.', sample: '3.5' },
    { token: 'event.usual', en: 'The usual pace, messages a minute.', es: 'El ritmo de siempre, mensajes por minuto.', sample: '12' },
  ],
  points_redeem: [
    { token: 'event.item', en: 'The reward they bought. {user} is who.', es: 'La recompensa que compraron. {user} es quien.', sample: 'TTS' },
    { token: 'event.cost', en: 'What it cost.', es: 'Lo que costó.', sample: '200' },
    { token: 'event.input', en: 'The words they gave with it, if it asks for any.', es: 'El texto que dieron, si la recompensa lo pide.', sample: 'hola chat' },
    { token: 'event.balance', en: 'What they have left.', es: 'Lo que les queda.', sample: '1350' },
  ],
  level_up: [
    { token: 'event.level', en: 'The level they reached.', es: 'El nivel que alcanzaron.', sample: '5' },
    { token: 'event.xp', en: 'Their XP now.', es: 'Su XP ahora.', sample: '2500' },
    { token: 'event.rank', en: 'Their place among the chatters.', es: 'Su puesto entre los del chat.', sample: '3' },
  ],
  poll_closed: [
    { token: 'event.winner', en: 'The winning answer. A tie names each answer, split by " / ". Also in {user}.', es: 'La respuesta ganadora. Un empate nombra cada respuesta, separadas por " / ". Tambien en {user}.', sample: 'Rojo' },
    { token: 'event.question', en: 'The question that was asked.', es: 'La pregunta que se hizo.', sample: 'Quien es el impostor?' },
    { token: 'event.votes', en: 'How many votes it got in all.', es: 'Cuantos votos tuvo en total.', sample: '25' },
    { token: 'event.tie', en: 'true when answers tied for first.', es: 'true si hubo empate en el primer puesto.', sample: 'false' },
  ],
};

interface VariablePickerProps {
  open: boolean;
  onClose: () => void;
  /** Current trigger type, so its own event fields can be listed first. */
  triggerType?: string;
  /** Human label for that trigger, for the context line. */
  triggerLabel?: string;
  t: any;
}

export const VariablePicker: React.FC<VariablePickerProps> = ({ open, onClose, triggerType, triggerLabel, t }) => {
  const [query, setQuery] = useState('');
  /** Which row was last pressed, and whether the copy actually succeeded. */
  const [copied, setCopied] = useState<{ token: string; ok: boolean } | null>(null);
  const lang: Lang = t?.lang === 'es' ? 'es' : 'en';

  const eventVars = triggerType ? EVENT_VARS[triggerType] : undefined;
  const isCommand = triggerType === 'command_trigger';

  /** Everything, with this trigger's own event fields promoted to the top. */
  const groups = useMemo(() => {
    const base: Group[] = [];
    if (eventVars?.length) {
      base.push({ id: 'this-event', en: 'From this trigger', es: 'De este disparador', vars: eventVars });
    }
    // The command group is noise on an event trigger, and vice versa.
    for (const g of VARIABLE_GROUPS) {
      if (g.id === 'command' && triggerType && !isCommand) continue;
      base.push(g);
    }
    const q = query.trim().toLowerCase();
    if (!q) return base;
    return base
      .map((g) => ({ ...g, vars: g.vars.filter((v) => `${v.token} ${v[lang]}`.toLowerCase().includes(q)) }))
      .filter((g) => g.vars.length > 0);
  }, [query, eventVars, triggerType, isCommand, lang]);

  if (!open) return null;

  /**
   * A tick that appears whether or not the text was copied is worse than no
   * tick, so the result of the copy decides what the row shows. When it does
   * fail, the token is selected in place so Ctrl+C still works.
   */
  const copy = (token: string, el: HTMLElement) => {
    const ok = copyText(`{${token}}`);
    if (!ok) {
      const code = el.querySelector('code');
      if (code) {
        const range = document.createRange();
        range.selectNodeContents(code);
        const sel = window.getSelection();
        sel?.removeAllRanges();
        sel?.addRange(range);
      }
    }
    setCopied({ token, ok });
    setTimeout(() => setCopied((c) => (c?.token === token ? null : c)), ok ? 1200 : 4000);
  };

  const totalShown = groups.reduce((n, g) => n + g.vars.length, 0);

  return (
    <div className="fixed inset-0 z-[120] flex items-center justify-center p-4 sm:p-6 bg-black/80 backdrop-blur-sm animate-fade-in">
      <div className="max-w-2xl w-full max-h-[85vh] glass-panel rounded-[40px] border border-zinc-800 bg-zinc-950 shadow-2xl flex flex-col overflow-hidden">

        <div className="p-6 border-b border-zinc-800 bg-zinc-950/50 flex justify-between items-center shrink-0">
          <div className="flex items-center gap-3 min-w-0">
            <div className="p-2 bg-current-accent/10 rounded-xl text-current-accent shrink-0"><Braces size={20} /></div>
            <div className="min-w-0">
              <h2 className="text-xl font-black uppercase tracking-tight truncate">{t.variables || 'Variables'}</h2>
              <p className="text-[10px] font-bold text-zinc-500 truncate">{t.variablesHint}</p>
            </div>
          </div>
          <button onClick={onClose} className="text-zinc-500 hover:text-white transition-colors shrink-0"><X size={20} /></button>
        </div>

        <div className="px-6 pt-4 pb-2 shrink-0 space-y-3">
          <div className="relative">
            <Search size={14} className="absolute left-4 top-1/2 -translate-y-1/2 text-zinc-600" />
            <input
              autoFocus
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder={t.variablesSearch}
              className="w-full bg-zinc-900 border border-zinc-800 rounded-xl pl-10 pr-4 py-2.5 text-xs font-bold text-white outline-none focus:border-current-accent"
            />
          </div>
          {triggerLabel && (
            <p className="text-[10px] font-bold text-zinc-600">
              {t.variablesForTrigger} <span className="text-current-accent">{triggerLabel}</span>
            </p>
          )}
        </div>

        <div className="flex-1 min-h-0 overflow-y-auto px-6 pb-6 space-y-6">
          {totalShown === 0 && (
            <p className="text-xs text-zinc-600 text-center py-10">{t.variablesNone}</p>
          )}

          {groups.map((g) => (
            <div key={g.id}>
              <h3 className="text-[10px] font-black uppercase tracking-widest text-zinc-500 mb-1">{g[lang]}</h3>
              {(lang === 'es' ? g.noteEs : g.noteEn) && (
                <p className="text-[10px] text-zinc-600 mb-2 leading-relaxed flex items-start gap-1.5">
                  <AlertTriangle size={11} className="mt-0.5 shrink-0 text-amber-600/70" />
                  <span>{lang === 'es' ? g.noteEs : g.noteEn}</span>
                </p>
              )}
              <div className="space-y-1">
                {g.vars.map((v) => (
                  <button
                    key={g.id + v.token}
                    onClick={(e) => copy(v.token, e.currentTarget)}
                    title={t.variablesCopy}
                    className="w-full text-left bg-zinc-900/40 hover:bg-zinc-900 border border-zinc-800/60 hover:border-current-accent/50 rounded-xl px-3 py-2 transition-all flex items-center gap-3 group"
                  >
                    <code className="text-[11px] font-mono font-bold text-current-accent shrink-0 select-all">{`{${v.token}}`}</code>
                    <span className="text-[10px] text-zinc-500 flex-1 min-w-0 truncate">
                      {copied?.token === v.token && !copied.ok ? t.variablesCopyFailed : v[lang]}
                    </span>
                    {v.sample && <span className="text-[9px] font-mono text-zinc-700 shrink-0 hidden sm:inline">{`-> ${v.sample}`}</span>}
                    {v.conditional && <span className="w-1.5 h-1.5 rounded-full bg-amber-600/60 shrink-0" title={t.variablesConditional} />}
                    <span className="shrink-0 text-zinc-700 group-hover:text-current-accent">
                      {copied?.token === v.token
                        ? (copied.ok ? <Check size={12} className="text-green-500" /> : <AlertTriangle size={12} className="text-amber-500" />)
                        : <Copy size={12} />}
                    </span>
                  </button>
                ))}
              </div>
            </div>
          ))}

          <p className="text-[10px] text-zinc-600 leading-relaxed border-t border-zinc-800/50 pt-4">
            <span className="inline-block w-1.5 h-1.5 rounded-full bg-amber-600/60 mr-1.5 align-middle" />
            {t.variablesConditional}
          </p>
        </div>
      </div>
    </div>
  );
};
