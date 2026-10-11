# Live Log realtime server

The persistent half of Ted's Tools' Live Log. It accepts logs over HTTP, holds
the last few hundred per channel **in memory**, and fans them out to everyone
watching that channel over WebSocket.

Why it exists as a separate deployable: the frontend runs on Vercel, whose
serverless functions can neither hold a socket open nor share memory between
invocations — a log POSTed to one instance could never reach a viewer connected
to another. Nothing here is a workaround for that; it is the correct shape for a
long-lived broadcast. Vercel also has no way to run this, so it needs its own
host.

**No database, no Redis, no disk.** Restarting the process loses every log. That
is the requirement, not a limitation.

> Run **exactly one instance.** Two processes each keep their own viewers and
> their own `seq` counter, so a log broadcast from one never reaches viewers on
> the other. Scaling out would require a shared pub/sub, which would mean
> introducing the persistence this design is built to avoid.

Running the server on two machines is fine — that is simply two installations.
Give each its own channels, and on the Live Log page add each channel with that
machine's address so the page can switch between them (a channel carries the
server it lives on). Nothing merges the two streams: one server per channel.

## Getting it

You don't have to clone the repo to get the server: open the hub's **Live Log**
page, click **Server**, and press **Download** to save
`teds-tools-livelog-server.zip`. Or copy this folder as it is.

Because of that download, **this folder is served publicly by the hub** — treat
anything placed here as world-readable. A real `tokens.json` must never be
committed: it is gitignored, and listed in the repo's `.vercelignore` so a
Vercel CLI deploy skips it too.

## Run it locally

```bash
cd public/livelog-server     # or the folder you unzipped
npm install
cp tokens.example.json tokens.json     # then edit the tokens
LIVELOG_TOKENS_FILE=./tokens.json npm run dev
```

It listens on `http://localhost:8787`. `npm run dev` uses `node --watch`, so
edits restart it.

Point the hub at it either in the repo root's `.env.local`, or at runtime from
the **Server** dialog on the Live Log page — the dialog needs no rebuild:

```
NEXT_PUBLIC_LIVELOG_URL=http://localhost:8787
NEXT_PUBLIC_LIVELOG_WS_URL=ws://localhost:8787/ws
NEXT_PUBLIC_LIVELOG_CHANNELS=default
NEXT_PUBLIC_LIVELOG_DEFAULT_CHANNEL=default
```

Then send something:

```bash
curl -i -X POST http://localhost:8787/api/log \
  -H "Authorization: Bearer tk_live_replace_me_default" \
  -H "Content-Type: application/json" \
  -d '{"channel":"default","level":"info","source":"GameClient","message":"Player connected","data":{"playerId":123}}'
```

## API

### `POST /api/log`

```
Authorization: Bearer <token>
Content-Type: application/json

{ "channel": "default", "level": "info", "source": "GameClient",
  "message": "Player connected", "data": { "playerId": 123 } }

202 { "ok": true, "seq": 42, "timestamp": 1791330135123 }
401 invalid/missing token      403 token doesn't own that channel
400 bad channel/level/message  413 over a size cap
429 rate limited               503 channel capacity reached
```

### `GET /api/channels`

Channels with recent traffic, for the page's channel list:

```json
{ "channels": [ { "name": "default", "subscribers": 2, "recent": 184, "lastAt": 1791330135123 } ] }
```

### `GET /healthz`

`{ "ok": true, "uptime": 3610, "channels": 2, "subscribers": 3 }` — used as the
Fly health check.

### `WS /ws`

```
client → { "type": "subscribe", "channel": "default" }
         { "type": "unsubscribe" }        // leave the current channel
         { "type": "ping" }

server → { "type": "ready", "channel": "default", "instance": "<uuid>" }
         { "type": "backlog", "channel": "default", "logs": [ ...200 newest... ] }
         { "type": "log", "log": { "channel", "level", "message", "source", "data", "seq", "timestamp" } }
         { "type": "error", "code", "message" }
         { "type": "pong" }
```

