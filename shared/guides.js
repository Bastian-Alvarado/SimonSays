/**
 * @license
 * SPDX-License-Identifier: Apache-2.0 AND LicenseRef-Commons-Clause-1.0
 *
 * The Guides tab: what a streamer new to the app reads to get from nothing
 * to a stream, and comes back to when they want to do something new.
 *
 *   - SETUP_CHECKS, setup steps that tick themselves from what the app can see
 *     (an account connected, the stream page open in OBS, a layout made…),
 *     each with why it matters and a way there.
 *   - GUIDES, one per task, as steps with a way to the screen each is done
 *     on and a last line saying how to know it worked.
 *   - GLOSSARY, the app's own words.
 *   - BUILTIN_WORDS, the chat words that work without making a command,
 *     read from the live settings so a word that was changed shows changed.
 *
 * Text, not pictures: a screenshot is out of date the day a screen changes,
 * and these name the screens and buttons through the app's own words, so a
 * renamed button is renamed here too. In a step:
 *
 *   {screen:<view>}  the screen's name in the menu, in the reader's language
 *   {t:<key>}        a button or field, by its word in web/constants.ts
 *   {url:<mode>}     the address of a page for OBS: canvas, dock or alerts
 *   {redirect:<kind>} the address a platform signs in back to: page or loopback
 *
 * Anything else in braces ({user}, {input}) is left as it is, to be read.
 * The smoke test (server/scripts/smoke/guides.js) holds every screen, key
 * and guide named here to one that exists, in both languages.
 */

const connected = (s, k) => s?.status?.[k] === 'connected';
const list = (v) => (Array.isArray(v) ? v : []);

/**
 * The setup steps, in the order they are best done. `done` reads what the
 * app knows: `{ status, data }`, as the web app holds them. `sticky` keeps a
 * tick once seen, for what is only true while something is open (OBS has
 * the stream page only while OBS runs, an account is connected only while
 * it is up); `manual` is ticked by hand, for what the app cannot see.
 * `optional` is not counted as left to do. `setup` is the platform
 * walkthrough (PLATFORM_SETUPS) its "Show me how" opens.
 *
 * Not the pre-stream checklist taken out on 2026-09-28: these are done once,
 * tick themselves, and keep nothing on the server.
 */
export const SETUP_CHECKS = [
  {
    id: 'platform', go: 'gallery', guide: 'connect', setup: 'twitch', sticky: true,
    done: (s) => ['twitch', 'youtube', 'tiktok'].some((k) => connected(s, k)),
    en: { title: 'Connect where you stream', why: 'Twitch, YouTube or TikTok: chat, follows, subs and raids reach the app from there.' },
    es: { title: 'Conecta donde transmites', why: 'Twitch, YouTube o TikTok: el chat, los follows, las subs y los raids llegan a la app desde ahí.' },
  },
  {
    id: 'obs', go: 'gallery', guide: 'connect', setup: 'obs', sticky: true,
    done: (s) => connected(s, 'obs'),
    en: { title: 'Connect OBS', why: 'So the app can switch scenes, move your game and camera into place and know what is on stream.' },
    es: { title: 'Conecta OBS', why: 'Para que la app cambie escenas, coloque tu juego y tu cámara y sepa qué hay en directo.' },
  },
  {
    id: 'stream-page', guide: 'obs-pages', sticky: true,
    done: (s) => Number(s?.data?.surfaces?.canvasInObs) > 0,
    en: { title: 'Put the stream page in OBS', why: 'One browser source draws everything the app puts on stream. Ticked the moment OBS opens it.' },
    es: { title: 'Pon la página del directo en OBS', why: 'Una fuente de navegador dibuja todo lo que la app pone en directo. Se marca en cuanto OBS la abre.' },
  },
  {
    id: 'layout', go: 'layouts', guide: 'layouts',
    done: (s) => list(s?.data?.layouts).length > 0,
    en: { title: 'Make a layout', why: 'A layout is one screen of your stream: chat, alerts, bars and the rest, where you want them.' },
    es: { title: 'Crea un diseño', why: 'Un diseño es una pantalla de tu directo: chat, alertas, barras y lo demás, donde los quieras.' },
  },
  {
    id: 'layout-on', go: 'layouts', guide: 'layouts',
    done: (s) => list(s?.data?.layouts).some((l) => list(l?.scenes).length > 0) || Boolean(s?.data?.omnilayer?.enabled),
    en: { title: 'Say when each layout shows', why: 'Bind layouts to OBS scenes, or turn on Omnilayer and let the app switch them.' },
    es: { title: 'Indica cuándo sale cada diseño', why: 'Vincula los diseños a escenas de OBS, o enciende Omnilayer y deja que la app los cambie.' },
  },
  {
    id: 'alerts', go: 'alerts', guide: 'alerts',
    done: (s) => list(s?.data?.alertConfigs).some((a) => a?.enabled),
    en: { title: 'Turn on an alert', why: 'A follow or a sub on screen, with its picture and sound.' },
    es: { title: 'Activa una alerta', why: 'Un follow o una sub en pantalla, con su imagen y su sonido.' },
  },
  {
    id: 'command', go: 'actions', guide: 'first-command',
    done: (s) => list(s?.data?.streamActions).some((a) => a?.trigger?.category === 'command'),
    en: { title: 'Answer a chat command', why: 'A word chat types and what the app does about it: the start of every automation.' },
    es: { title: 'Responde a un comando del chat', why: 'Una palabra que escribe el chat y lo que la app hace con ella: el comienzo de toda automatización.' },
  },
  {
    id: 'dock', guide: 'obs-pages', sticky: true, optional: true,
    done: (s) => Number(s?.data?.surfaces?.dockInObs) > 0,
    en: { title: 'Add the chat dock to OBS', why: 'Every chat in one place, and your buttons, beside the stream preview.' },
    es: { title: 'Añade el dock de chat a OBS', why: 'Todos los chats en un sitio, y tus botones, junto a la vista previa.' },
  },
  {
    id: 'bot', go: 'gallery', guide: 'connect', setup: 'twitch-bot', sticky: true, optional: true,
    done: (s) => connected(s, 'twitchBot'),
    en: { title: 'Connect a bot account', why: 'So the app’s messages in chat come from the bot rather than from you.' },
    es: { title: 'Conecta una cuenta de bot', why: 'Para que los mensajes de la app en el chat salgan del bot y no de ti.' },
  },
  {
    id: 'discord', go: 'gallery', guide: 'discord', setup: 'discord', sticky: true, optional: true,
    done: (s) => connected(s, 'discord'),
    en: { title: 'Connect your Discord server', why: 'Welcomes, roles, go-live posts, and commands that work there too.' },
    es: { title: 'Conecta tu servidor de Discord', why: 'Bienvenidas, roles, avisos de directo, y comandos que también funcionan ahí.' },
  },
  {
    id: 'backup', go: 'settings', guide: 'backup', manual: true, optional: true,
    done: () => false,
    en: { title: 'Save a backup', why: 'Everything you set up, in one file, for a bad day or a new computer. Tick it when you have one.' },
    es: { title: 'Guarda una copia de seguridad', why: 'Todo lo que configuraste, en un archivo, para un mal día o un ordenador nuevo. Márcalo cuando la tengas.' },
  },
];

/**
 * Each platform, step by step, for somebody who has never made a developer
 * app: what it is for, what goes in the app and where each piece comes
 * from, the steps on the platform's own site, how to know it worked, and
 * what to do when it does not. On the Start here tab, where the first
 * setup steps send people.
 *
 * `state(s)` is 'on', 'waiting' (set up, waiting for the stream) or 'off'.
 * `fields` are the boxes on the Connections screen, by the app's own word
 * for each, with where the value is found; `secret` ones are passwords.
 * In a step, {redirect:page} is the address to register for a sign-in that
 * comes back to this page (Twitch, Discord), and {redirect:loopback} the
 * same with 127.0.0.1 for localhost (Spotify and Google refuse "localhost"
 * or take only that) — both written for the computer the app runs on.
 *
 * Checked against each site's rules on 2026-10-06: Twitch takes plain http
 * only for localhost and wants two-factor sign-in on to register an app;
 * Spotify refuses "localhost" and takes http only for 127.0.0.1; Google
 * takes no raw addresses but localhost ones, and signs a Testing app out
 * after 7 days.
 */
