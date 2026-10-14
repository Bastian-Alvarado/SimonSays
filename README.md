# SimonSays

Multi-platform stream automation that **runs without a browser open**:
Twitch, YouTube, TikTok LIVE, Discord, OBS and Spotify, driven by one small
server you run on your own computer (or a spare phone or PC on your network).
The web app is where you set it up; close it and everything keeps working.

```
┌──────────────────────────────────────────────────────┐
│  server/  —  always running, owns everything          │
│                                                       │
│  Twitch IRC · EventSub · TikTok · Discord gateway     │
│  OBS · Spotify · commands · actions · alerts · XP     │
│  cooldowns · tags · persistence                       │
└──────────────────────────────────────────────────────┘
        ▲                    ▲                   ▲
        │ one WebSocket      │                   │
   ┌────┴─────┐        ┌─────┴──────┐     ┌──────┴──────┐
   │ Config UI│        │ Chat dock  │     │ OBS overlay │
   │ (closable)│       │ (closable) │     │  (closable) │
   └──────────┘        └────────────┘     └─────────────┘
```

## What it does

- **Chat, alerts and automation** across platforms: commands, actions with
  triggers and steps, alerts, a grid of buttons for your phone or OBS dock.
- **Overlays** built from layers — chat, alerts, bars, timers, goals, polls,
  avatars and more — switched by OBS scene, or all in one scene with
  Omnilayer. Two themes to start from, **SimonSays Default** and
  **Cyberpunky**, and an editor to make your own.
- **Pixel avatars** drawn in the app, with **Sandwichxample** as a complete
  example: every face, extras, hats, outfits and actions.
- **Community**: levels, points and a shop, polls, giveaways, questions,
  game requests, remote players.
- **Discord**: welcome cards, role menus, pages, go-live posts.
- **Your moderators**: a sign-in for the dashboard, so you and the
  moderators of your Twitch channel can use it from anywhere. They help run
  the stream from their own dock, moderate chat as themselves, and never touch
  your connections, overlays or backups.
- **A home screen** that greets whoever opens it with the stream at a glance
  and only what needs doing.
- **Guides** inside the app walk a new streamer through setting it all up,
  including each platform's keys, click by click.

English and Spanish throughout. What changed in each version is in
[CHANGELOG.md](CHANGELOG.md).

## Privacy

It runs on your own computer and sends nothing to the people who make it: no
analytics and no tracking. Its one cookie is the sign-in's, set only once
somebody signs in. What it keeps about you and your viewers,
where, and what reaches which service is in [PRIVACY.md](PRIVACY.md).

## License

Source available under the Apache License 2.0 with the **Commons Clause**
(see [LICENSE](LICENSE)). In plain words: use it for your own streams —
monetized ones included — change it and share it, as long as the license
goes with it; but do not sell it, or sell hosting, setup or support whose
value is mainly SimonSays itself.

---

## Getting started

About half an hour from nothing to a first stream. The app also walks you
through all of this itself, on its home screen and in **Guides**, in English
and Spanish — this is the same path, written down.

### What you need

- **A computer to run it on.** The one that runs OBS is simplest. Windows,
  macOS or Linux; a spare PC or an old Android phone on your network works
  too.
