# Dots office

A small 3D office for actual Codex sessions. Working agents sit at desks; completed or interrupted agents chill on sofas in the expanded lounge. New source work returns the same agent to its desk. Two clearly labelled animated showcase characters keep the room active by arriving, working, changing tasks, wandering, and leaving. They are separate from actual sessions and their counts.

## Run locally

Node.js 22.13 or newer:

```sh
npm install
npm run build
npm run dev:relay
```

In another terminal, run `npm run dev`, then open http://127.0.0.1:3000. The Vite frontend proxies the live relay to port 8787. The production worker serves both the built frontend and the same relay. `npm test` runs the source, room, validation, and behavior checks.

## Bring your agents and work together

1. Choose **Import agents**, enter your name, then **Create live room**. In an invitation, choose **Join with my Codex → Join this live room**.
2. Copy the live prompt into your own Codex. Choose an exact project and the actual session IDs you want to share.
3. Codex downloads the inspectable Node bridge, lists the selected project's sessions read-only, and starts the bridge after you choose the IDs. Keep that terminal open while working.
4. Use **Invite someone** to share the room link. Every visitor can join with their own selected sessions. Session IDs are scoped to each participant so contributors do not overwrite each other's agents.

The bridge reads the local `state_5.sqlite` index and bounded rollout tails, checks for changes every three seconds, sends changed minimal metadata, and renews unchanged connections with a small heartbeat about every twelve seconds. It does not execute Codex tasks or connect to an OpenAI account API. The uploader name is entered in Dots and bound to the participant credential. It sends session titles, source IDs, model, status, short activity labels, available context counts, and source timestamps. It excludes credentials, messages, reasoning, tool arguments/output, file contents, absolute paths, and full archives. Missing telemetry stays unavailable. Untitled sessions can be selected explicitly and show **Session title unavailable**.

The browser subscribes to WebSocket room updates. A bridge that stops reporting becomes disconnected after 20 seconds. Its agents sit on the couch with a disconnected label, then are hidden from the room and roster after 30 minutes disconnected. Source-reported offline sessions follow the same retention rule. Restored heartbeats recover the same agents. A lost viewer connection hides live agents until the room reconnects. Completed/interrupted source events become idle; new task events become working. Stale working evidence becomes unknown. **Disconnect my agents** removes only your contribution immediately and revokes its upload credential. **Leave room** leaves the view; it does not stop a running bridge. Compact names stay directly above each character; older unnamed uploads show their real session title instead of an uploader placeholder.

Room links are private capabilities: everyone with a link can view the metadata shared into that room. There is no account login. Each participant receives a separate write credential stored only in their browser and copied into their bridge prompt. Rooms and credentials expire after 24 hours. Each room supports 50 agents and 100 simultaneous viewers. No room session metadata is committed to this repository.

## Snapshot fallback and room customization

**Import snapshot file** validates a version 1 JSON file up to 2 MB. Imported files are recorded snapshots and do not stream activity; working status is shown as unconfirmed. A file imported inside a live room is visible to its viewers as a snapshot. Outside a live room, imports remain in the current browser. Replay has been removed; only actual live events change activity. Live-room uploads strip history and use a 64 KiB metadata limit.

**Room studio** stores room colors, owner-written books, real project links, and manually entered totals in the current browser. LinkedIn/X personalization uses supplied profile text or export files; a profile URL alone cannot fetch profile content. Its **Invite** tab creates a separate read-only snapshot invitation with optional fields off by default. Room customization is local; the live relay synchronizes agent metadata.

For development only, **Watch local Codex sessions** reads real sessions on this computer. It is restricted to loopback and never exposed by the public worker. Set `DOTS_SESSION_CWD` if automatic workspace selection is wrong.

## Capacity and deployment

See [the live office plan](docs/live-office-plan.md) for the import protocol, request/storage/fan-out model, costs, and production release gates. The author name is self-entered; account verification is a separate extension.

`wrangler.jsonc` deploys a Cloudflare Worker with a SQLite-backed Durable Object per room and static assets from `dist`. No API keys or Codex credentials are deployed. `ALLOWED_ORIGIN` permits the existing https://dots-office.pages.dev frontend to call the relay. Rooms persist across worker restarts until expiry, then their data is deleted.

```sh
npm run build
npx wrangler deploy
```

The worker URL can serve the complete app directly. For the existing Pages site, build with `VITE_LIVE_API_URL` set to the deployed worker origin, then deploy `dist` to the `dots-office` Pages project. Local development needs no frontend environment variable.

Office assets are adapted from [Claw3D](https://github.com/iamlukethedev/Claw3D); attribution is in `THIRD_PARTY_LICENSES/`.