The backlog is sent in response to `subscribe` (not on connect, since the
channel isn't known until then) and always before any live log can interleave
on that socket. Every log carries `channel`, `seq` and a server-assigned
`timestamp`, so a viewer can ignore what it has already seen and can't be
reordered by a client's clock.

## Limits and abuse protection

| Guard | Default | Env |
|---|---|---|
| Message size | 10 KB | `LIVELOG_MAX_MESSAGE_BYTES` |
| `data` size (serialised) | 50 KB | `LIVELOG_MAX_DATA_BYTES` |
| Logs kept per channel | 5000 | `LIVELOG_MAX_LOGS` |
| Replayed on subscribe | 200 | `LIVELOG_REPLAY` |
| Writes per token+channel | 20/s, burst 100 | `LIVELOG_RATE_PER_SEC`, `LIVELOG_RATE_BURST` |
| Failed auth per IP | 2/s, burst 20 | `LIVELOG_AUTH_PER_SEC`, `LIVELOG_AUTH_BURST` |
| Channels | 200 (idle ones reclaimed) | `LIVELOG_MAX_CHANNELS` |
| Viewers per channel | 100 | `LIVELOG_MAX_SUBSCRIBERS` |
| Viewer sockets | 500 total, 20 per IP | `LIVELOG_MAX_CONNECTIONS`, `LIVELOG_MAX_CONNECTIONS_PER_IP` |

Also enforced: the request body is refused as it streams past its cap rather
than after being buffered, client WebSocket frames are capped at the protocol
layer (`maxPayload`), a viewer that stops reading its socket is dropped rather
than allowed to queue frames in the process, and tokens are compared as sha256
digests so a guess leaks nothing through timing or length.

Channel names are effectively public (reads are open, and `/api/channels` lists
active ones), so use an unguessable name for anything sensitive.

## Tokens

Copy `tokens.example.json` to `tokens.json` — never commit `tokens.json` — and
list one entry per project:

```json
{ "tokens": [ { "token": "tk_live_...", "label": "default client", "channels": ["default"] } ] }
```

Generate a token with something random, e.g.:

```bash
node -e "console.log('tk_live_' + require('crypto').randomBytes(24).toString('base64url'))"
```

**Create** a token by adding an entry; **revoke** one by removing it and
restarting (`fly apps restart`, or `fly secrets set` again). Restarting costs
nothing but the current logs, which are meant to be lost anyway.

## Deploy

### Fly.io (recommended)

WebSockets work through Fly's proxy with no extra config, and the machine can be
pinned so it never sleeps.

```bash
cd public/livelog-server
fly launch --no-deploy          # name it something unique, keep the Dockerfile
fly secrets set LIVELOG_TOKENS_FILE=/app/tokens.json
fly secrets set LIVELOG_ALLOWED_ORIGINS=https://your-hub.vercel.app
fly deploy
```

`tokens.json` isn't in the image (the Dockerfile copies only `server.js` and
`lib/`), so mount it as a
secret file, or pass the whole config inline instead:

```bash
fly secrets set LIVELOG_TOKENS='{"tokens":[{"token":"tk_live_...","label":"default","channels":["default"]}]}'
```

Then `fly certs add livelog.example.com` for a TLS domain, so the page can use
`wss://`. Confirm one machine and no autostop:

```bash
fly scale count 1
fly status                      # min_machines_running = 1, auto_stop = false
```

### Render

Create a Web Service from this repo with root directory `public/livelog-server`,
build `npm install`, start `npm start`, health check `/healthz`. Use a **paid**
instance: the free plan spins down when idle, which drops every viewer and every
log.

### Railway

New project → deploy from repo → set the root directory to `public/livelog-server` →
add the env vars. Railway keeps one replica by default; don't scale it.

### Any VPS

```bash
cd public/livelog-server && npm install --omit=dev
LIVELOG_TOKENS_FILE=./tokens.json PORT=8787 node server.js   # under systemd/pm2
```

Put Caddy in front for automatic TLS (`wss://` needs TLS termination):

```
livelog.example.com {
  reverse_proxy 127.0.0.1:8787
}
```

Caddy passes the WebSocket upgrade through by default; `x-forwarded-for` is set
by it, which is what `LIVELOG_TRUST_PROXY` (on by default) expects.

### After deploying

Set the hub's Vercel env vars to the new origin and redeploy (they're inlined at
build time):

```
NEXT_PUBLIC_LIVELOG_URL=https://livelog.example.com
NEXT_PUBLIC_LIVELOG_WS_URL=wss://livelog.example.com/ws
```

`ws://` will be blocked as mixed content on an HTTPS page, so it must be `wss://`.