export const PLATFORM_SETUPS = [
  {
    id: 'twitch', color: '#9146FF', portal: 'https://dev.twitch.tv/console/apps', minutes: 5, localOnly: true,
    state: (s) => (connected(s, 'twitch') ? 'on' : 'off'),
    fields: [
      { t: 'twitchClientId', en: 'Your app on dev.twitch.tv → Manage → Client ID. Not a secret.', es: 'Tu app en dev.twitch.tv → Manage → Client ID. No es secreto.' },
    ],
    en: {
      name: 'Twitch',
      for: 'Chat, follows, subs, raids and channel points, and changing your title and category.',
      worked: '{screen:gallery} shows your Twitch name and picture, and the Twitch mark at the bottom of the menu lights up.',
    },
    es: {
      name: 'Twitch',
      for: 'El chat, los follows, las subs, los raids y los puntos del canal, y cambiar tu título y categoría.',
      worked: '{screen:gallery} muestra tu nombre y tu foto de Twitch, y la marca de Twitch al pie del menú se enciende.',
    },
    steps: [
      { en: 'Turn on two-factor authentication for your Twitch account: twitch.tv → Settings → Security and Privacy. Twitch won’t let you register an app without it.',
        es: 'Activa la verificación en dos pasos de tu cuenta de Twitch: twitch.tv → Configuración → Seguridad y privacidad. Twitch no te deja registrar una app sin ella.' },
      { en: 'Open dev.twitch.tv/console/apps, sign in with your streaming account, and press “Register Your Application”.',
        es: 'Abre dev.twitch.tv/console/apps, entra con tu cuenta de streaming y pulsa “Register Your Application”.' },
      { en: 'Name: anything nobody else has used, like “YourName Stream App”. OAuth Redirect URLs: paste {redirect:page} and press Add. Category: Chat Bot. Leave the rest as it is, and press Create.',
        es: 'Name: cualquier nombre que nadie más use, como “TuNombre Stream App”. OAuth Redirect URLs: pega {redirect:page} y pulsa Add. Category: Chat Bot. Deja lo demás como está y pulsa Create.' },
      { en: 'Press Manage on the app you made and copy its Client ID. That is all the app needs — not the client secret.',
        es: 'Pulsa Manage en la app que creaste y copia su Client ID. Es todo lo que necesita la app — no el client secret.' },
      { go: 'gallery',
        en: 'On {screen:gallery}, paste it into {t:twitchClientId} and press {t:twitchLogin}. Check that Twitch shows your streaming account, then Authorize.',
        es: 'En {screen:gallery}, pégalo en {t:twitchClientId} y pulsa {t:twitchLogin}. Comprueba que Twitch muestra tu cuenta de streaming y pulsa Autorizar.' },
    ],
    problems: [
      { en: '“redirect_mismatch” or “Invalid redirect URI”: the address in your Twitch app must be the one above exactly — http, localhost, the port, and the slash at the end.',
        es: '“redirect_mismatch” o “Invalid redirect URI”: la dirección de tu app de Twitch debe ser exactamente la de arriba — http, localhost, el puerto y la barra del final.' },
      { en: '“Redirect URIs must use HTTPS”: Twitch takes a plain http:// address only for localhost. Sign in on the computer the app runs on, as the note above says.',
        es: '“Redirect URIs must use HTTPS”: Twitch solo acepta una dirección http:// para localhost. Conéctate desde el ordenador donde corre la app, como dice la nota de arriba.' },
      { en: 'It signed in the wrong account: Twitch uses whoever is signed in on twitch.tv in that browser. Sign out there, or use a private window.',
        es: 'Se conectó la cuenta equivocada: Twitch usa la que tenga la sesión abierta en twitch.tv en ese navegador. Cierra la sesión ahí, o usa una ventana privada.' },
    ],
  },
  {
    id: 'twitch-bot', color: '#9146FF', portal: null, minutes: 5, optional: true,
    state: (s) => (connected(s, 'twitchBot') ? 'on' : 'off'),
    fields: [],
    en: {
      name: 'Twitch bot account',
      for: 'Optional: the app’s messages in chat come from a bot instead of from you.',
      worked: '{screen:gallery} shows the bot under {t:botAccount}.',
    },
    es: {
      name: 'Cuenta de bot de Twitch',
      for: 'Opcional: los mensajes de la app en el chat salen de un bot en vez de ti.',
      worked: '{screen:gallery} muestra el bot en {t:botAccount}.',
    },
    steps: [
      { en: 'Make a second Twitch account for the bot, with the name chat should see. Connect your main account first: the bot uses the same Client ID, so there is nothing new to register.',
        es: 'Crea una segunda cuenta de Twitch para el bot, con el nombre que debe ver el chat. Conecta antes tu cuenta principal: el bot usa el mismo Client ID, así que no hay que registrar nada nuevo.' },
      { en: 'On the computer the app runs on, open the app in a private (incognito) window, and sign in to twitch.tv there as the bot.',
        es: 'En el ordenador donde corre la app, ábrela en una ventana privada (incógnito) y entra en twitch.tv ahí con la cuenta del bot.' },
      { go: 'gallery',
        en: 'In that window, on {screen:gallery}, press {t:connectBotBtn} and Authorize as the bot. Then close the private window: nothing was kept in it.',
        es: 'En esa ventana, en {screen:gallery}, pulsa {t:connectBotBtn} y autoriza como el bot. Luego cierra la ventana privada: no se guardó nada en ella.' },
      { en: 'Make the bot a moderator of your channel: type /mod and its name in your chat. Then chat’s limits don’t slow it down.',
        es: 'Haz al bot moderador de tu canal: escribe /mod y su nombre en tu chat. Así los límites del chat no lo frenan.' },
    ],
    problems: [
      { en: 'It connected your main account as the bot: that window was still signed in as you. Sign out of twitch.tv in it, or start a fresh private window.',
        es: 'Conectó tu cuenta principal como bot: esa ventana seguía con tu sesión. Cierra la sesión de twitch.tv en ella, o abre otra ventana privada.' },
    ],
  },
  {
    id: 'youtube', color: '#FF0000', portal: 'https://console.cloud.google.com/', minutes: 15, localOnly: true,
    state: (s) => (connected(s, 'youtube') ? 'on' : 'off'),
    fields: [
      { t: 'youtubeClientId', en: 'Google Cloud → Clients → your web client → Client ID.', es: 'Google Cloud → Clientes → tu cliente web → ID de cliente.' },
      { t: 'youtubeClientSecret', secret: true, en: 'Shown when you make the client. Copy it then: Google may not show it again (you can add a new one).', es: 'Se muestra al crear el cliente. Cópialo en ese momento: puede que Google no lo vuelva a mostrar (puedes crear otro).' },
    ],
    en: {
      name: 'YouTube',
      for: 'YouTube chat, members, gifted memberships and Super Chats, and changing your title and description.',
      worked: '{screen:gallery} shows your channel. While you are not live it says it is waiting for a broadcast — that is normal.',
    },
    es: {
      name: 'YouTube',
      for: 'El chat de YouTube, miembros, membresías regaladas y Super Chats, y cambiar tu título y descripción.',
      worked: '{screen:gallery} muestra tu canal. Mientras no estás en directo dice que espera una emisión — es normal.',
    },
    steps: [
      { en: 'Open console.cloud.google.com with the Google account that owns your channel, and make a new project (the project picker at the top → New project). Any name.',
        es: 'Abre console.cloud.google.com con la cuenta de Google dueña de tu canal y crea un proyecto nuevo (el selector de proyectos de arriba → Proyecto nuevo). Cualquier nombre.' },
      { en: 'APIs & Services → Library: find “YouTube Data API v3” and press Enable.',
        es: 'APIs y servicios → Biblioteca: busca “YouTube Data API v3” y pulsa Habilitar.' },
      { en: 'Google Auth Platform (the OAuth consent screen): Get started. Give it a name and your email, choose External, and finish. Then, under Audience, press “Publish app” so it is In production — in Testing, Google signs you out every 7 days.',
        es: 'Google Auth Platform (la pantalla de consentimiento de OAuth): Comenzar. Dale un nombre y tu correo, elige Externo y termina. Después, en Público, pulsa “Publicar app” para que quede En producción — en Prueba, Google te desconecta cada 7 días.' },
      { en: 'Clients → Create client. Application type: Web application. Under “Authorised redirect URIs” — not JavaScript origins — add {redirect:loopback}, slash at the end included. Create, and copy the Client ID and the Client secret.',
        es: 'Clientes → Crear cliente. Tipo de aplicación: Aplicación web. En “URI de redireccionamiento autorizados” — no en orígenes de JavaScript — añade {redirect:loopback}, con la barra del final. Crea y copia el ID de cliente y el secreto de cliente.' },
      { go: 'gallery',
        en: 'On {screen:gallery}, paste them into the YouTube {t:youtubeClientId} and {t:youtubeClientSecret}, press {t:youtubeLogin} with your channel’s account, and allow it.',
        es: 'En {screen:gallery}, pégalos en {t:youtubeClientId} y {t:youtubeClientSecret} de YouTube, pulsa {t:youtubeLogin} con la cuenta de tu canal y permítelo.' },
    ],
    problems: [
      { en: '“Google hasn’t verified this app”: it is your own app, so that is expected. Press Advanced, then “Go to” your app’s name.',
        es: '“Google no ha verificado esta aplicación”: es tu propia app, así que es lo esperado. Pulsa Configuración avanzada y luego “Ir a” el nombre de tu app.' },
      { en: '“redirect_uri_mismatch”: the address must be under Authorised redirect URIs, character for character: 127.0.0.1, the port, the slash at the end.',
        es: '“redirect_uri_mismatch”: la dirección debe estar en URI de redireccionamiento autorizados, letra por letra: 127.0.0.1, el puerto y la barra del final.' },
      { en: '“Access blocked” or signed out after a week: the app is still in Testing. Publish it (Audience → Publish app) and sign in again.',
        es: '“Acceso bloqueado” o desconectado a la semana: la app sigue en Prueba. Publícala (Público → Publicar app) y vuelve a conectarte.' },
    ],
  },
  {
    id: 'tiktok', color: '#ff0050', portal: null, minutes: 2,
    state: (s) => (connected(s, 'tiktok') ? 'on' : ['polling', 'waiting'].includes(s?.status?.tiktok) ? 'waiting' : 'off'),
    fields: [
      { t: 'tiktokUsername', en: 'Your TikTok username, without the @.', es: 'Tu usuario de TikTok, sin la @.' },
      { t: 'tiktokSignKey', secret: true, en: 'Optional: a free API key from eulerstream.com.', es: 'Opcional: una API key gratis de eulerstream.com.' },
    ],
    en: {
      name: 'TikTok LIVE',
      for: 'TikTok LIVE chat, gifts, likes and follows. No developer app to make.',
      worked: '{screen:gallery} shows TikTok online while you are live there.',
    },
    es: {
      name: 'TikTok LIVE',
      for: 'El chat, los regalos, los likes y los follows de TikTok LIVE. Sin app de desarrollador que crear.',
      worked: '{screen:gallery} muestra TikTok en línea mientras estás en directo ahí.',
    },
    steps: [
      { go: 'gallery',
        en: 'On {screen:gallery}, type your username into {t:tiktokUsername} and press {t:connect}.',
        es: 'En {screen:gallery}, escribe tu usuario en {t:tiktokUsername} y pulsa {t:connect}.' },
      { en: 'That’s it: from then on the app looks for your TikTok LIVE by itself once your stream starts — nothing to press each time.',
        es: 'Eso es todo: desde entonces la app busca tu TikTok LIVE sola cuando empieza tu directo — nada que pulsar cada vez.' },
      { go: 'gallery',
        en: 'Optional: a free key from eulerstream.com in {t:tiktokSignKey} makes connecting quicker and steadier; without one TikTok goes through a shared allowance.',
        es: 'Opcional: una clave gratis de eulerstream.com en {t:tiktokSignKey} hace que conecte más rápido y estable; sin ella TikTok pasa por una cuota compartida.' },
    ],
    problems: [
      { en: 'Not connecting while you are live: TikTok lets the app in only once the LIVE has started — give it a minute. Check the username has no @ and no spaces.',
        es: 'No conecta mientras estás en directo: TikTok deja entrar a la app solo cuando el LIVE ya empezó — dale un minuto. Comprueba que el usuario no lleva @ ni espacios.' },
    ],
  },
  {
    id: 'obs', color: '#a1a1aa', portal: null, minutes: 3,
    state: (s) => (connected(s, 'obs') ? 'on' : 'off'),
    fields: [
      { t: 'serverHost', en: 'localhost when OBS is on the same computer as the app; otherwise the address OBS shows under “Show Connect Info”.', es: 'localhost si OBS está en el mismo ordenador que la app; si no, la dirección que OBS muestra en “Mostrar información de conexión”.' },
      { t: 'serverPort', en: '4455, unless you changed it in OBS.', es: '4455, salvo que lo cambiaras en OBS.' },
      { t: 'serverPassword', secret: true, en: 'OBS → Tools → WebSocket Server Settings → Show Connect Info.', es: 'OBS → Herramientas → Configuración del servidor WebSocket → Mostrar información de conexión.' },
    ],
    en: {
      name: 'OBS',
      for: 'Switching scenes, moving your game and camera into place (Omnilayer), remote players, and sources from actions.',
      worked: '{screen:gallery} says {t:obsConnected}, with your scenes listed.',
    },
    es: {
      name: 'OBS',
      for: 'Cambiar escenas, colocar tu juego y tu cámara (Omnilayer), jugadores remotos, y fuentes desde acciones.',
      worked: '{screen:gallery} dice {t:obsConnected}, con tus escenas listadas.',
    },
    steps: [
      { en: 'In OBS (version 28 or newer), open Tools → WebSocket Server Settings.',
        es: 'En OBS (versión 28 o más nueva), abre Herramientas → Configuración del servidor WebSocket.' },
      { en: 'Tick “Enable WebSocket server”. Leave the port at 4455 and authentication on. Press “Show Connect Info”, copy the Server Password, and press OK.',
        es: 'Marca “Habilitar servidor WebSocket”. Deja el puerto en 4455 y la autenticación activada. Pulsa “Mostrar información de conexión”, copia la contraseña del servidor y pulsa Aceptar.' },
      { go: 'gallery',
        en: 'On {screen:gallery}, fill in {t:serverHost}, {t:serverPort} and {t:serverPassword} as shown above, and connect.',
        es: 'En {screen:gallery}, rellena {t:serverHost}, {t:serverPort} y {t:serverPassword} como se indica arriba, y conecta.' },
      { en: 'If the app runs on another device, Windows may ask whether OBS may be reached on your network: allow it for private networks.',
        es: 'Si la app corre en otro dispositivo, Windows puede preguntar si OBS puede recibir conexiones de tu red: permítelo en redes privadas.' },
    ],
    problems: [
      { en: '“Authentication failed”: the password was copied with a space, or changed in OBS. Copy it again from Show Connect Info.',
        es: '“Authentication failed”: la contraseña se copió con un espacio, o se cambió en OBS. Cópiala otra vez de Mostrar información de conexión.' },
      { en: 'It can’t reach OBS from another device: use the address Show Connect Info gives, and check both are on the same network.',
        es: 'No llega a OBS desde otro dispositivo: usa la dirección que da Mostrar información de conexión, y comprueba que los dos están en la misma red.' },
    ],
  },
  {
    id: 'discord', color: '#5865F2', portal: 'https://discord.com/developers/applications', minutes: 10, optional: true,
    state: (s) => (connected(s, 'discord') ? 'on' : 'off'),
    fields: [
      { t: 'discordClientId', en: 'Developer portal → your application → OAuth2 → Client ID. Not a secret.', es: 'Portal de desarrolladores → tu aplicación → OAuth2 → Client ID. No es secreto.' },
      { t: 'discordBotToken', secret: true, en: 'Bot → Reset Token. Discord shows it once.', es: 'Bot → Reset Token. Discord lo muestra una sola vez.' },
      { t: 'discordClientSecret', secret: true, en: 'OAuth2 → Reset Secret.', es: 'OAuth2 → Reset Secret.' },
    ],
    en: {
      name: 'Discord',
      for: 'Optional: welcome messages, role menus, go-live posts, levels, and your commands working in your server.',
      worked: 'The bot shows as online in your server’s member list, and {screen:gallery} lists your server’s channels.',
    },
    es: {
      name: 'Discord',
      for: 'Opcional: mensajes de bienvenida, menús de roles, avisos de directo, niveles, y tus comandos funcionando en tu servidor.',
      worked: 'El bot aparece en línea en la lista de miembros de tu servidor, y {screen:gallery} lista los canales de tu servidor.',
    },
    steps: [
      { en: 'Open discord.com/developers/applications, press “New Application”, give it the name your bot should have, and accept the terms.',
        es: 'Abre discord.com/developers/applications, pulsa “New Application”, ponle el nombre que debe tener tu bot y acepta las condiciones.' },
      { en: 'Bot page: press “Reset Token” and copy the token. Further down, under Privileged Gateway Intents, turn on “Server Members Intent” and “Message Content Intent”, and save.',
        es: 'Página Bot: pulsa “Reset Token” y copia el token. Más abajo, en Privileged Gateway Intents, activa “Server Members Intent” y “Message Content Intent”, y guarda.' },
      { en: 'OAuth2 page: copy the Client ID, press “Reset Secret” and copy the Client Secret. Under Redirects, add {redirect:page}, and save.',
        es: 'Página OAuth2: copia el Client ID, pulsa “Reset Secret” y copia el Client Secret. En Redirects, añade {redirect:page} y guarda.' },
      { en: 'Invite the bot: OAuth2 → URL Generator, tick “bot”, then the permissions Manage Roles, Manage Events, View Channels, Send Messages, Embed Links, Attach Files, Read Message History, Mention Everyone, Add Reactions, Use External Emojis, Manage Messages and Connect. Open the link it makes, choose your server, and Authorize.',
        es: 'Invita al bot: OAuth2 → URL Generator, marca “bot” y luego los permisos Manage Roles, Manage Events, View Channels, Send Messages, Embed Links, Attach Files, Read Message History, Mention Everyone, Add Reactions, Use External Emojis, Manage Messages y Connect. Abre el enlace que genera, elige tu servidor y autoriza.' },
      { go: 'gallery',
        en: 'On {screen:gallery}, paste the {t:discordClientId}, {t:discordBotToken} and {t:discordClientSecret}, press {t:discordLogin}, then choose your server and the channel the bot talks in.',
        es: 'En {screen:gallery}, pega el {t:discordClientId}, el {t:discordBotToken} y el {t:discordClientSecret}, pulsa {t:discordLogin}, y elige tu servidor y el canal donde habla el bot.' },
      { en: 'In Discord: Server Settings → Roles, drag the bot’s role above every role it should hand out (levels, subs, role menus). Discord won’t let it give a role above its own.',
        es: 'En Discord: Ajustes del servidor → Roles, arrastra el rol del bot por encima de cada rol que deba dar (niveles, subs, menús de roles). Discord no le deja dar un rol por encima del suyo.' },
    ],
    problems: [
      { en: 'The bot never comes online, or the app says “disallowed intents”: the two intents in step 2 are off. Turn them on and connect again.',
        es: 'El bot nunca se conecta, o la app dice “disallowed intents”: los dos intents del paso 2 están apagados. Actívalos y vuelve a conectar.' },
      { en: 'No channels to choose: the bot isn’t in that server yet. Do step 4 again.',
        es: 'No hay canales para elegir: el bot aún no está en ese servidor. Repite el paso 4.' },
      { en: '“Invalid OAuth2 redirect_uri”: the address under Redirects must be the one above exactly.',
        es: '“Invalid OAuth2 redirect_uri”: la dirección en Redirects debe ser exactamente la de arriba.' },
      { en: '“Missing Permissions” when it gives a role: move the bot’s role higher, as in step 6.',
        es: '“Missing Permissions” al dar un rol: sube el rol del bot, como en el paso 6.' },
    ],
  },
  {
    id: 'spotify', color: '#1DB954', portal: 'https://developer.spotify.com/dashboard', minutes: 5, optional: true, localOnly: true,
    state: (s) => (connected(s, 'spotify') ? 'on' : 'off'),
    fields: [
      { t: 'spotifyClientId', en: 'Your app on the Spotify dashboard → Settings → Client ID.', es: 'Tu app en el panel de Spotify → Settings → Client ID.' },
      { t: 'spotifyClientSecret', secret: true, en: 'Settings → “View client secret”.', es: 'Settings → “View client secret”.' },
    ],
    en: {
      name: 'Spotify',
      for: 'Optional: the song on stream, song requests, and music control from actions and buttons.',
      worked: '{screen:gallery} shows Spotify connected, and the song you are playing appears on the dashboard.',
    },
    es: {
      name: 'Spotify',
      for: 'Opcional: la canción en directo, peticiones de canciones, y controlar la música desde acciones y botones.',
      worked: '{screen:gallery} muestra Spotify conectado, y la canción que suena aparece en el panel.',
    },
    steps: [
      { en: 'Open developer.spotify.com/dashboard, sign in with your Spotify account, and press “Create app”.',
        es: 'Abre developer.spotify.com/dashboard, entra con tu cuenta de Spotify y pulsa “Create app”.' },
      { en: 'App name and description: anything. Redirect URIs: paste {redirect:loopback} and press Add. Tick “Web API”, accept the terms, and Save.',
        es: 'App name y description: lo que quieras. Redirect URIs: pega {redirect:loopback} y pulsa Add. Marca “Web API”, acepta las condiciones y guarda.' },
      { en: 'In the app’s Settings, copy the Client ID, then press “View client secret” and copy that too.',
        es: 'En Settings de la app, copia el Client ID, luego pulsa “View client secret” y cópialo también.' },
      { go: 'gallery',
        en: 'On {screen:gallery}, paste them into {t:spotifyClientId} and {t:spotifyClientSecret}, press {t:spotifyLogin}, and Agree.',
        es: 'En {screen:gallery}, pégalos en {t:spotifyClientId} y {t:spotifyClientSecret}, pulsa {t:spotifyLogin} y acepta.' },
    ],
    problems: [
      { en: '“INVALID_CLIENT: Invalid redirect URI”: Spotify refuses the word “localhost”, so the address uses 127.0.0.1. Register exactly the one above.',
        es: '“INVALID_CLIENT: Invalid redirect URI”: Spotify rechaza la palabra “localhost”, por eso la dirección usa 127.0.0.1. Registra exactamente la de arriba.' },
      { en: 'Play, pause and skip need Spotify Premium; showing the song works on any account.',
        es: 'Reproducir, pausar y saltar necesitan Spotify Premium; mostrar la canción funciona con cualquier cuenta.' },
    ],
  },
];

