# Privacy

SimonSays is software you run yourself, on your own computer or on a spare
PC or phone on your network. It has no website and no accounts, and it sends
nothing to the people who make it: no analytics, no crash reports, no
tracking of any kind.

## Who is responsible for the data

Whoever runs it. Each copy keeps its data on the machine it runs on, and the
streamer running it decides what it connects to. That makes the streamer
responsible for their viewers' data under the rules where they stream (the
GDPR in the EU, for example). The authors never see any of it.

## What it keeps, and where

Everything is in two folders beside the server — `data/` (settings and
records) and `assets/` (the pictures, sounds and fonts you upload) — and in
`.env`, if you put sign-ins there.

- **Your sign-ins:** the keys and tokens for the platforms you connect. The
  server keeps them; they are never sent to a browser, and backups leave
  them out.
- **Your setup:** commands, actions, alerts, layouts, themes, Discord
  messages and every other setting.
- **About your viewers**, from the chats and events of the platforms you
  connect:
  - their names and account ids on each platform, and which accounts are one
    person, when they or you link them;
  - levels, XP, points and what they bought with them;
  - counts of what they did — when they were first and last seen, messages
    per platform, streams they took part in, bits, subs, gifts and Super
    Chats, giveaways won. Counts, not the messages themselves;
  - the most recent chat messages and events, for the chat dock and the
    events list;
  - questions, game requests, giveaway entries and the players list;
  - from Discord, members' ids, names and roles, where role menus, role
    sync, welcome messages or the call overlay need them.
- **Your streams:** when each one ran, and its chapters and highlights.

## What leaves your computer

Only what a feature you turn on needs, sent straight to that service:

- **Twitch, YouTube (Google), Discord and Spotify**, once connected: reading
  chat and events, and doing what your actions ask — posting, changing a
  title, giving a role, playing a song.
- **TikTok LIVE**, through Euler Stream (eulerstream.com), the signing
  service the TikTok connection relies on. It sees which TikTok LIVE is being
  connected to.
- **VDO.Ninja**, if you use remote players: the players' video goes through
  it, and the server asks it whether each seat is live.
- **Google Gemini**, only if you choose Gemini as the text-to-speech voice:
  the text to be spoken.
- **jsDelivr**, for the emoji pictures on welcome cards, asked for by the
  emoji's code.
- **Pictures** from the addresses you give (Discord pages, welcome cards),
  and avatars and emotes from the platforms' own image servers.
- **OBS and DroidCam**, on your own network.

Each service handles what it receives under its own privacy policy.

## Cookies

None. The dashboard keeps a few preferences in the browser — the colour
theme, which server to talk to — and they stay on that device. There are no
ads, no analytics and no outside scripts, and the fonts ship with the app.

## Keeping it private

- The dashboard has no sign-in. Keep it on your own network, and never open
  its port to the internet. It asks search engines not to index it, but that
  is a request, not a lock.
- A backup is a file you download, with the sign-ins left out on purpose.
  It still holds your viewers' data, so keep it as privately as the app.

## Deleting

- **Levels & XP** can forget people after 3, 6 or 12 months away — those with
  a single account and no points to spend. It is off unless you choose it.
- To delete everything, stop the server and delete `data/` (and `assets/`).
- To end the app's access to an account, remove it on that platform: the bot
  from your Discord server, and the app from your connected apps on Twitch,
  Google and Spotify.
