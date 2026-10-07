# Live office and Cloudflare capacity

Updated 7 October 2026. The Worker and Pages frontend are deployed, with fresh desktop and mobile journeys verified against actual Codex metadata and the downloaded bridge. Account identity, traffic controls, and production load measurements remain separate release steps.

## User journey

1. Enter your name and optionally a project in **Import agents**. Create a room or join an existing room. The name is supplied by the uploader, not verified by an account provider.
2. Copy the live prompt into Codex. It asks for the exact project, downloads the inspectable Node bridge outside the repository, lists actual sessions, and asks which IDs may be shared. Only those IDs are read and uploaded. Node 22.13+ is required.
3. Keep that bridge terminal open. The first accepted upload creates the bots. Names above bots identify the uploader; session titles remain in the roster and detail card.
4. Actual task start makes the bot work at its desk. Actual completion/interruption makes it walk over and sit on its own sofa seat, with resting arms. Actual tool events provide activity labels. No percentage or stage is inferred from a task title.
5. A lost bridge's agents become disconnected after 20 seconds and sit on sofas with a disconnected label. After 30 minutes disconnected, they are hidden from the scene and roster. Source-reported offline agents use their own disconnection timestamp. Credentials and selected session identities remain available for reconnection. A stale running event becomes unconfirmed after five minutes. Errors and blocked states remain visible; they do not imply confirmed idle activity.
6. Ctrl+C stops the bridge. **Disconnect my agents** removes only that participant's roster and revokes its upload token. The room expires and deletes its data after 24 hours.

Replay controls, playback state, the floating context meter, and the green invitation ring have been removed. The lounge expands to provide up to 50 distinct sofa seats as well as 50 distinct session desks. Two separate animated showcase characters have their own desks and visibly labelled demo activities; they do not enter session data, rosters, live counts, or room uploads. Link sharing remains available in the sidebar.

## Data path and consistency

`Selected Codex sessions → local metadata reader → authenticated HTTPS feed → room Durable Object → hibernatable WebSocket → browser → bot pose`

The bridge scans selected source metadata every three seconds. It sends a complete replacement of that participant's minimal roster only when metadata changes; an unchanged feed renews its lease with a bodyless POST about every twelve seconds. This gives a target of approximately three seconds plus source-read and network time for a visible status change. It is a target, not a measured global latency guarantee.

Each room has its own SQLite-backed Durable Object. Each participant has a random credential and stable member ID. Public agent IDs combine member ID and actual source session ID, preventing two uploaders with the same local session ID from overwriting each other. The uploader name is attached by the relay from the credential's participant record; an uploaded agent cannot supply another participant's name. A credentialed name update keeps the same participant and bot identities.

Every accepted PUT replaces the selected roster atomically, including removed sessions. Normal WebSocket messages replace only that participant's roster. Initial connection and lease-expiry alarms send a complete room snapshot. Viewers do not poll. Reconnecting viewers fetch the current snapshot before resuming the stream. Bridge and viewer retries back off to 30 seconds with jitter. PUTs are idempotent replacements; the bridge permits only one upload in flight. This version assumes one bridge process per participant credential. Concurrent bridges with the same credential can replace each other's selections; signed publisher generations are a required extension before supporting multiple devices per participant.

The shared metadata allowlist contains session ID/title, harness, reported model, status, task title, actual activity label, source timestamp, reported context counts, and optional appearance, plus recorded session links. Messages, reasoning, tool arguments/output, files, absolute paths, full histories, cost/health extras, and authentication files are excluded. Missing telemetry stays null. Local reads remain read-only and bounded to 2 MiB per selected rollout tail.

## Implemented limits

| Limit | Current application bound | Reason |
| --- | ---: | --- |
| Participants | 50 per room | Bounds credentials and roster ownership |
| Bots | 50 total per room | Bounds rendering, seats, and room metadata |
| Viewers | 100 WebSockets per room | Conservative product bound; requires load validation |
| Feed body | 64 KiB | Rejects accidental full archives before parsing |
| Stored room record | 96 KiB | Leaves headroom below Cloudflare's 128 KiB key/value limit |
| Bridge lease | 20 seconds | Lost sources cannot remain working indefinitely |
| Disconnected visibility | 30 minutes | Removes stale waiting agents from the room and list |
| Room lifetime | 24 hours | Removes stale data and credentials |

