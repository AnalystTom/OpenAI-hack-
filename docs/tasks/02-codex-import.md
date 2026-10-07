# Bring Codex sessions into shared live rooms

The hosted import uses a consented local Node bridge and a Cloudflare Durable Object relay. One actual Codex source session maps to one stable participant-scoped agent. Source completion/interruption makes it idle, actual resumed work makes it working, stale source evidence stays unknown, and a lost bridge becomes offline after 20 seconds.

The user enters an uploader name, creates or joins a 24 hour room, copies the prompt into Codex, selects an exact project and actual session IDs, then runs the inspectable bridge in a visible terminal. The bridge reads local metadata/event tails read-only, checks every three seconds, and sends changes over authenticated HTTPS. Unchanged sessions use a bodyless heartbeat about every twelve seconds. The site receives a full room snapshot on connection and participant changes over WebSockets. Public builds contain no local session reader, example agents, credentials, or recorded project data.

The room link grants viewing access. Write credentials are unique per participant, bind the entered uploader name, and never appear in invitations or broadcasts. Disconnect revokes only that participant. Rooms support 50 agents, 100 viewers, and delete stored data on expiry. Snapshot file import is a non-live fallback, explicitly labelled and unconfirmed for working status. Working agents stay at desks; idle agents sit in the expanded lounge. See [capacity and launch gates](../live-office-plan.md).

Implementation:

- `server/live-room.mjs`: room isolation, upload validation, WebSocket subscriptions, lease/expiry alarms, revocation.
- `scripts/codex-bridge.mjs`: real local reader, explicit project/session selection, authenticated recurring uploads.
- `src/integrations/codex/useLiveRoom.ts`: room lifecycle, subscription/reconnect, browser member persistence.
- `src/components/import/Welcome.tsx`: prompt, consent boundary, snapshot selection/error states.
- `src/components/import/LiveRoomBar.tsx`: invite, join, disconnect and leave.
- `wrangler.jsonc`: hosted relay and static assets; README documents local/deployment commands.

Verification uses real source metadata in fresh Playwright browsers against the local frontend and Wrangler relay. Authorization tests cover cross-room tokens, field allowlisting, limits and revocation. Lifecycle tests cover participant identity, heartbeat loss/recovery, snapshots, persisted room state and expiry. Browser checks cover separate participants, mobile, clipboard, reload, bridge restart and disconnect. Production deployment and staging load tests remain launch gates.
