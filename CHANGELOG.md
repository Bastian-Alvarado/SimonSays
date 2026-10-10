# Changelog

Newest first. Versions are **major.minor.patch**: patch for fixes, minor for something new, major for something you must redo (an old backup that won't load, a removed feature, signing in again). The app shows its version under Settings → About.

## [1.1.3] — 2026-10-10

- Deck on a phone held sideways: the page folds its rows side by side so the buttons are bigger, the tabs and page buttons move to the sides, and "Phone sideways" in Dock Actions can show two pages at once instead.
- Full screen and keep-the-screen-on buttons on the sideways deck (keeping it on needs the https address).
- The menu starts collapsed except the section you are in, and layer groups in Overlays start collapsed.
- Guides count YouTube, TikTok and OBS as set up once they are, even when not live; the sidebar still lights only what is connected.

## [1.1.2] — 2026-10-09

- "!pregunta" works in any Discord channel and is answered there. Built-in chat words step aside only for a command of your own that has an action.
- Overlays: a switch gives every layout of the profile the same accent.
- Named pixel avatars: name an avatar layer and pick that name on other layouts; they share one set of settings.

## [1.1.1] — 2026-10-08

- Dock Actions on a phone: the page scrolls, so the deck preview shows in full, and the columns, rows and Open deck controls wrap instead of running off the screen.
- Deck: the page buttons are 40px, and the editor can put them above the buttons or below.

## [1.1.0] — 2026-10-08

- Alerts: Skip and Pause / resume, on the Alerts screen and as deck buttons; waiting alerts can be dropped.
- An alert that fires while the scene on stream shows none waits for one that does (up to 30 minutes; can be turned off).
- An alert's sound plays once, from the page that reads it aloud, even with two alert pages in OBS.
- {words.*} are in Spanish (seguidor, suscriptor, miembro…) and listed under Variables.
- Variations for any-platform and YouTube alerts (Super Chats by amount), with every field, uploads, and "Fire this one on stream".
- Deck: the pages are numbered buttons, one tap to any page.

## [1.0.5] — 2026-10-08

- Alerts read aloud now play from the stream page that follows your OBS scene, instead of the chat dock.
- Alerts screen: every label in both languages, new alerts start with Spanish captions, and "Fires on" names the platform.
- "Fire on stream" fills every field (level, prize, reward, Super Chat amount), and the preview shows {words.*} as the stream will.
- A failed alert upload says why, and deleting an alert asks first.

## [1.0.4] — 2026-10-08

- Pixel avatars: the page uses the full width, like the overlay editor, and the canvas grows to fit.
- The avatar list is now a dropdown at the top of the editor: the open avatar with its picture, the rest with theirs when opened. New, from a file and the examples are at its foot.

## [1.0.3] — 2026-10-08

- Pixel avatar editor: one list, with a Side | Front switch over the canvas. "+ Front" starts what isn't drawn from the front yet.
- Any face can be drawn from the front.
- Sandwichxample: side view corrected (a stray pixel, the blush, and the hats, headset and pick centred).
- An example edited back to the shipped one gets updates again.

## [1.0.2] — 2026-10-08

- Pixel avatar editor: side view first, front view folded below, every hat under Hats.
- The preview faces the view being drawn.

## [1.0.1] — 2026-10-07

- Pixel avatars that turn: outfits, hats and extras can be drawn from the front, so they show while it faces you. Sandwichxample has them all.
- It turns to its side to drink or wave.
- Examples nobody edited update themselves on the next start.

## [1.0.0] — 2026-10-06

The first public release.

- **Runs on its own:** a server keeps chat, alerts, XP, Discord and OBS going with every browser closed. Sign-ins stay on the server. English and Spanish.
- **Platforms:** Twitch (with a bot account, shoutouts, clips, markers and the schedule), YouTube, TikTok LIVE, Discord, OBS, Spotify and DroidCam.
- **On screen:** layouts of layers, switched by OBS scene or Omnilayer; overlay profiles; two themes (SimonSays Default and Cyberpunky) plus your own; alerts, chat, omnibar, timers, goals, run card, plan, polls, giveaways, questions, players, Spotify, the Discord call, a PNGtuber and pixel avatars, with Sandwichxample as the example; remote players through VDO.Ninja. Picture pickers stay smooth with big GIFs.
- **Community:** levels and XP, points and a shop, game requests, stream history, accounts linked across platforms.
- **Discord:** welcome cards, role menus and role sync, pages, go-live posts, recaps, scheduled events, chat relay, a voice call overlay.
- **Automation:** commands and actions, Dock Actions, the chat dock.
- **Help:** guides with setup steps and platform walkthroughs, backups without sign-ins, a [privacy note](PRIVACY.md), and a page for addresses that don't exist.
