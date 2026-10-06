# Workstream 2 — Bring a user's Codex agents into the hosted office

Owner: unclaimed — add your name here when you pick this up.

## Goal

A judge opens the publicly hosted Dots site, connects their own Codex sessions, and sees their actual agents represented in the office. Import must work for another user's machine/account, not only the developer's localhost.

## Starting point

The React + Vite frontend and Three.js office run with `npm install` then `npm run dev` at http://127.0.0.1:3000. `npm run build` produces a static `dist/` suitable for hosting; hosting and any bridge/backend are separate deployment concerns.

The UI currently has:

- A labelled character playground, containing art previews rather than fake agent activity.
- An empty real-agent office.
- An Import agents dialog with a working JSON snapshot file input, validation, and in-memory rendering.
- An explicit unavailable/not-connected Codex account connection state.

There is no Codex account integration, OAuth implementation, hosted relay, live stream, local reader, or message dispatch yet. Importing JSON is a snapshot, not a live connection. Do not present the existing dialog as completed account import.

## Files you own

- New transport, session reader, and connector modules under `src/integrations/codex/`.
- New connection UI under `src/components/import/`.
- Any required bridge/server code under `server/` or `scripts/` and a documented start command.
- Connector-specific tests and deployment/environment documentation.
- `src/snapshot.ts` if snapshot validation must evolve, coordinated with integration.

The third workstream owns `src/App.tsx`, global styles, final wiring, and deployment coordination. The world teammate owns Three.js scene and avatars. Do not edit each other's files without agreeing first. Coordinate changes to `src/types.ts` and dependencies.

## Shared data contract

`src/types.ts` is authoritative. Emit `OfficeSnapshot` with `version: 1` and `agents: OfficeAgent[]`. One actual Codex chat/session maps to one persistent agent ID and one character.

Each agent has:

- `id`: stable source session/chat identifier.
- `name`: real source title/name.
- `harness`: actual harness identifier, such as Codex.
- `model`: reported model identifier, or `null`.
- `status`: `working`, `idle`, `blocked`, `error`, `offline`, or `unknown`.
- `task`: actual reported current task, or `null`.
- `contextUsed`, `contextWindow`: reported current context tokens and capacity, or `null`. Lifetime/cumulative tokens are not current context occupancy.
- `updatedAt`: source observation/update time in ISO format.
- Optional `character`: one of the six `CharacterKind` values.
- Optional `sourceUrl`: a valid way to return to the source session, if supported.

The app accepts up to 50 agents in a snapshot. Preserve session identity across refreshes and disconnections; deduplicate rather than creating a new character for every update. No sample people, tasks, percentages, or logs may appear as product data.

## First decision: prove a real path from a hosted browser

Investigate the supported Codex interfaces before promising account OAuth or remote session access. Do not assume a hosted website can read `~/.codex`, the Codex desktop app, or this chat's internal tools. Signing into an OpenAI account is not automatically access to local Codex sessions.

The repository README specifies the intended journey: the user copies a prompt from the hosted site, sends it to Codex, and Codex uploads the selected session data to the hosted office. Implement that prompt-driven onboarding first, using pairing to scope where data lands. If no supported account/session API is available, the proposed path is:

1. A short-lived pairing code created by the hosted site.
2. The user explicitly runs a small local bridge or pastes an onboarding instruction into their own Codex environment.
3. They choose the sessions/projects to share.
4. The bridge reads permitted source metadata/events locally and sends a minimal authenticated feed to the hosted relay over an outbound connection.
5. Their hosted office subscribes to only their paired feed.
6. Disconnect revokes access and the UI marks stale/offline data honestly.

Treat this as a proposed implementation, not an established Codex capability. Verify the source API or local format and deliver the smallest working route. Keep the real-file snapshot import as an explicitly labelled fallback if live pairing cannot be completed in the timebox.

## Priorities

1. Prove one real session from a separate/local client reaches the hosted frontend. Document the exact transport and supported source.
2. Build a short onboarding journey: connect, choose sessions, confirm, see agents. Provide useful loading, permission, empty, error, expired pairing, and disconnected states.
3. Subscribe to real activity changes and update existing characters. Distinguish a received task, actual running work, completion, and a lost connection.
4. Keep the transport replaceable: provide a small subscription hook/service for the integration owner, plus connect/disconnect actions. Do not put connector details into the 3D renderer.
5. Add source-return links where supported. Sending work to agents is a stretch goal; do not claim an instruction was sent without a real acknowledgement.

## Privacy and hosting requirements

- Never upload Codex credentials, API keys, auth files, full session archives, or unrelated conversations. Start with titles/status/model/context metadata and require explicit session selection.
- Do not commit local session data or credentials. Environment secrets belong on the backend; browser bundles cannot keep secrets.
- Authenticate the bridge and subscriptions, expire pairing codes, scope feeds per user/office, and test that a second account cannot read the first account's sessions.
- Do not enable permissive unauthenticated filesystem access or a public endpoint that exposes the developer's sessions.
- Use an HTTPS-compatible hosted path. A localhost-only reader is useful for development but does not meet the online-site requirement.
- Declare stale/offline data when the bridge stops. Do not continue to animate fabricated working status.

## Done means

- From a fresh browser on the hosted site, a user can connect their own source, select real sessions, and see the correct titles, harnesses, statuses, and available model/context data.
- A real source change arrives without a manual browser refresh or duplicate agent.
- Empty accounts, missing permissions, invalid/expired pairing, bridge loss, reconnect, and disconnect behave correctly.
- A second user cannot access the first user's feed.
- Any snapshot fallback is clearly labelled as non-live; incomplete account integration is stated explicitly.
- `npm run build` passes; tests cover source parsing and pairing/authorization boundaries. Verify the complete journey with Playwright from a fresh context and leave the verified page open.
- Document deployment steps, required environment variable names (no values), and any unfinished acceptance criteria for the integration owner.

Before any commit or push, run `/ponytail-review`, address its findings, and never bypass the repository's Ponytail hooks.
