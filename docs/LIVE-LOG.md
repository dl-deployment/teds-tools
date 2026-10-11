# Live Log

Send log lines from any project and watch them appear on `/livelog` in real
time. Nothing is stored: logs live in the realtime server's memory and in the
open page, and both are gone on the next restart or refresh.

- Page: `/livelog`
- SDK: `public/livelog.js` (classic script) and `public/livelog.esm.js` (module)
- Realtime server: `public/livelog-server/` — its own deployable, downloadable
  from the page itself, with its own
  [README](../public/livelog-server/README.md) covering hosting and ops

## Data flow

```
External project (browser, game, service)
    │  LiveLog.info("Player connected", { playerId: 123 })
    ▼
public/livelog.js                              [served by Vercel, static]
    │  queue → retry → POST /api/log
    │  Authorization: Bearer <token>
    ▼
livelog-server  ── ONE long-lived Node process ────────────────
   (source at public/livelog-server, downloadable from the page)
    │  verify token owns the channel · rate limit · size limits
    │  append to that channel's in-memory ring buffer (5000 max)
    │  broadcast to every viewer subscribed to the channel
    ▼
WS /ws                                         [the only persistent connection]
    ▼
/livelog page                                  [Vercel, Next.js — UI only]
    │  dedupe by seq → cap at 5000 → virtualised render
    ▼
DOM
```

### What runs where, and why

| Runs on Vercel | Runs on the realtime server |
|---|---|
| The whole Next.js app, including `/livelog` | `POST /api/log` (ingest) |
| `public/livelog.js` + `public/livelog.esm.js`, served as static files | `WS /ws` (broadcast) |
| The browser-side socket client, dedupe, buffering, filtering, rendering | Token check, rate limiting, size limits, ring buffers, backlog replay |
| — | `GET /api/channels`, `GET /healthz` |
| The server's own source at `public/livelog-server/`, so the page can zip it up for download | — |

**There is no `app/api/**` route and no database.** The SDK posts straight to
the realtime server, so the Next app stays purely frontend.

The split is not a preference. A Vercel serverless function cannot hold a
WebSocket open, and two invocations of the same function don't share memory — so
a log POSTed to instance A could never reach a viewer connected to instance B.
A function pretending to be a socket would be worse than no socket at all.
Instead the two halves are honest about what they are: Vercel serves files and
renders the page; one persistent Node process owns the socket and the broadcast.

## 1. Installation

Add the SDK to the project that produces the logs:

```html
<script src="https://YOUR-DOMAIN/livelog.js"></script>
```

Or import the module — same code, for bundlers and module scripts:

```js
import { LiveLog } from "https://YOUR-DOMAIN/livelog.esm.js";
```

The two files are one implementation. `livelog.js` deliberately contains no
`import`/`export` statements, which is what lets a plain `<script>` tag load it;
`livelog.esm.js` imports it for its side effect and re-exports `LiveLog`. (The
`.esm.js` extension is deliberate: module scripts are refused unless the response
carries a JavaScript MIME type, and `.js` always does while `.mjs` has no
guaranteed mapping on static hosts.)

## 2. Initialisation

```js
LiveLog.init({
  channel: "default",
  token: "YOUR_TOKEN",
  source: "GameClient",
});
```

| Option | Meaning |
|---|---|
| `channel` | Required. Which channel these logs belong to. |
| `token` | Required to send. Comes from the server's `tokens.json`; must list this channel. |
| `source` | Optional label shown in the `[brackets]` on each line. |
| `endpoint` (or `url`) | Origin of the realtime server. Defaults to the origin the SDK was loaded from. |
| `debug` | `true` logs the SDK's own decisions to the browser console. |
| `maxQueue`, `maxRetries`, `retryBaseMs`, `flushMs` | Queue tuning, if the defaults don't suit. |

Watching a channel on `/livelog` needs no token — only *sending* does.

## 3. Sending logs

```js
LiveLog.debug("Debug message");
LiveLog.info("Info message");
LiveLog.warn("Warning message");
LiveLog.error("Error message");
```

