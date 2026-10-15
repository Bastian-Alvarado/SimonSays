# Changelog

Newest first. Versions are **major.minor.patch**: patch for fixes, minor for something new, major for something you must redo (an old backup that won't load, a removed feature, signing in again). The app shows its version under Settings → About.

## [2.2.1] — 2026-10-15

- YouTube chat costs a fraction of the daily allowance: the app now keeps one connection open and YouTube sends messages as they are written, where before it asked every seven seconds — about 2,600 of the day’s 10,000 units an hour, so chat could stop after three or four hours of streaming. If YouTube refuses the connection, or keeps closing it within moments, the app goes back to asking every seven seconds for that broadcast. The Connections screen says which it is doing.
- The Roadmap plans five more major updates: 5.0.0 The creators update, 6.0.0 The easy install update, 7.0.0 The automation update, 8.0.0 The insights update and 9.0.0 The on-the-go update, each with what it is planned to bring.

## [2.2.0] — 2026-10-15

- Pixel avatars start plainly: with none yet, the tab offers three ways in — an example, a picture you already have (read in its own colours, the importer open), or an empty grid to draw — and a file, instead of a closed dropdown.
- Drawing is quicker: the pencil and eraser come 1, 2 or 3 pixels wide ([ and ]), the right button rubs out with any drawing tool, Alt and a click picks a colour, Ctrl and the wheel zoom on the pixel pointed at, and Space (or the middle button) and a drag moves around the drawing. Each tool shows its key, and a Keys and mouse list (?) has them all.
- The colours are right over the canvas: the one drawing with, the last ones chosen, and all of them a press away. The colours column now sits beside the canvas on a laptop too, not only on the widest screens.
- The head line is moved by dragging it on the drawing, and the boxes kept the right way round when mirrored, and an outfit’s own face box, are drawn on the drawing, instead of typing row numbers and x0, y0, x1, y1.
- A new pixel avatar can start with a simple character already drawn — a head on a body, talking and blinking — to change rather than start from nothing; or from an empty grid, as before.
- “Getting it ready” over the drawing says what a new avatar still needs to come alive — drawn, the head line placed, a talking face, a blink, and the front view for one that turns — each a press away, with how many are left once it is put away.
- The avatar is shown alive in a corner over the drawing while you draw, talking at a press; it moves to the other corner or out of the way.
- The list of outfits, faces, extras, hats and things it does folds by group, with how many each has and a line on what it is for; a colour’s settings say what they do under them, not only on a hover.

## [2.1.2] — 2026-10-14

- A stream no longer stays “live” for days when its end was missed — OBS crashing, its connection dropping or the app restarting mid-stream. A stream on is checked every few minutes: with OBS, whether it is still streaming; without OBS, whether Twitch still has the channel live; and with neither, a stream nothing has happened in for six hours is over from its last message. One found over long after it ended is kept as ending when it was last known to be on, not as days long, on home, the Streams screen and the recap.
- A stream OBS is already sending when the app connects to it is counted from then, instead of not at all.
- TikTok chat no longer comes in twice. Two connections to TikTok could open side by side (pressing Connect while the app was already looking, or OBS going live during a look), so every message came in twice, and the one left behind kept going after Disconnect. Now there is only ever one, Disconnect really stops it, and a message TikTok sends again shows once.
- TikTok is looked for only while OBS is streaming. Twitch being live decides only when OBS is not connected.

## [2.1.1] — 2026-10-14

- The README has a step-by-step Getting started guide in place of the old quick start: what you need, installing and starting the app, connecting Twitch and OBS, the stream page and dock in OBS, sign-in, and what to do when something goes wrong.

## [2.1.0] — 2026-10-14

- A new home screen, for whoever opens it: a greeting by name; while live, the stream’s viewers per platform and tonight’s follows, subs and bits; offline, the next scheduled stream, the plan and a quick check that OBS and the stream page are ready.
- “Needs you” on the home screen lists only what does — Twitch wanting connecting again, a platform that dropped, a new version, what AutoMod holds, moderators here now — each with a button to where it’s fixed.
- Buttons on the home screen for the layouts you pick, to put one on screen in a press; each moderator picks their own.
- A “Live view” switch on the home screen shows the live view while you’re offline, marked “Live preview”, so you and your moderators can set it up before a stream; each person’s own choice.
- A moderator’s home has their own deck, the chat’s modes and the AutoMod queue. Somebody new gets a welcome with the setup steps still to do, in place of the old headline.
- The OBS setup steps stay done while OBS is closed, on every browser: the server remembers having seen the stream page and the dock in OBS, where before only the browser that saw it did.

## [2.0.0] — 2026-10-13

- **After updating:** connect Twitch again once on the Connections screen, as it asks for new permissions (moderating, the chat’s modes, AutoMod). Copy your OBS links again from their screens, so they carry the page key. Then switch sign-in on in Settings → Sign-in, and add every address you and your moderators open the app at to your Twitch app’s OAuth Redirect URLs (dev.twitch.tv), since signing in with Twitch comes back to it. Sign-in stays off until you switch it on, so nothing changes until then.
- Sign-in for the dashboard (Settings → Sign-in), off until you switch it on: you and your Twitch moderators sign in with Twitch, and an owner key is your way in when Twitch is not. Switching it on needs a sign-in of your own first, so it cannot lock you out.
- Pages OBS shows carry a page key in their links, which lets them draw the stream and nothing else. Links copied from now on have it already; copy older ones again before switching sign-in on.
- With sign-in on, the docks and the dashboard ask who you are, other websites cannot use your sign-in, and moderators cannot touch your connections, backups, updates or pixel avatars.
- Moderators see the overlays and the looks without changing them, and browse every overlay profile without switching yours: picking one shows it to them only, while your stream stays on the live one.
- On Twitch a moderator chats as themselves or as your bot, never as you. Your connections, the Guides, the PNGtuber and the pixel avatar editors are not in their menu.
- Each moderator has their own dock: how it shows the chat, its tabs, and their own stream deck. It starts as a copy of yours; what they change is theirs only, and yours stays as it is.
- A Moderators screen for you alone: who has signed in and who is here now, what each of them did from the dashboard, and buttons to sign one out, turn one away (and let them back in) or put their dock back to yours.
- The viewer counter follows each layout’s accent, as the other layers do, while its accent is left automatic on the Viewer count screen (it says “follows the layout”); a colour picked there is the same on every layout.
- Moderating Twitch chat from the dock: a menu on each message to delete it, time its sender out, ban or unban them; the chat’s modes (slow, emotes only, followers only, subscribers only); and what AutoMod holds back, to let through or keep out. Moderators do it as themselves, so Twitch’s own mod log names them. Two new steps in Actions do the same from a command or a trigger. Connect Twitch again on the Connections screen once, to allow it.

## [1.2.3] — 2026-10-13

- Tidier inside before 2.0.0: unused words and code removed, and security updates to the build tools and the server's packages.
- OBS pages load much less: the dashboard's screens load only when the dashboard opens them, so an overlay downloads about 60% less.
- Data from V2 and from before 1.0's settings changes is no longer converted on start: V2's XP file, its single-check conditions and {username}/{args}, the old chat override map, V1 settings-only backups. Anything saved by 1.x is unaffected.
- New Condition steps start in the list form the editor shows.
- "Somebody says something" trigger: chat with certain words, a start, the whole message or a pattern sets an action off, with cooldowns; {match} is what matched.
- Play a sound step: a sound file from an action, played where alert sounds play.
- Fetch a web address step: ask an address and use the answer as {response} (JSON fields too). It cannot reach the server itself.
- {random.user}: somebody who talked in the last half hour.
- One per line, picked at random, in more places: alert captions and speech, the shoutout and clip chat lines, the !pregunta and !plan replies, live DMs, the "stream over" message, level-up messages, and the welcome card's title, footer and drawn words.

## [1.2.2] — 2026-10-12

- When an action step fails, the server log says which scene, source or filter it was looking for.
- New Logic steps: Wait, Stop here, Repeat, Pick one at random (with weights) and Later.
- Later runs its steps after a set time (up to 7 days) or when the stream ends, even after a restart; using the action again starts the wait over. The Actions screen lists what is waiting, with Run now and Cancel.
- "Add steps here" under any list inside a step: the menus then add any step there, conditions included.
- New triggers: gifted sub bundles, the Hype Train (start, new level, end), Twitch going live and ending, YouTube Super Chats, members and gifted memberships, and somebody's first message this stream or ever.
- The trigger menus no longer redraw themselves while open.

## [1.2.1] — 2026-10-12

- Custom CSS boxes hold 10,000 characters (layers had 2,500), count as you type, and won't save past the limit instead of cutting the end off.
- The vertical canvas can show a mock of TikTok LIVE (name, follow button, comments, gift and share buttons) instead of the shaded areas, to see what it covers.

## [1.2.0] — 2026-10-11

- Updates from the app: Settings → About checks GitHub once a day, and "Update now" backs up your data, installs the new version and restarts into it (and goes back if it won't start). Start the app with `npm run serve` or `npm start` for this.
- Overlays have a vertical side for OBS's vertical canvas (Twitch dual format, TikTok): arrange each layout for vertical, show a layer on both sides or just one, and add the vertical browser source.
- Omnilayer can move sources on a vertical canvas too, where OBS lets it (Aitum Vertical yes, SE.Live's no); OBS source boxes can fill their box, with a fit of their own on vertical.
- Roadmap: every update so far and the big ones planned, under Setup. It doubles as the changelog.
- Stopping or restarting the app takes a second or two instead of waiting for every page.

## [1.1.4] — 2026-10-10

- Error messages are in your language on every screen (Go live, Discord buttons, Role management, Tags, DroidCam, backups and more); DroidCam says whether the phone did not answer or could not be reached.
- The last English labels in the layer panels (nameplate sizes and sides, picture fit) are translated.
- Deck upright: the buttons sit right against the page buttons, with no gap.
- Chat docks: you can send to YouTube with Twitch off, a YouTube-only stream no longer says "Connecting…", and an emoji goes where the cursor is.
- Avatar layers can have an outline, for an avatar on a dark background.

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
