# Codex session import

The welcome dialog offers a shared live room and a recorded JSON snapshot fallback.

A live participant enters an uploader name and receives a room-scoped upload credential bound to that name. The copied prompt asks Codex to resolve an exact project, download and inspect `/codex-bridge.mjs`, list real session IDs, and get the user's selection before uploading. The bridge runs in a visible terminal using Node.js 22.13+, with the credential supplied through `DOTS_ROOM_UPLOAD_TOKEN`. It reads only the selected project's SQLite metadata and bounded selected rollout tails. It checks every three seconds, sends changed allowlisted metadata, and renews unchanged connections with a bodyless heartbeat about every twelve seconds.

The hosted Durable Object stores room metadata and broadcasts participant changes over WebSockets, with a full snapshot on connection. Lost bridge heartbeats become offline after 20 seconds; those agents sit on sofas and are hidden after 30 minutes disconnected. Source task completion/interruption becomes idle; actual new source work becomes working. Idle agents sit on sofas in the expanded lounge; working agents use desks. Unknown/stale state never animates work. IDs are participant-scoped, and updates replace that participant's feed. Disconnect removes the feed immediately and revokes the credential. A room expires and deletes its metadata after 24 hours.

Visitors enter through `#live=<room ID>`. They can view metadata by possession of the link and obtain their own participant credential through the import dialog. Credentials never appear in invitation links or shared snapshots. Shared room appearance/books/projects remain local edits and are not synchronized by the agent relay.

The snapshot fallback validates version 1 JSON before session selection. It imports selected real metadata and strips unknown fields. A static working value becomes unknown until a live source reports it. Snapshot mode is explicitly labelled; replay controls have been removed.

Verification covers authentication/isolation, feed lease and room expiry, participant changes, two fresh browser contexts, mobile import/invite/disconnect, and real bridge delivery. The capacity model and production launch gates are documented in [the live office plan](live-office-plan.md).
