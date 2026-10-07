# Architecture

## The one rule

**The server owns all state. Clients are replicas.**

Every design decision follows from that. If a client could own something, then
closing that client would lose it — which is the exact failure V3 exists to
remove.

---

## Data flow

```
  Twitch IRC ─┐
  EventSub   ─┤
  TikTok     ─┼─> platforms/ ──normalise──> core/bus ──┬─> engine/    ──> actions
  Discord    ─┤                                        ├─> leveling/  ──> XP
  OBS        ─┤                                        ├─> relays     ──> Discord
  Spotify    ─┘                                        └─> api/ws     ──> clients
```

Platforms never call the engine. The engine never calls a platform connector
directly — it receives a `services` object at init. Everything meets on the bus.
That is what makes the smoke test possible: swap in stub services and the entire
pipeline runs with no network.

---

## Layers

### `core/`

- **`bus.js`** — the event bus. A listener that throws is isolated, so one bad
  subscriber cannot stop an event reaching the others. Also holds
  `normaliseChat` / `normaliseEvent`, which are why the engine can treat a
  TikTok gift and a Twitch cheer identically.
- **`store.js`** — durable JSON collections. Atomic writes (temp + rename),
  debounced to coalesce bursts, synchronous flush on shutdown. A corrupt file
  falls back to defaults *independently* and is preserved as `.corrupt.<ts>`
  rather than overwritten.
- **`queue.js`** — named, rate-limited serial queues.
- **`logger.js`** — levelled logging with a 500-entry ring buffer exposed at
  `/api/logs`.

### `engine/`

The part that used to live in the browser.

- **`commands.js`** — trigger matching (longest wins, so `!top10` isn't
  shadowed by `!top`) and permissions.
- **`cooldowns.js`** — global and per-user, with role-based bypass. In-memory
  by design; cooldowns should reset on restart.
- **`conditions.js`** — condition evaluation. Normalises V2's legacy
  single-condition shape on *read*, so old saved actions keep working without a
  destructive migration.
- **`variables.js`** — `{user}` interpolation and `user.isSub` / `random.1-100`
  resolution. Unknown paths are left intact so typos are visible rather than
  silently becoming `undefined`.
- **`steps.js`** — the step executor. Depth-limited and cycle-guarded; a failing
  step is logged and skipped rather than aborting the rest of the run.
- **`alerts.js`** — matching and dispatch. Message text is rendered *server-side*
  so every connected overlay shows identical output.
- **`tags.js`** — stream tags, persisted and mirrored to `data/tags/*.txt`.
- **`discord-roles.js`** — reaction roles, button roles, welcome/goodbye.

### `platforms/`

Each module owns one integration and exports:

- `init*()` — load credentials, optionally auto-connect
- `getStatus()` — for the snapshot
- `connect()` / `disconnect()`
- `service` — the narrow surface the engine's steps are allowed to call

Credentials live in the store, never in code, and `getCredentials()`
deliberately returns `hasToken: boolean` rather than the token itself. Secrets
do not travel to clients.

### `api/`

- **`ws.js`** — the hub. Sends a full snapshot on connect, then deltas. Handles
  every client→server message. Dead connections are reaped by a 30s ping sweep.
- **`http.js`** — REST for monitoring, plus static hosting of the built UI with
  SPA fallback and a directory-traversal guard.

---

## Client contract

`useStreamSystem` returns the identical object V2 returned:

```
{ data, settings, status, connections, actions, spotify }
```

`App.tsx` cannot tell the difference. Internally:

- `data.*` is read from the server snapshot
- `actions.*` are requests to the server
- `settings.*` stay device-local (theme, font sizes, chat chrome) — two
  overlays on two monitors should be able to look different
- `chatMessages` and `alertQueue` are per-surface render state

### Why one socket instead of six

V2 opened a socket per platform hook plus a config socket. Each was a separate
reconnect path, a separate failure mode, and a separate source of truth. V3 has
one connection carrying a typed protocol, with request/response correlation via
message ids and exponential-backoff reconnect.

---

## Things that must stay in the browser

Only two, and both are genuine browser capabilities:

1. **Rendering.** The dock and overlay have to be displayed somewhere.
2. **`speechSynthesis`.** No headless equivalent. The server emits a `DEVICE`
   event that connected clients perform, and logs a warning when none are
   attached. Gemini TTS avoids this entirely by synthesising server-side and
   shipping audio down.

OAuth *initiation* is also browser-side, because it is a user-facing redirect —
but the resulting token is handed to the server immediately and never used from
the client.

---

## Extending it

**A new platform:** add `platforms/foo.js` that emits `normaliseChat` /
`normaliseEvent` onto the bus. The engine, leveling, relays and every client
pick it up with no further changes.

**A new action step:** add a `case` in `engine/steps.js` and the matching string
to `ActionStepType` in `web/types.ts`.

**A new trigger:** emit an event whose `type` matches a `TriggerType`. The
filtering hook is `passesFilter` in `engine/index.js`.