/** Everything a platform's walkthrough says, in one language, for the test that checks it. */
export function platformTexts(p, lang) {
  const words = p[lang] || {};
  return [words.name, words.for, words.worked, ...p.steps.map((s) => s[lang]), ...p.problems.map((x) => x[lang]), ...p.fields.map((f) => f[lang])]
    .filter((x) => typeof x === 'string');
}

/** Where the guides sit on the tab, in this order. */
export const GUIDE_GROUPS = [
  { id: 'start', en: 'Getting set up', es: 'Para empezar' },
  { id: 'yours', en: 'Making it yours', es: 'Hazlo tuyo' },
  { id: 'more', en: 'Going further', es: 'Para ir más allá' },
];

/**
 * One guide per task. `screens` are the screens whose "?" opens it — the
 * first guide naming a screen is the one its "?" opens. Each step may carry
 * `go`, a screen to go to.
 */
export const GUIDES = [
  {
    id: 'connect', group: 'start', icon: 'plug', screens: ['gallery', 'twitch'],
    en: {
      title: 'Connect your accounts',
      intro: 'The app does its work on a server, so you sign in once and every device you open it on is already set up. Whatever you leave unconnected simply stays off. Start here, at the top of this screen, walks through each platform click by click.',
      worked: 'The marks at the bottom of the menu light up, one for each account that is connected.',
    },
    es: {
      title: 'Conecta tus cuentas',
      intro: 'La app trabaja en un servidor: te conectas una vez y cualquier dispositivo donde la abras ya está listo. Lo que no conectes simplemente queda apagado. Empieza aquí, arriba en esta pantalla, explica cada plataforma clic a clic.',
      worked: 'Las marcas al pie del menú se encienden, una por cada cuenta conectada.',
    },
    steps: [
      { go: 'gallery',
        en: 'Twitch: make a free app at dev.twitch.tv/console/apps and paste into it the redirect URL that {screen:gallery} shows. Copy its Client ID into the box on that screen, then connect.',
        es: 'Twitch: crea una app gratis en dev.twitch.tv/console/apps y pega en ella la URL de redirección que muestra {screen:gallery}. Copia su Client ID en la casilla de esa pantalla y conecta.' },
      { go: 'gallery',
        en: 'A bot account is optional, and keeps the app’s messages from coming from you. Open the app in a private window, sign in to Twitch there as the bot, and press {t:connectBotBtn}.',
        es: 'Una cuenta de bot es opcional, y hace que los mensajes de la app no salgan a tu nombre. Abre la app en una ventana privada, entra en Twitch ahí con la cuenta del bot y pulsa {t:connectBotBtn}.' },
      { go: 'gallery',
        en: 'YouTube signs in the same way, with a Google app of your own; TikTok only needs your username.',
        es: 'YouTube se conecta igual, con una app de Google tuya; TikTok solo necesita tu nombre de usuario.' },
      { go: 'gallery',
        en: 'OBS: in OBS, open Tools → WebSocket Server Settings, turn the server on and copy its password. Put the address, the port (4455) and the password on {screen:gallery}. If the app runs on another device, such as a phone, the address is the OBS computer’s, not localhost.',
        es: 'OBS: en OBS, abre Herramientas → Configuración del servidor WebSocket, enciende el servidor y copia su contraseña. Pon la dirección, el puerto (4455) y la contraseña en {screen:gallery}. Si la app corre en otro dispositivo, como un móvil, la dirección es la del ordenador de OBS, no localhost.' },
      { go: 'gallery',
        en: 'Discord, if you have a server: make an application at discord.com/developers/applications, give it a bot with the Server Members and Message Content intents on, paste the bot’s token on {screen:gallery}, invite it to your server and choose the server.',
        es: 'Discord, si tienes servidor: crea una aplicación en discord.com/developers/applications, dale un bot con los intents Server Members y Message Content activados, pega el token del bot en {screen:gallery}, invítalo a tu servidor y elige el servidor.' },
    ],
  },
  {
    id: 'obs-pages', group: 'start', icon: 'monitor', screens: ['assets'],
    en: {
      title: 'Put the app in OBS',
      intro: 'The app reaches your stream through pages that OBS shows. They are only displays: close every one of them and the app keeps answering chat and running your automations.',
      worked: 'On the Guides screen, “Put the stream page in OBS” ticks itself as soon as OBS opens it.',
    },
    es: {
      title: 'Pon la app en OBS',
      intro: 'La app llega a tu directo a través de páginas que muestra OBS. Solo son pantallas: ciérralas todas y la app sigue respondiendo al chat y ejecutando tus automatizaciones.',
      worked: 'En Guías, «Pon la página del directo en OBS» se marca solo en cuanto OBS la abre.',
    },
    steps: [
      { en: 'Add a Browser source with {url:canvas}, 1920 × 1080, at the top of your scene. This one page draws every layer of your layouts: chat, alerts, bars, avatars, timers.',
        es: 'Añade una fuente de Navegador con {url:canvas}, de 1920 × 1080, arriba del todo en tu escena. Esta única página dibuja cada capa de tus diseños: chat, alertas, barras, avatares, temporizadores.' },
      { go: 'assets',
        en: 'For chat and buttons while you stream, add a dock: in OBS, Docks → Custom Browser Docks, with {url:dock}. It shows every platform’s chat together, and your Dock Actions buttons.',
        es: 'Para el chat y los botones mientras transmites, añade un dock: en OBS, Docks → Docks de navegador personalizados, con {url:dock}. Muestra el chat de todas las plataformas junto, y tus botones de Dock Actions.' },
      { en: 'Alerts without layouts? {url:alerts} as a browser source shows them alone. Skip it if a layout already has an Alerts layer, or they would show twice.',
        es: '¿Alertas sin diseños? {url:alerts} como fuente de navegador las muestra solas. Sáltatelo si un diseño ya tiene una capa de Alertas, o saldrían dos veces.' },
      { en: 'These addresses are the one you opened this page at, so they work from OBS as long as the OBS computer can reach it.',
        es: 'Estas direcciones son la que usaste para abrir esta página, así que sirven en OBS mientras el ordenador de OBS pueda llegar a ella.' },
    ],
  },
  {
    id: 'layouts', group: 'start', icon: 'layers', screens: ['layouts'],
    en: {
      title: 'Build your overlay',
      intro: 'A layout is one screen of your stream — Starting soon, In game, Be right back — made of layers. The stream page shows whichever layout is on.',
      worked: 'Switch OBS to a scene the layout is bound to: the stream page shows it.',
    },
    es: {
      title: 'Arma tu overlay',
      intro: 'Un diseño es una pantalla de tu directo — Empezando, En juego, Ya vuelvo — hecha de capas. La página del directo muestra el diseño que esté puesto.',
      worked: 'Cambia OBS a una escena vinculada al diseño: la página del directo lo muestra.',
    },
    steps: [
      { go: 'layouts',
        en: 'On {screen:layouts}, press {t:layoutNew}.',
        es: 'En {screen:layouts}, pulsa {t:layoutNew}.' },
      { go: 'layouts',
        en: 'Press {t:layoutAdd} for each thing on screen: chat, alerts, the omnibar, text, a picture, a timer, your avatar. Drag a layer to move it, and its corners to size it.',
        es: 'Pulsa {t:layoutAdd} por cada cosa en pantalla: chat, alertas, la omnibar, texto, una imagen, un temporizador, tu avatar. Arrastra una capa para moverla, y sus esquinas para cambiar su tamaño.' },
      { go: 'library',
        en: 'Give it a look: {screen:library} has themes that dress every layer at once, and looks for one layer at a time.',
        es: 'Dale un estilo: {screen:library} tiene temas que visten todas las capas a la vez, y estilos para una sola capa.' },
      { go: 'layouts',
        en: 'Say when it shows: pick its OBS scenes under {t:layoutScenes}, or let Omnilayer switch layouts for you — it has its own guide.',
        es: 'Indica cuándo sale: elige sus escenas de OBS en {t:layoutScenes}, o deja que Omnilayer cambie los diseños por ti — tiene su propia guía.' },
    ],
  },
  {
    id: 'omnilayer', group: 'start', icon: 'monitor-play', screens: [],
    en: {
      title: 'The whole stream in one OBS scene',
      intro: 'Omnilayer: instead of an OBS scene per screen, one scene holds everything — the stream page on top, your game and camera under it. Going live with a layout moves them into place behind a wipe.',
      worked: '{t:omniCheck} on the Omnilayer card lists what the scene holds, top first. The stream page should be at the top.',
    },
    es: {
      title: 'Todo el directo en una escena de OBS',
      intro: 'Omnilayer: en vez de una escena de OBS por pantalla, una sola escena lo tiene todo — la página del directo encima, tu juego y tu cámara debajo. Poner en vivo un diseño los coloca tras una cortinilla.',
      worked: '{t:omniCheck} en la tarjeta de Omnilayer lista lo que tiene la escena, de arriba abajo. La página del directo debe estar arriba.',
    },
    steps: [
      { en: 'In OBS, make one scene — call it Omnilayer — with the stream page at the top and your game capture and camera under it.',
        es: 'En OBS, crea una escena — llámala Omnilayer — con la página del directo arriba y la captura del juego y tu cámara debajo.' },
      { go: 'layouts',
        en: 'On {screen:layouts}, set the Omnilayer card to {t:omniOn} and choose that scene as {t:omniScene}.',
        es: 'En {screen:layouts}, pon la tarjeta de Omnilayer en {t:omniOn} y elige esa escena en {t:omniScene}.' },
      { go: 'layouts',
        en: 'In each layout, add an OBS source layer where the game or camera goes, and pick the OBS source. It draws nothing on stream: it is the box the real source is moved into.',
        es: 'En cada diseño, añade una capa de fuente de OBS donde va el juego o la cámara, y elige la fuente de OBS. No dibuja nada en directo: es la caja a la que se mueve la fuente real.' },
      { go: 'layouts',
        en: 'Give each layout a {t:sceneTypeTitle}: Starting, In game, Be right back. A command that names a type works in every overlay profile.',
        es: 'Dale a cada diseño un {t:sceneTypeTitle}: Empezando, En juego, Ya vuelvo. Un comando que nombra un tipo funciona en todos los perfiles de overlay.' },
      { go: 'actions',
        en: 'To switch: {t:omniGoLive} on the card, or an action with the step {t:layoutSwitchStep}, run from a chat command or a deck button.',
        es: 'Para cambiar: {t:omniGoLive} en la tarjeta, o una acción con el paso {t:layoutSwitchStep}, desde un comando del chat o un botón del dock.' },
    ],
  },
  {
    id: 'alerts', group: 'yours', icon: 'bell', screens: ['alerts'],
    en: {
      title: 'Alerts for follows, subs and raids',
      intro: 'An alert is the picture, sound and words on screen when somebody follows, subscribes, cheers, raids or sends a gift.',
      worked: 'The test plays on the stream page in OBS, as a real follow would.',
    },
    es: {
      title: 'Alertas de follows, subs y raids',
      intro: 'Una alerta es la imagen, el sonido y las palabras en pantalla cuando alguien te sigue, se suscribe, dona bits, hace un raid o manda un regalo.',
      worked: 'La prueba sale en la página del directo en OBS, como saldría un follow de verdad.',
    },
    steps: [
      { go: 'alerts',
        en: 'On {screen:alerts}, turn on an alert for each event you want, and give it a picture, a sound and its words.',
        es: 'En {screen:alerts}, activa una alerta por cada evento que quieras, y dale una imagen, un sonido y sus palabras.' },
      { go: 'layouts',
        en: 'Alerts appear wherever a layout has an Alerts layer: add one to each layout that should show them.',
        es: 'Las alertas salen donde un diseño tenga una capa de Alertas: añade una a cada diseño que deba mostrarlas.' },
      { go: 'alerts',
        en: 'Press {t:alertsTestLive} on an alert to see it on your stream without waiting for a real follow.',
        es: 'Pulsa {t:alertsTestLive} en una alerta para verla en tu directo sin esperar a un follow de verdad.' },
      { go: 'actions',
        en: 'For more than an alert — a thank-you in chat, a scene change, points — make an action whose trigger is a Twitch event such as {t:triggerFollow} or {t:triggerRaid}.',
        es: 'Para algo más que una alerta — un gracias en el chat, un cambio de escena, puntos — crea una acción cuyo disparador sea un evento de Twitch como {t:triggerFollow} o {t:triggerRaid}.' },
    ],
  },
  {
    id: 'first-command', group: 'yours', icon: 'terminal', screens: ['studio', 'actions'],
    en: {
      title: 'Make a chat command',
      intro: 'A command is the word chat types; an action is what happens. They are two pieces so one action can answer a command, a button and a reward alike.',
      worked: 'The bot answers in chat. Commands work in your Discord too, unless you turn that off on the command.',
    },
    es: {
      title: 'Crea un comando de chat',
      intro: 'Un comando es la palabra que escribe el chat; una acción es lo que pasa. Son dos piezas para que una misma acción responda a un comando, a un botón y a una recompensa.',
      worked: 'El bot responde en el chat. Los comandos también funcionan en tu Discord, salvo que lo apagues en el comando.',
    },
    steps: [
      { go: 'studio',
        en: 'On {screen:studio}, make a new command: its word (like !discord), who may use it, and a cooldown so chat cannot flood it.',
        es: 'En {screen:studio}, crea un comando nuevo: su palabra (como !discord), quién puede usarlo y una espera para que el chat no lo inunde.' },
      { go: 'actions',
        en: 'On {screen:actions}, make a new action. Its trigger is {t:triggerCommand}, with your command picked.',
        es: 'En {screen:actions}, crea una acción nueva. Su disparador es {t:triggerCommand}, con tu comando elegido.' },
      { go: 'actions',
        en: 'Add a step — Twitch → {t:chat} — and write the answer. {user} is whoever typed it and {input} what came after the word; {t:variables} lists every one.',
        es: 'Añade un paso — Twitch → {t:chat} — y escribe la respuesta. {user} es quien lo escribió e {input} lo que vino después de la palabra; {t:variables} las lista todas.' },
      { en: 'Save, and type the word in your chat.',
        es: 'Guarda, y escribe la palabra en tu chat.' },
    ],
  },
  {
    id: 'deck', group: 'yours', icon: 'grid', screens: ['dock-actions'],
    en: {
      title: 'Buttons to press while live',
      intro: 'Dock Actions is a grid of buttons in the chat dock and on your phone: switch a layout, start a timer, count a death — anything an action does.',
      worked: 'Pressing a button runs its action straight away.',
    },
    es: {
      title: 'Botones para pulsar en directo',
      intro: 'Dock Actions es una cuadrícula de botones en el dock de chat y en tu móvil: cambiar un diseño, arrancar un temporizador, contar una muerte — lo que haga una acción.',
      worked: 'Pulsar un botón ejecuta su acción al momento.',
    },
    steps: [
      { go: 'dock-actions',
        en: 'On {screen:dock-actions}, add a button and choose the action it runs, or one of the built-in buttons that need no action.',
        es: 'En {screen:dock-actions}, añade un botón y elige la acción que ejecuta, o uno de los botones incluidos que no necesitan acción.' },
      { go: 'dock-actions',
        en: 'Give it a colour, an emoji or a picture, so you find it without reading.',
        es: 'Dale un color, un emoji o una imagen, para encontrarlo sin leer.' },
      { go: 'assets',
        en: 'In the chat dock, the {t:dockTabActions} tab holds the buttons. Open the app on your phone and they are there too.',
        es: 'En el dock de chat, la pestaña {t:dockTabActions} tiene los botones. Abre la app en tu móvil y también están ahí.' },
    ],
  },
  {
    id: 'themes', group: 'yours', icon: 'palette', screens: ['library'],
    en: {
      title: 'Make it look like yours',
      intro: 'A theme dresses every kind of layer at once — chat, alerts, bars, timers — so a layout looks like one thing. Start from one that comes with the app, or make your own.',
      worked: 'Your themes show {t:libraryMine}, and every preview on the shelf draws them.',
    },
    es: {
      title: 'Que se vea tuyo',
      intro: 'Un tema viste todos los tipos de capa a la vez — chat, alertas, barras, temporizadores — para que un diseño se vea como una sola cosa. Parte de uno que trae la app, o crea el tuyo.',
      worked: 'Tus temas dicen {t:libraryMine}, y cada vista previa del estante los dibuja.',
    },
    steps: [
      { go: 'library',
        en: 'On {screen:library}, open a theme and apply it to a layout, or one of its looks to a single layer.',
        es: 'En {screen:library}, abre un tema y aplícalo a un diseño, o uno de sus estilos a una sola capa.' },
      { go: 'library',
        en: 'To change one, press {t:libraryCopyTheme}. Then {t:libraryStyleTitle} changes them across the whole theme at once; Edit on a piece changes only that piece.',
        es: 'Para cambiar uno, pulsa {t:libraryCopyTheme}. Luego {t:libraryStyleTitle} los cambia en todo el tema a la vez; Editar en una pieza cambia solo esa pieza.' },
      { go: 'layouts',
        en: 'Styled a layout by hand? On {screen:layouts}, {t:layoutSaveTheme} keeps its looks to use on any other layout.',
        es: '¿Diste estilo a un diseño a mano? En {screen:layouts}, pulsa {t:layoutSaveTheme} para usar sus estilos en cualquier otro diseño.' },
      { go: 'library',
        en: '{t:libraryExport} shares a theme with the fonts you uploaded for it; {t:libraryImport} brings one in.',
        es: 'Pulsa {t:libraryExport} para compartir un tema con las fuentes que subiste para él, y {t:libraryImport} para traer uno.' },
    ],
  },
  {
    id: 'profiles', group: 'yours', icon: 'copy', screens: ['omnibar', 'viewers'],
    en: {
      title: 'A different setup for each kind of stream',
      intro: 'Profiles keep whole sets — your layouts, your alerts, your commands and actions — so a casual stream, a marathon and a horror night can each have their own, switched in one go.',
      worked: 'Switching a profile changes the stream page straight away, and the bar names the profile that is on.',
    },
    es: {
      title: 'Una configuración para cada tipo de directo',
      intro: 'Los perfiles guardan conjuntos enteros — tus diseños, tus alertas, tus comandos y acciones — para que un directo tranquilo, un maratón y una noche de terror tengan cada uno el suyo, y se cambien de una vez.',
      worked: 'Al cambiar de perfil la página del directo cambia al momento, y la barra dice qué perfil está puesto.',
    },
    steps: [
      { go: 'layouts',
        en: 'The profile bar sits at the top of {screen:layouts}, {screen:alerts} and {screen:studio}. Each of the three keeps its own profiles.',
        es: 'La barra de perfiles está arriba en {screen:layouts}, {screen:alerts} y {screen:studio}. Cada una de las tres tiene sus propios perfiles.' },
      { go: 'layouts',
        en: 'Press {t:profileDuplicate} to start a new profile from the one you have, then change what you like.',
        es: 'Pulsa {t:profileDuplicate} para empezar un perfil nuevo a partir del que tienes, y luego cambia lo que quieras.' },
      { en: 'The bar says {t:profileUnsaved} when you have changed something: {t:profileSave} keeps it in the profile. Switching profiles saves the one you leave first, and {t:profileRevertBtn} throws changes away.',
        es: 'La barra dice {t:profileUnsaved} cuando cambiaste algo: {t:profileSave} lo guarda en el perfil. Cambiar de perfil guarda antes el que dejas, y {t:profileRevertBtn} descarta los cambios.' },
    ],
  },
  {
    id: 'remote-players', group: 'more', icon: 'cast', screens: ['remote-players', 'players'],
    en: {
      title: 'Friends’ games on your stream',
      intro: 'Up to four players send their game to your OBS through VDO.Ninja — free, straight from their computer to yours, with a link each that stays the same from one night to the next.',
      worked: 'The seat says {t:remoteLive}, and its game is in the layout’s box.',
    },
    es: {
      title: 'Los juegos de tus amigos en tu directo',
      intro: 'Hasta cuatro jugadores mandan su juego a tu OBS por VDO.Ninja — gratis, directo de su ordenador al tuyo, con un enlace cada uno que no cambia de una noche a otra.',
      worked: 'El puesto dice {t:remoteLive}, y su juego está en la caja del diseño.',
    },
    steps: [
      { go: 'remote-players',
        en: 'With OBS connected, press {t:remoteSetup} on {screen:remote-players}. It makes the browser sources Player 1 to 4 and points the layouts made for remote players at them.',
        es: 'Con OBS conectado, pulsa {t:remoteSetup} en {screen:remote-players}. Crea las fuentes de navegador Player 1 a 4 y les apunta los diseños hechos para jugadores remotos.' },
      { go: 'remote-players',
        en: 'Send each player their seat’s link: {t:remoteCopy}, or {t:remoteInvite}. They open it in Chrome or Edge, press Share screen and pick the game window.',
        es: 'Manda a cada jugador el enlace de su puesto: {t:remoteCopy}, o {t:remoteInvite}. Lo abren en Chrome o Edge, pulsan Compartir pantalla y eligen la ventana del juego.' },
      { go: 'remote-players',
        en: 'Playing too? Choose your seat under {t:remoteMeSeat}, and your capture, so that seat shows your own game.',
        es: '¿Juegas tú también? Elige tu puesto en {t:remoteMeSeat}, y tu captura, para que ese puesto muestre tu propio juego.' },
      { go: 'actions',
        en: 'Whose game fills the screen: {t:remoteOnScreenPut} on a seat, or an action with the step {t:onScreenStep}. With {input}, chat can choose: !j2.',
        es: 'De quién es el juego a pantalla completa: {t:remoteOnScreenPut} en un puesto, o una acción con el paso {t:onScreenStep}. Con {input}, el chat puede elegir: !j2.' },
      { en: 'Game sound only comes through when a player shares a whole screen or a browser tab with Share audio ticked. Voices are best left to the Discord call.',
        es: 'El sonido del juego solo llega cuando un jugador comparte una pantalla entera o una pestaña con Compartir audio marcado. Las voces mejor por la llamada de Discord.' },
    ],
  },
  {
    id: 'discord', group: 'more', icon: 'discord', screens: ['welcome-goodbye', 'discord-pages', 'role-management', 'reaction-roles', 'discord-buttons', 'go-live', 'voice'],
    en: {
      title: 'Your Discord server',
      intro: 'With the bot in your server, the app looks after it while you stream and while you don’t.',
      worked: 'Each screen’s test posts a sample where you told it to, before anything reaches a real channel.',
    },
    es: {
      title: 'Tu servidor de Discord',
      intro: 'Con el bot en tu servidor, la app lo cuida mientras transmites y mientras no.',
      worked: 'La prueba de cada pantalla publica un ejemplo donde le dijiste, antes de que nada llegue a un canal de verdad.',
    },
    steps: [
      { go: 'welcome-goodbye',
        en: '{screen:welcome-goodbye}: a message and a drawn card when somebody joins, and one when they leave.',
        es: '{screen:welcome-goodbye}: un mensaje y una tarjeta dibujada cuando alguien entra, y otro cuando se va.' },
      { go: 'reaction-roles',
        en: '{screen:reaction-roles} and {screen:discord-buttons}: menus people press to take a role.',
        es: '{screen:reaction-roles} y {screen:discord-buttons}: menús que la gente pulsa para tomar un rol.' },
      { go: 'discord-pages',
        en: '{screen:discord-pages}: rules, information and links as tidy channel posts, built from blocks.',
        es: '{screen:discord-pages}: normas, información y enlaces como publicaciones ordenadas del canal, hechas con bloques.' },
      { go: 'go-live',
        en: '{screen:go-live}: a post when you go live, and messages to the people who asked for one.',
        es: '{screen:go-live}: una publicación cuando entras en directo, y mensajes a quien pidió uno.' },
      { go: 'role-management',
        en: '{screen:role-management}: viewers link their accounts, and roles follow subs, levels and loyalty.',
        es: '{screen:role-management}: los espectadores vinculan sus cuentas, y los roles siguen a las subs, los niveles y la fidelidad.' },
      { en: 'Try things in a private channel only you can see, then point them at the real ones.',
        es: 'Prueba las cosas en un canal privado que solo veas tú, y luego apúntalas a los de verdad.' },
    ],
  },
  {
    id: 'community', group: 'more', icon: 'trophy', screens: ['levels', 'points', 'polls', 'giveaway', 'questions', 'requests'],
    en: {
      title: 'Points, levels, polls and giveaways',
      intro: 'Things for your viewers to do, across every platform at once.',
      worked: 'The words at the bottom of this tab answer in your chat.',
    },
    es: {
      title: 'Puntos, niveles, encuestas y sorteos',
      intro: 'Cosas para que hagan tus espectadores, en todas las plataformas a la vez.',
      worked: 'Las palabras al final de esta pestaña responden en tu chat.',
    },
    steps: [
      { go: 'levels',
        en: '{screen:levels}: viewers earn XP for chatting and watching, and can ask for their rank.',
        es: '{screen:levels}: los espectadores ganan XP por chatear y mirar, y pueden preguntar su puesto.' },
      { go: 'points',
        en: '{screen:points}: points to spend in a shop of rewards you make, each running an action.',
        es: '{screen:points}: puntos para gastar en una tienda de recompensas que creas tú, cada una con su acción.' },
      { go: 'polls',
        en: '{screen:polls} and {screen:giveaway}: run one from its screen, a deck button or a moderator’s chat command.',
        es: '{screen:polls} y {screen:giveaway}: lanza una desde su pantalla, un botón del dock o un comando de un moderador.' },
      { go: 'questions',
        en: '{screen:questions}: viewers ask with a word in chat, and you put one on screen as you answer it.',
        es: '{screen:questions}: los espectadores preguntan con una palabra en el chat, y tú pones una en pantalla mientras la respondes.' },
      { en: 'The chat words that work without making a command are listed at the bottom of this tab, as they are set now.',
        es: 'Las palabras del chat que funcionan sin crear un comando están al final de esta pestaña, tal como están ahora.' },
    ],
  },
  {
    id: 'devices', group: 'more', icon: 'phone', screens: [],
    en: {
      title: 'Use it from your phone or another computer',
      intro: 'Everything lives on the server, so any device on your home network opens the same app, already set up.',
      worked: 'The phone shows your layouts and commands, with the screens used mid-stream in a bar along the bottom.',
    },
    es: {
      title: 'Úsala desde tu móvil u otro ordenador',
      intro: 'Todo vive en el servidor, así que cualquier dispositivo de tu red de casa abre la misma app, ya configurada.',
      worked: 'El móvil muestra tus diseños y comandos, con las pantallas que se usan en directo en una barra abajo.',
    },
    steps: [
      { en: 'Find the address of the computer that runs the app on your network, like 192.168.1.50, and open http://that-address:8081 on the other device.',
        es: 'Busca la dirección en tu red del ordenador que corre la app, como 192.168.1.50, y abre http://esa-dirección:8081 en el otro dispositivo.' },
      { en: 'Sign in to the platforms once, on the device the app runs on: the others use that same sign-in.',
        es: 'Conéctate a las plataformas una vez, en el dispositivo donde corre la app: los demás usan esa misma conexión.' },
      { en: 'The app has no password. Keep it on your home network and never open it to the internet.',
        es: 'La app no tiene contraseña. Mantenla en tu red de casa y nunca la abras a internet.' },
      { go: 'settings',
        en: 'Each device keeps its own language and colours for this app, on {screen:settings}.',
        es: 'Cada dispositivo guarda su propio idioma y colores de la app, en {screen:settings}.' },
    ],
  },
  {
    id: 'backup', group: 'more', icon: 'save', screens: ['settings'],
    en: {
      title: 'Back up, or move to a new computer',
      intro: 'One file holds what you set up, to bring back after a bad day or to stand the app up somewhere new.',
      worked: 'Importing says {t:importDone}, and the page reloads with everything in place.',
    },
    es: {
      title: 'Copia de seguridad, o cambio de ordenador',
      intro: 'Un archivo guarda lo que configuraste, para recuperarlo tras un mal día o montar la app en otro sitio.',
      worked: 'Al importar dice {t:importDone}, y la página se recarga con todo en su sitio.',
    },
    steps: [
      { go: 'settings',
        en: 'On {screen:settings}, {t:exportConfig} saves commands, actions, alerts, layouts, themes and the rest to one file.',
        es: 'En {screen:settings}, pulsa {t:exportConfig} para guardar comandos, acciones, alertas, diseños, temas y lo demás en un archivo.' },
      { en: 'Sign-ins and passwords are left out on purpose: connect the platforms again on the new computer. Viewers’ XP and chat history are not in it either.',
        es: 'Las conexiones y contraseñas se dejan fuera a propósito: vuelve a conectar las plataformas en el ordenador nuevo. La XP de los espectadores y el historial del chat tampoco van.' },
      { en: 'Pictures, sounds and fonts you uploaded are in the app’s assets folder, not in the file: copy that folder across too.',
        es: 'Las imágenes, sonidos y fuentes que subiste están en la carpeta assets de la app, no en el archivo: cópiala también.' },
      { go: 'settings',
        en: 'On the new install, {t:importConfig} replaces what is there with the file.',
        es: 'En la instalación nueva, pulsa {t:importConfig}: reemplaza lo que haya con el archivo.' },
    ],
  },
];