- **[Node.js](https://nodejs.org) 22 or newer.** Take the LTS installer and
  keep its defaults. To check, open a terminal and run `node -v`.
- **[OBS Studio](https://obsproject.com) 28 or newer**, for the overlays.
- **The accounts you stream from** — Twitch, YouTube, TikTok — and Discord
  or Spotify if you want those too.

### 1. Download it

On GitHub, press **Code → Download ZIP** and unzip it somewhere that stays
put, like `Documents\SimonSays`. Or, with git, copy the address under
**Code** and run `git clone` with it.

### 2. Install it

Open a terminal in that folder. On Windows: open the folder, right-click
an empty space, and choose **Open in Terminal**. Then:

```bash
npm install
```

It downloads what the app needs. A few minutes, once.

### 3. Start it

```bash
npm run serve
```

The first time it builds the app, then starts it. When it says
`listening on http://0.0.0.0:8081`, it's running. **Leave that window
open** — it is the app. Closing it stops everything; closing the browser
doesn't.

Every time after that, `npm start` is enough. Start it before you go live.

### 4. Open it

Go to **http://localhost:8081** in your browser. The home screen welcomes
you with the setup steps still to do, each with a button to where it's
done, and ticks them off as you go.

### 5. Connect where you stream

On the **Connections** screen:

- **Twitch.** Twitch needs an app of your own, made once:
  1. Turn on two-factor authentication on your Twitch account (twitch.tv →
     Settings → Security and Privacy). Twitch won't let you make an app
     without it.
  2. At [dev.twitch.tv/console/apps](https://dev.twitch.tv/console/apps),
     press **Register Your Application**. Any name; **OAuth Redirect URLs**:
     `http://localhost:8081/`; category: Chat Bot.
  3. Press **Manage**, copy the **Client ID** (not the secret), paste it on
     the Connections screen and press **Login with Twitch**.

  Sign in on the computer the app runs on: Twitch accepts a plain `http://`
  address only for `localhost`. A second account for the bot is optional
  (see [Connecting a separate bot account](#connecting-a-separate-bot-account)).
- **YouTube**, **TikTok LIVE**, **Discord** and **Spotify** each have a
  click-by-click walkthrough in **Guides → Start here**.

### 6. Connect OBS

In OBS: **Tools → WebSocket Server Settings**, tick **Enable WebSocket
server**, press **Show Connect Info** and copy the password. On the
Connections screen, fill in `localhost`, `4455` and that password, and
connect.

### 7. Put your stream in OBS

Add a **Browser** source to your scenes, 1920 × 1080, with the address from
the **Overlays** screen (`http://localhost:8081/?mode=canvas`). That one
source draws everything the app puts on stream: chat, alerts, bars, timers,
avatars. Copy the address from the app rather than typing it — once sign-in
is on, it carries the key OBS needs.

For the chat and your buttons beside OBS's preview, add a dock: **Docks →
Custom Browser Docks**, with `http://localhost:8081/?mode=dock`.

### 8. Make it yours

- **Overlays:** make a layout, or start from a theme in **Looks**. Bind
  each layout to the OBS scenes it shows in, or turn on **Omnilayer** to run
  the whole stream from one scene.
- **Alerts:** turn on the ones you want, with their sounds.
- **Commands** and **Actions:** a command is what chat types; an action is
  what happens — chat lines, scene switches, sounds, timers, anything.
- **Dock Actions:** a grid of buttons for those actions, in the OBS dock and
  on your phone.

### 9. Before anyone else can reach it

On your home network nothing more is needed. If the app can be reached
from anywhere else — a public address in front of it, say — switch
**sign-in** on first (**Settings → Sign-in**): from then on only you and
your Twitch channel's moderators can open the dashboard. Every address you
sign in from must be added to your Twitch app's OAuth Redirect URLs, as in
step 5.

Moderators then sign in with their own Twitch account and help run the
stream from their own dock, without touching what's yours. The
**Moderators** screen shows who's in and what they did.

### If something goes wrong

- **"Port 8081 is already in use":** the app is already running, in another
  window. Use that one, or close it first.
- **`'&&' is not a valid statement separator`** (Windows PowerShell 5.1):
  run the commands on separate lines, or join them with `;`.
- **Twitch says "redirect_mismatch":** the address in your Twitch app must be
  exactly the one you opened, `http://localhost:8081/` — slash included.
- **A phone or another PC can't open it:** allow Node.js through the
  Windows firewall on private networks (Windows asks the first time).
- **Anything else:** **Guides** has a "when it doesn't work" list for every
  platform.

### Keys in a file, if you prefer

Everything above goes in through the app, and the server keeps it. To set
the port, the address it listens on, or platform keys in a file instead,
copy `.env.example` to `.env` and fill in what you need; anything left
blank is ignored.

---

## Updating

Started with `npm run serve` (or `npm start` once the UI is built), the app
keeps itself up to date. It checks GitHub once a day, and **Settings → About**
shows when a new version is out, with what's new in it. **Update now**
downloads it, checks it arrived whole, backs up `data/` to `backups/` and
restarts into it. That takes a few seconds, and overlays come back by
themselves. If the new version won't start, the app goes back to the one you
had.

It never updates on its own, and never while OBS is streaming or recording.
Each version gets its own folder under `versions/`; your `data/`, `assets/`
and `.env` stay where they are.

Prefer git? `git pull`, `npm install` and `npm run serve` still work, and a
newer copy from git wins over an older version installed from Settings.
`npm run dev` has no updater: update that one with git.

---

## The important part: closing the UI

Start the server, configure your commands, then **close every browser tab**.

- Chat commands keep firing
- Alerts keep dispatching to any connected overlay
- XP keeps accruing
- Discord reaction roles and welcome messages keep working
- OBS scene switches keep happening
- Stream tags keep updating

Check on it from anywhere:

```bash
curl localhost:8081/api/health
```

The two things that genuinely need a browser are **rendering** (the chat dock
and alert overlay have to be displayed somewhere) and **browser speech
synthesis**. For TTS the server delegates to whichever surfaces are connected,
and warns in the log if none are. Gemini TTS is synthesised server-side and
only needs a client to play the audio.

---

## Using it from another device

The server holds every credential, connection and automation, so any device
that can reach it gets the same fully-configured app. Run it once on the
machine that hosts your stream, then open the UI anywhere.

**On the host machine**, build once and serve everything from a single port:

```bash
npm run serve
```

**On any other device** — laptop, phone, tablet — open:

```
http://<host-machine-ip>:8081
```

Everything is already synced: connected accounts, commands, actions, alerts,
XP. Nothing needs configuring twice, and closing the tab changes nothing.

A few things worth knowing:

- **Log in to platforms once, on the host.** OAuth redirect URLs are registered
  per-origin, so signing in from `http://192.168.1.50:8081` would need that
  exact URL added to your Twitch app. Do the login once on the host machine and
  every other device inherits the session, because the tokens live server-side.
- **Prefer `npm run serve` over `npm run dev` for this.** In dev the UI is on
  port 5173 and the API on 8081 — two different origins, which means two
  separate `localStorage` buckets and a second Twitch redirect URL to register.
  The single-port build avoids all of it.
- **Shared config lives on the server** (client IDs, channels, commands,
  alerts). Only per-display preferences stay device-local: theme, font sizes,
  chat chrome. That is deliberate — two overlays on two monitors should be able
  to look different.
- **Firewall:** Windows will likely prompt the first time something connects
  from another machine. Allow it on private networks.
- **Switch sign-in on before it can be reached from outside your home**
  (Settings → Sign-in). Until then there is no authentication: anybody who can
  reach the port has all of it. With it on, only you and the moderators of your
  Twitch channel can open the dashboard and the docks, and pages in OBS show
  with a page key in their links. Set `HOST=127.0.0.1` to restrict it to the
  host machine only.
- **Signing in with Twitch comes back to the address it was opened at**, so
  every address you or your moderators use — `http://192.168.1.50:8081`, a
  public address in front of the app — has to be added to your Twitch app's
  OAuth Redirect URLs (dev.twitch.tv → Your Console → Applications).

To point a dev-mode UI at a server on another machine, append
`?server=ws://<host-ip>:8081` to the URL.

## Connecting a separate bot account

Twitch authorises whichever account your browser is already signed into, so
clicking "Connect Bot" in the same window tends to reconnect your main account.
The login now always shows Twitch's consent screen (`force_verify`), and warns
if the returning account is the one already connected as main — but the browser
session is still the thing that decides.

The reliable way, which the server architecture makes easy:

1. Open the app in a **private / incognito window** — a separate cookie jar, so
   it has no Twitch session.
2. Sign in to Twitch there as the **bot** account.
3. Go to Connections and click **Connect Bot**.

Because credentials live on the server, your normal window will show the bot as
connected straight away. Close the private window; nothing was stored in it.

The same trick works from a second device — a phone signed into the bot account
can connect it, and the host picks it up.

## OBS setup

Point OBS browser sources at the server:

| Source | URL |
|---|---|
| Chat dock | `http://localhost:8081/?mode=dock` |
| The stream (every layer, chat included) | `http://localhost:8081/?mode=canvas` |
| Alerts only | `http://localhost:8081/?mode=alerts` |

Copy these from their screens in the app rather than typing them: once sign-in
is on, the pages OBS shows carry a page key in their links, and the dock signs
in like any browser.

The chat on stream is a layer on a layout, with its own settings on the
Overlays screen, so it changes with the overlay profile like everything else.
The standalone chat page (`?mode=overlay`) is retired and draws nothing.

Stream tags are also mirrored to plain text files, so a **Text (GDI+) → Read
from file** source works with no browser at all:

```
data/tags/latestFollower.txt
data/tags/topDonation.txt
```

Or over HTTP at `http://localhost:8081/tags/latestFollower.txt`.

### Live TikTok counters

While connected to a TikTok live, two more files are kept up to date the same
way — no configuration needed, just point a text source at them:

```
data/tags/tiktokViewers.txt    current viewer count
data/tags/tiktokLikes.txt      cumulative likes for the stream
```

Writes are throttled to once a second, because likes arrive many times per
second on a busy stream.

---

## Layout

```
server/           headless service — the whole application
  core/           event bus, atomic store, queues, logging
  engine/         commands, cooldowns, conditions, steps, alerts, tags
  platforms/      twitch, tiktok, youtube, discord, obs, spotify, droidcam, tts
  leveling/       unified XP + identity linking
  api/            REST + WebSocket hub
  scripts/smoke.js  end-to-end test, no network needed — runs scripts/smoke/,
                    a file per part of the app, on one engine, in order

shared/           code both sides run: wire protocol, style presets,
                  layer conditions and motion, dock built-ins

web/              config UI, dock and overlays
  App.tsx         shell and navigation
  components/     screens (views/), layers, panels, overlays
  hooks/          thin client over the one server socket
```

---

## Testing

```bash
npm --prefix server run test
```

Boots the engine with stub platforms, pushes synthetic chat and events through
the bus, and asserts on the results — permissions, cooldowns, condition
branching, variable interpolation, event filters, tag updates and the
recursion guard. No network, no OBS, no browser.

### Developing

```bash
npm run dev
```

Runs the server on `:8081` and the UI on `:5173`, reloading as you edit.
It has no updater; keep a development copy up to date with git.

---