## 4. Structured data

```js
LiveLog.info("Player joined", { playerId: 123, username: "Duc" });
```

The second argument becomes the `data` field, and the page renders it as JSON
when you click the line.

The general form, if you want to set the level or channel per call:

```js
LiveLog.send({
  level: "info",
  message: "Player connected",
  data: { playerId: 123, roomId: "room_01" },
});
```

## 5. Viewing

Open `/livelog` and pick the channel in the sub-sidebar. The toolbar gives you
level filters, a source filter, search, pause/resume, auto-scroll, clear, copy
one line, and copy-all. Clicking a row expands its `data` as formatted JSON.

The status dot reads **● Connected** or **○ Disconnected**, and the page
reconnects on its own with exponential backoff — killing the server and starting
it again does not need a page refresh.

### Channels on more than one machine

A channel can carry its own server address, which is what lets one page watch
channels living on different machines. Give the address when you add the channel
(**+** → *Server*); the sub-sidebar then shows each channel with the host it lives
on, and picking a channel switches the page to that server. A channel with no
address of its own uses the default from the Server dialog.

The name alone is not the identity: `default` on two machines is two rows with
two separate streams, because each server keeps its own ring buffer. Nothing
merges them — one server per channel — so a same-named channel on two machines
means switching between rows to see each one.

## 6. Behaviour worth knowing

**The SDK never breaks the host application.** Every public method is wrapped:
they return a boolean instead of throwing, network failures are swallowed, and
logs are queued (bounded, oldest dropped first) and retried a few times before
being abandoned. `LiveLog.info(...)` inside a hot loop that never reaches the
server costs memory in the queue and nothing else. `LiveLog.debug(...)` calls
made *before* `init()` are buffered and sent once it has a channel and token.

**Nothing is persisted, anywhere.** The server keeps each channel's last 5000
logs in memory only, and replays the newest 200 to a viewer when it subscribes.
Restart the server and those are gone. Refresh the page and it starts empty
again (the 200-line replay arrives, then the live stream). This is the
requirement, not a limitation — there is no database, no Redis, no disk.

**Ordering and duplicates.** The server stamps every log with its own
`timestamp` and a monotonic `seq`, so a client with a wrong clock can't reorder
the stream and a replayed backlog can't produce duplicate rows. The status
reports a new server `instance` after a restart, which resets that watermark.

**Limits, per log:** message ≤ 10 KB, `data` ≤ 50 KB, `source` ≤ 64 chars,
`level` one of `debug|info|warn|error`, `channel` matching
`[a-zA-Z0-9._-]{1,64}` and owned by the token.

**Limits, per token and channel:** 20 logs/s sustained with a burst of 100,
configurable on the server. Exceeding it returns `429`; the SDK treats a refusal
as final and drops the entry rather than retrying forever.

**Channel names are effectively public.** The page lists active channels and any
configured ones, and reads are unauthenticated by design — so treat the channel
name as a capability and make a sensitive one unguessable.

## 7. Configuration

### Vercel (this app)

Set these in **both** Preview and Production, then redeploy — `NEXT_PUBLIC_*`
values are inlined at build time.

| Variable | Example | Purpose |
|---|---|---|
| `NEXT_PUBLIC_LIVELOG_URL` | `https://livelog.example.com` | REST base of the realtime server |
| `NEXT_PUBLIC_LIVELOG_WS_URL` | `wss://livelog.example.com/ws` | Viewer socket; derived from the above if omitted |
| `NEXT_PUBLIC_LIVELOG_CHANNELS` | `default` | Channels offered in the sub-sidebar |
| `NEXT_PUBLIC_LIVELOG_DEFAULT_CHANNEL` | `default` | Selected on first load |

None of these are secret. `ws://` is blocked as mixed content on an HTTPS page,
so the socket URL must be `wss://` in production.

**They are only defaults.** The **Server** dialog on `/livelog` saves an
override in the browser (through `useHubData`, next to the watched channel), so
a deployed hub can be pointed at a different server without a rebuild — and a
hub with none of these variables set still works, as long as someone enters an
address. An override beats the variable; **Use defaults** clears it; the socket
address is derived from the server address whenever it is left empty. The
toolbar shows the host currently in use.