/** The app's own words, each with where it is used. */
export const GLOSSARY = [
  { id: 'layout', go: 'layouts',
    en: { term: 'Layout', means: 'One screen of your stream — Starting, In game, Be right back — made of layers.' },
    es: { term: 'Diseño', means: 'Una pantalla de tu directo — Empezando, En juego, Ya vuelvo — hecha de capas.' } },
  { id: 'layer', go: 'layouts',
    en: { term: 'Layer', means: 'One thing on a layout: chat, alerts, text, a picture, a timer, an avatar.' },
    es: { term: 'Capa', means: 'Una cosa en un diseño: chat, alertas, texto, una imagen, un temporizador, un avatar.' } },
  { id: 'stream-page',
    en: { term: 'Stream page', means: 'The browser source in OBS that draws your layouts.' },
    es: { term: 'Página del directo', means: 'La fuente de navegador en OBS que dibuja tus diseños.' } },
  { id: 'scene',
    en: { term: 'OBS scene', means: 'OBS’s own screens. A layout can be bound to scenes, so switching the scene switches the overlay.' },
    es: { term: 'Escena de OBS', means: 'Las pantallas propias de OBS. Un diseño se puede vincular a escenas, y al cambiar la escena cambia el overlay.' } },
  { id: 'omnilayer', go: 'layouts',
    en: { term: 'Omnilayer', means: 'The whole stream in one OBS scene: the app switches layouts and moves your game and camera into place.' },
    es: { term: 'Omnilayer', means: 'Todo el directo en una escena de OBS: la app cambia los diseños y coloca tu juego y tu cámara.' } },
  { id: 'scene-type', go: 'layouts',
    en: { term: 'Scene type', means: 'What a layout is for — Starting, Be right back. The same in every profile, so one command fits them all.' },
    es: { term: 'Tipo de escena', means: 'Para qué es un diseño — Empezando, Ya vuelvo. Igual en todos los perfiles, así un comando sirve para todos.' } },
  { id: 'source-layer', go: 'layouts',
    en: { term: 'OBS source layer', means: 'A box on a layout that an OBS source — your game, your camera, a player — is moved into. It draws nothing itself.' },
    es: { term: 'Capa de fuente de OBS', means: 'Una caja en un diseño a la que se mueve una fuente de OBS — tu juego, tu cámara, un jugador —. No dibuja nada por sí misma.' } },
  { id: 'profile',
    en: { term: 'Profile', means: 'A saved set of layouts, of alerts, or of commands and actions, switched as a whole.' },
    es: { term: 'Perfil', means: 'Un conjunto guardado de diseños, de alertas, o de comandos y acciones, que se cambia entero.' } },
  { id: 'command', go: 'studio',
    en: { term: 'Command', means: 'A word chat types, with who may use it and how often.' },
    es: { term: 'Comando', means: 'Una palabra que escribe el chat, con quién puede usarla y cada cuánto.' } },
  { id: 'action', go: 'actions',
    en: { term: 'Action', means: 'What the app does when its trigger happens: one step or many, in order.' },
    es: { term: 'Acción', means: 'Lo que hace la app cuando pasa su disparador: uno o varios pasos, en orden.' } },
  { id: 'trigger', go: 'actions',
    en: { term: 'Trigger', means: 'What starts an action: a command, a follow, a raid, a scene change, a time of day.' },
    es: { term: 'Disparador', means: 'Lo que arranca una acción: un comando, un follow, un raid, un cambio de escena, una hora del día.' } },
  { id: 'step', go: 'actions',
    en: { term: 'Step', means: 'One thing an action does: say something in chat, switch a layout, play a sound.' },
    es: { term: 'Paso', means: 'Una cosa que hace una acción: decir algo en el chat, cambiar un diseño, reproducir un sonido.' } },
  { id: 'variable', go: 'actions',
    en: { term: 'Variable', means: 'A name in braces that becomes a value when it runs: {user} is who did it, {input} what they typed after the word.' },
    es: { term: 'Variable', means: 'Un nombre entre llaves que se vuelve un valor al ejecutarse: {user} es quien lo hizo, {input} lo que escribió tras la palabra.' } },
  { id: 'alert', go: 'alerts',
    en: { term: 'Alert', means: 'The picture, sound and words on screen for a follow, a sub, a raid or a gift.' },
    es: { term: 'Alerta', means: 'La imagen, el sonido y las palabras en pantalla por un follow, una sub, un raid o un regalo.' } },
  { id: 'theme', go: 'library',
    en: { term: 'Theme', means: 'A set of looks, one for each kind of layer, applied together.' },
    es: { term: 'Tema', means: 'Un conjunto de estilos, uno por tipo de capa, que se aplican juntos.' } },
  { id: 'look', go: 'library',
    en: { term: 'Look', means: 'How one layer is drawn. A theme is made of them, its pieces.' },
    es: { term: 'Estilo', means: 'Cómo se dibuja una capa. Un tema está hecho de ellos, sus piezas.' } },
  { id: 'dock', go: 'assets',
    en: { term: 'Chat dock', means: 'A page for OBS’s docks: every platform’s chat together, with your buttons.' },
    es: { term: 'Dock de chat', means: 'Una página para los docks de OBS: el chat de todas las plataformas junto, con tus botones.' } },
  { id: 'deck', go: 'dock-actions',
    en: { term: 'Dock Actions', means: 'Your grid of buttons, in the chat dock and on your phone.' },
    es: { term: 'Dock Actions', means: 'Tu cuadrícula de botones, en el dock de chat y en tu móvil.' } },
  { id: 'omnibar', go: 'omnibar',
    en: { term: 'Omnibar', means: 'A bar that takes turns showing messages, goals, your commands and more.' },
    es: { term: 'Omnibar', means: 'Una barra que va mostrando por turnos mensajes, metas, tus comandos y más.' } },
  { id: 'seat', go: 'remote-players',
    en: { term: 'Seat', means: 'One of the four places for a remote player, each with its own link.' },
    es: { term: 'Puesto', means: 'Uno de los cuatro sitios para un jugador remoto, cada uno con su propio enlace.' } },
];

