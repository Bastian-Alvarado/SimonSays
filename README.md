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
- **Guides** inside the app walk a new streamer through setting it all up,
  including each platform's keys, click by click.

English and Spanish throughout. What changed in each version is in
[CHANGELOG.md](CHANGELOG.md).

## Privacy

It runs on your own computer and sends nothing to the people who make it: no
analytics, no tracking, no cookies. What it keeps about you and your viewers,
where, and what reaches which service is in [PRIVACY.md](PRIVACY.md).

## License

Source available under the Apache License 2.0 with the **Commons Clause**
(see [LICENSE](LICENSE)). In plain words: use it for your own streams —
monetized ones included — change it and share it, as long as the license
goes with it; but do not sell it, or sell hosting, setup or support whose
value is mainly SimonSays itself.

---

## Quick start

```bash
npm install
```

```bash
cp .env.example .env
```

Fill in whichever platforms you use — anything left blank simply stays
disconnected. Then:

```bash
npm run dev
```

That runs the server on `:8081` and the config UI on `:5173`.

Leave that terminal running — it *is* the service. Closing it stops everything.

For production, build the UI once and let the server host it:

```bash
npm run serve
```

Everything is then on `http://localhost:8081`.

> **Windows PowerShell note.** PowerShell 5.1 has no `&&` operator, so
> `cd "path" && npm run dev` fails with *"The token '&&' is not a valid
> statement separator in this version."* Use `;` instead:
>
> ```
> cd "C:\path\to\SimonSays"; npm run dev
> ```
>
> Or just `cd` first and run `npm run dev` on its own line.

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
- **Do not expose this to the internet as-is** — there is no authentication.
  It is built for a trusted LAN. Set `HOST=127.0.0.1` to restrict it to the
  host machine only.

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

---