These are product limits, not evidence that a room has been load-tested at those values. Cloudflare documents a soft target of 1,000 requests per second per object; workload and memory still constrain throughput. Sharding by room avoids making one object the coordinator for the whole product. [Durable Object limits](https://developers.cloudflare.com/durable-objects/platform/limits/)

## Capacity model

Let `U` be simultaneous uploaders, `H` hours active per day, and `V` viewers per room. Unchanged feeds use approximately `300 × U × H` HTTP requests/day; feeds changing on every scan can use up to `1,200 × U × H`, excluding read duration, reconnects, initial joins, and alarms. Every HTTP feed reaches both the Worker and its Durable Object. With a persisted record and alarm update, budget approximately two SQLite row writes per accepted feed. An expiry alarm also writes and broadcasts; production metrics must account for that overhead.

| Illustrative traffic, not observed usage | Unchanged feeds/day | Worst-case changed feeds/day |
| --- | ---: | ---: |
| 10 uploaders × 8 hours | 24,000 | 96,000 |
| 100 uploaders × 8 hours | 240,000 | 960,000 |
| 1,000 uploaders × 8 hours | 2,400,000 | 9,600,000 |

On the Free plan, Workers and Durable Objects each allow 100,000 requests/day, while SQLite-backed Durable Objects allow 100,000 written rows/day. With two writes per accepted feed, the write allowance can be exhausted near 50,000 feeds/day, before counting setup and alarms. Free-tier overload fails rather than scaling automatically. Use the Free plan for small tests, not a busy public launch. [Workers pricing](https://developers.cloudflare.com/workers/platform/pricing/), [Durable Objects pricing](https://developers.cloudflare.com/durable-objects/platform/pricing/)

The Paid plan starts at $5/month. Relevant included quantities are 10 million Worker requests, 1 million Durable Object requests, 400,000 GB-s of Durable Object duration, 50 million SQLite row writes, and 5 GB-month of SQLite storage. Request overages are $0.30/million for Workers and $0.15/million for Durable Objects; row-write overage is $1/million. These are account-level allowances shared with other workloads. [Workers pricing](https://developers.cloudflare.com/workers/platform/pricing/), [Durable Objects pricing](https://developers.cloudflare.com/durable-objects/platform/pricing/)

For 100 uploaders × 8 hours/day × 30 days, unchanged feeds produce about 7.2 million HTTP feeds and 14.4 million row writes/month. Feed request charges alone imply a starting estimate near $5.93/month: $5 base plus $0.93 Durable Object request overage. If every scan changes, 28.8 million feeds and 57.6 million row writes imply approximately $22.41 before CPU, duration, alarms, joins, rounding, and other account usage. These are calculations, not provider quotes or a spending cap.

Fan-out is the other constraint. At 50 uploaders and 100 viewers, scans changing every three seconds yield approximately 1,667 outgoing messages/second per room. With an assumed 2 KiB participant message, that is approximately 3.4 MB/second; a 96 KiB full-room message would be approximately 164 MB/second. Participant messages remove that avoidable amplification, but payloads must be measured. Cloudflare does not bill outgoing WebSocket messages as requests; network, rendering, and duration remain practical constraints. The server uses `acceptWebSocket` so quiet viewer connections can hibernate; connected sockets alone should not pin an idle object in memory. [Durable Objects pricing](https://developers.cloudflare.com/durable-objects/platform/pricing/), [WebSocket hibernation](https://developers.cloudflare.com/durable-objects/best-practices/websockets/)

## Release and scale gates

- Deploy the Worker and the matching frontend build together; older clients cannot consume participant messages. Existing persisted rooms without uploader names require the participant to open Import agents and save their name with their existing credential. Saved local working snapshots are now unconfirmed until an actual feed supplies fresh events.
- Configure the production origin, a room-creation abuse gate, and account-wide rate controls before broad public distribution. The proposed starting quotas are 10 room creations/day per account, 2 feed requests/second per participant with a small burst, and the implemented 50-bot/100-viewer room limits. Anonymous IP limits alone are insufficient for account identity or preventing distributed abuse.
- Load-test staging using isolated test rooms, never invented bot telemetry in the product UI: 50 uploaders, 100 viewers, 3-second changes, actual measured payload distribution, concurrent reconnects, restart recovery, and 20-second lease expiry. Require p95 source-to-screen latency under five seconds, no lost terminal states, correct expiry broadcasts, stable IDs, and room memory below the platform limit.
- Measure accepted feed counts, HTTP/DO request rates, row writes, payload bytes, active duration, rejects, reconnects, stale leases, and source-to-screen latency. Redact tokens and session content from logs. Set billing alerts at $10/$25/$50 and an operational decision to pause new room creation on unexpected growth; alerts are not a hard spending cap.
- If HTTP polling costs dominate, move bridge uploads to an authenticated hibernatable WebSocket with per-participant attachments and publisher generations. Incoming WebSocket messages receive a 20:1 billing ratio, but lease persistence and wake duration still need a measured design. Do not introduce this second transport until the current protocol's real traffic is measured.
- A signed-in author identity requires an authentication provider and account-to-participant binding. The implemented name is explicitly self-entered and must not be presented as a verified Codex/OpenAI account.

## Verification surface

Repository `/Users/tom/Dev/OpenAI-hack-`, local frontend `http://127.0.0.1:3000/`, Wrangler relay `http://127.0.0.1:8787/`. Tests cover ownership, metadata allowlists, participant message replacement/removal, source statuses, distinct desk/sofa capacity, lease expiry, revocation, persistent restart, and camera bounds. Playwright uses fresh browser contexts with actual working and completed Codex metadata and the actual Node bridge. Production capacity remains a modeled plan until staging and billing metrics are collected.