/**
 * The chat words that work without a command being made, as they are set
 * now: `read(data)` gives `{ on, word }` from the live settings, or null
 * while they have not arrived. `who` is who may use it; `after` is what
 * goes after the word.
 */
export const BUILTIN_WORDS = [
  { id: 'plan', go: 'plan', who: 'anyone',
    read: (d) => (d?.plan?.answer ? { on: d.plan.answer.enabled !== false, word: d.plan.answer.trigger } : null),
    en: { does: 'What is on now and what comes next, from the stream plan.' },
    es: { does: 'Qué hay ahora y qué viene después, según el plan del directo.' } },
  { id: 'question', go: 'questions', who: 'anyone',
    read: (d) => (d?.questionSettings?.ask ? { on: d.questionSettings.ask.enabled !== false, word: d.questionSettings.ask.trigger } : null),
    en: { after: 'a question', does: 'Puts the question in your queue.' },
    es: { after: 'una pregunta', does: 'Pone la pregunta en tu cola.' } },
  { id: 'poll', go: 'polls', who: 'mods',
    read: (d) => (d?.pollSettings?.command ? { on: d.pollSettings.command.enabled !== false, word: d.pollSettings.command.trigger } : null),
    en: { after: 'Question | answer | answer', does: 'Opens a poll; on its own, opens the one set up on the screen.' },
    es: { after: 'Pregunta | respuesta | respuesta', does: 'Abre una encuesta; sola, abre la preparada en la pantalla.' } },
  // The word is the giveaway's own: the open one's while it runs, the one set up for the next otherwise.
  { id: 'giveaway', go: 'giveaway', who: 'anyone',
    read: (d) => {
      const s = d?.giveaway;
      const word = s ? (s.mode === 'open' ? s.keyword : (s.draft?.keyword || s.keyword)) : '';
      return word ? { on: true, word } : null;
    },
    en: { does: 'Enters the giveaway while one is open.' },
    es: { does: 'Entra al sorteo mientras haya uno abierto.' } },
  { id: 'rank', go: 'levels', who: 'anyone',
    read: (d) => (d?.xpConfig?.chat ? { on: d.xpConfig.chat.enabled !== false, word: d.xpConfig.chat.rankWord } : null),
    en: { does: 'Their level, XP and place.' },
    es: { does: 'Su nivel, su XP y su puesto.' } },
  { id: 'top', go: 'levels', who: 'anyone',
    read: (d) => (d?.xpConfig?.chat ? { on: d.xpConfig.chat.enabled !== false, word: d.xpConfig.chat.topWord } : null),
    en: { does: 'The top of the leaderboard.' },
    es: { does: 'Lo más alto de la clasificación.' } },
  { id: 'profile', go: 'levels', who: 'anyone',
    read: (d) => (d?.profileCard?.word ? { on: d.profileCard.enabled !== false, word: d.profileCard.word } : null),
    en: { does: 'Their profile card: level, points and support.' },
    es: { does: 'Su tarjeta de perfil: nivel, puntos y apoyo.' } },
  { id: 'balance', go: 'points', who: 'anyone',
    read: (d) => (d?.pointsSettings?.words ? { on: d.pointsSettings.enabled !== false, word: d.pointsSettings.words.balance } : null),
    en: { does: 'How many points they have.' },
    es: { does: 'Cuántos puntos tienen.' } },
  { id: 'shop', go: 'points', who: 'anyone',
    read: (d) => (d?.pointsSettings?.words ? { on: d.pointsSettings.enabled !== false, word: d.pointsSettings.words.shop } : null),
    en: { does: 'What the shop sells, and for how much.' },
    es: { does: 'Qué vende la tienda, y por cuánto.' } },
  { id: 'redeem', go: 'points', who: 'anyone',
    read: (d) => (d?.pointsSettings?.words ? { on: d.pointsSettings.enabled !== false, word: d.pointsSettings.words.redeem } : null),
    en: { after: 'a reward', does: 'Spends points on a reward from the shop.' },
    es: { after: 'una recompensa', does: 'Gasta puntos en una recompensa de la tienda.' } },
  { id: 'give', go: 'points', who: 'mods',
    read: (d) => (d?.pointsSettings?.words ? { on: d.pointsSettings.enabled !== false, word: d.pointsSettings.words.give } : null),
    en: { after: '@name 100', does: 'Gives somebody points.' },
    es: { after: '@nombre 100', does: 'Da puntos a alguien.' } },
];

/** The first guide each screen's "?" opens, or null. */
export function guideForScreen(view) {
  return GUIDES.find((g) => g.screens.includes(view)) || null;
}

/** The setup steps as they stand: each with whether it is done, and the count of what is left. */
export function setupState(state, { seen = [], ticked = [] } = {}) {
  const items = SETUP_CHECKS.map((c) => {
    let done = false;
    try { done = Boolean(c.done(state)); } catch { done = false; }
    if (!done && c.sticky && seen.includes(c.id)) done = true;
    if (!done && c.manual && ticked.includes(c.id)) done = true;
    return { check: c, done };
  });
  const needed = items.filter((i) => !i.check.optional);
  return { items, left: needed.filter((i) => !i.done).length, needed: needed.length };
}

/** The tokens a guide's text holds, for the screen that draws it and the test that checks it. */
export const GUIDE_TOKEN = /\{(screen|t|url|redirect):([a-zA-Z0-9_-]+)\}/g;

/** Every piece of text a guide holds, in one language: its title, intro, steps and last line. */
export function guideTexts(guide, lang) {
  const words = guide[lang] || {};
  return [words.title, words.intro, words.worked, ...guide.steps.map((s) => s[lang])].filter((x) => typeof x === 'string');
}
