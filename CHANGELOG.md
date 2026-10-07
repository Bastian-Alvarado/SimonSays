# Changelog

Every version of SimonSays, newest first.

Versions are numbered **major.minor.patch**:

- **patch** (1.0.**1**): fixes and wording, nothing new to learn.
- **minor** (1.**1**.0): something new, and everything that was there still works.
- **major** (**2**.0.0): something you have to do or redo to keep working, such as a backup older versions can't read, a feature taken out, or signing in to every platform again.

The app shows its version under Settings → About, and the server reports it at `/api/health`.

## [1.0.1] — 2026-10-07

A hot fix for pixel avatars that turn.

- **Outfits, hats and extras from the front.** An avatar that turns faces the front most of the time, and from the front it showed none of its outfit, hat, blush, sweat drop or mic. Each can now be drawn from the front too, in the editor under "Worn from the front", which also says what is still missing. Sandwichxample has all of them.
- **What it does is seen.** Drinking water or waving while it faces the front, it turns to its side to do it, then faces the front again.
- **Examples catch up.** An example nobody has changed is brought up to date on the next start, keeping its name, and what it was is kept as a version. One you changed is left as it is.

## [1.0.0] — 2026-10-06

The first public release.

### Runs on its own
- A server does all the work: chat commands, alerts, XP, Discord and OBS keep running with every browser closed.
- One app for every device on your network, already set up. Sign-ins live on the server and are never sent back to a browser.
- English and Spanish throughout.

### Platforms
- **Twitch:** chat, follows, subs, cheers, raids, channel points and hype trains; a separate bot account; shoutouts, clips, stream markers and the schedule; title and category changes.
- **YouTube:** chat, members, gifted memberships and Super Chats; title and description changes.
- **TikTok LIVE:** chat, gifts, likes, follows and shares. It finds your LIVE on its own.
- **Discord:** a bot of your own.
- **OBS:** scenes, sources, filters, volume, recording and replay.
- **Spotify:** the song now playing, song requests and music control.
- **DroidCam:** control of a phone camera.

### On screen
- **Layouts:** built from layers, bound to OBS scenes or switched by **Omnilayer**, which puts the whole stream in one OBS scene. **Scene types** let one command work across every profile.
- **Overlay profiles:** one per kind of stream, each switched as a whole.
- **Themes:** SimonSays Default and Cyberpunky, or make your own: copy and edit them piece by piece, change colours, sizes and fonts across a whole theme, save a layout's looks as a theme, and share a theme as a file with its fonts.
- **What can go on a layout:** alerts, chat on stream, the omnibar, viewer count, stream labels, countdown and run timer, goals and a death counter, the run card, the stream plan, polls, giveaways and questions, game night players, people on stream, Spotify, the Discord call, a PNGtuber, and pixel avatars with an editor of their own.
- **Pixel avatars:** Sandwichxample is the example — every face from the side and the front, extras, three hats, three outfits, drinking water and waving.
- **Remote players:** up to four players send their game through VDO.Ninja, and any seat can go full screen from a button or a chat command.
- **Picking pictures** stays smooth however big and moving the uploads are: the ones to choose from, and the one chosen, show their first frame, and a preview's moving pictures can be stopped.

### Community
- Levels and XP across every platform, points with a shop, game requests, and stream history.
- Viewers link their accounts across platforms, and roles follow.

### Discord
- Welcome and goodbye messages with a drawn card.
- Role menus using buttons or reactions, and roles that sync with subs, levels and loyalty.
- Discord pages built from blocks.
- Go-live posts and DMs, a recap after each stream, and scheduled events.
- Chat relayed both ways, and a voice call overlay that reacts to who's talking.

### Automation
- Commands and actions: triggers from every platform and from the app itself, plus steps for chat, overlays, OBS, Discord, music and more.
- Dock Actions: a grid of buttons in the chat dock and on your phone.
- The chat dock: every platform's chat in one OBS dock.

### Help and safekeeping
- **Guides:** setup steps that tick themselves off, click-by-click walkthroughs for connecting each platform, fifteen task guides, a reference built from your own setup, a glossary, and a "?" on every screen that has a guide.
- Backups to a file, with sign-ins left out on purpose.
- **Privacy:** [PRIVACY.md](PRIVACY.md) says what is kept, where, and what reaches which service. No analytics, no cookies, and the dashboard asks search engines not to index it.
- An address with no page behind it — an OBS link typed wrong, say — says so instead of opening the dashboard, and each screen is named in the browser tab.