Precedence, highest first: **the watched channel's own address** (see
"Channels on more than one machine"), then the Server dialog's saved address,
then these variables. The dialog edits the default only — its *In use* box always
shows the pair actually in effect.

### Realtime server

`PORT`, `LIVELOG_TOKENS` / `LIVELOG_TOKENS_FILE`,
`LIVELOG_ALLOWED_ORIGINS`, the size caps, the rate limits and the connection
caps — all listed with defaults in
[`public/livelog-server/env.example`](../public/livelog-server/env.example)
and explained in
[`public/livelog-server/README.md`](../public/livelog-server/README.md).

## 8. Deployment

**The Next app** deploys to Vercel as before — no config change, no API routes.
Add the four `NEXT_PUBLIC_*` variables, or leave them out and set the address in
the page. `public/livelog-server/` is deployed *with* the app, since that is how
the download reaches people; `.vercelignore` only keeps its `node_modules` and
any real `tokens.json` out of the upload, and the folder carries no lockfile, so
Vercel still finds exactly one.

**The realtime server** needs a host that keeps one process alive with a socket
open. Fly.io is the recommended one (WebSockets work through its proxy, and a
machine can be pinned so it never sleeps); Render, Railway and a plain VPS
behind Caddy all work too. Step-by-step instructions, including the Fly
secrets for tokens and why `auto_stop_machines` must be `false`, are in
[`public/livelog-server/README.md`](../public/livelog-server/README.md).

Two things that bite: run **exactly one instance** (each process has its own
`seq` counter and its own viewers, so a second one would only broadcast to part
of the audience), and never let the host scale to zero (that drops every socket
*and* every log).

## 9. Local development

```bash
npm run livelog:install                    # once
cp public/livelog-server/tokens.example.json public/livelog-server/tokens.json
npm run livelog:dev                        # terminal 1 — realtime server on :8787
npm run dev                                # terminal 2 — the hub on :3000
```

`.env.local` should hold:

```
NEXT_PUBLIC_LIVELOG_URL=http://localhost:8787
NEXT_PUBLIC_LIVELOG_WS_URL=ws://localhost:8787/ws
NEXT_PUBLIC_LIVELOG_CHANNELS=default
NEXT_PUBLIC_LIVELOG_DEFAULT_CHANNEL=default
```

Then, with `/livelog` open:

```bash
curl -i -X POST http://localhost:8787/api/log \
  -H "Authorization: Bearer tk_live_replace_me_default" \
  -H "Content-Type: application/json" \
  -d '{"channel":"default","level":"info","source":"GameClient","message":"Player connected","data":{"playerId":123,"roomId":"room_01"}}'
```

`public/livelog-server/tokens.json` is gitignored on purpose — it holds write
tokens, and the folder it lives in is served publicly by the hub.

## 10. Downloading the server

`public/livelog-server/` is part of the deployment on purpose: the **Server**
dialog (and the setup card on a page with no server yet) zips it in the browser
and saves `teds-tools-livelog-server.zip`, so running your own server needs no
clone — unzip, `npm install`, `npm start`.

`SERVER_FILES` in `lib/livelog.js` is the allowlist that zip is built from. It is
an explicit list rather than a directory scan so that the two things which must
never leave that folder cannot: a real `tokens.json` (gitignored) and an
installed `node_modules` (gitignored, and in `.vercelignore`).

Since the hub serves the folder, **anything placed there is public**. It holds
only the server's source plus `tokens.example.json` and `env.example`, which are
templates full of placeholder tokens.

Two naming details there are forced by the hub rather than chosen: the env
template is `env.example` (not `.env.example`) and there is no `.dockerignore`,
because **Next refuses to serve dotfiles out of `public/`** — a 400, which would
break the zip. The Dockerfile copies `server.js` and `lib/` explicitly instead of
relying on a `.dockerignore` to keep a host `node_modules` out of the image.
