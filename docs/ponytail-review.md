# Ponytail review — initial Dots build

Reviewed all new app code and copied Claw3D modules before the first app commit.

1. `src/features/retro-office/objects/furniture.tsx`: delete: unused interactive editor, placement ghost, task-board clutter, and their imports. Keep the instanced furniture renderer actually used by the office. Addressed.
2. `src/features/retro-office/core/geometry.ts`: delete: unused editor/navigation helpers and metadata. Keep world coordinates, furniture footprints, and rotation helpers used by the renderer. Addressed.
3. `src/features/retro-office/core/constants.ts`: delete: unused room migrations, simulation settings, and storage keys. Keep only canvas dimensions and coordinate scale. Addressed.
4. `src/features/retro-office/objects/types.ts`: delete: props used only by the removed editor renderer. Addressed.

net: -678 lines applied.

Follow-up review: Lean already. Ship.

Validation: production build; snapshot parser tests; Playwright fresh-browser office navigation, character selection, pause/resume, day/night, camera reset, empty office, invalid import, mobile overflow check, and rendered screenshot inspection. Live Codex connection remains explicitly unavailable and delegated in the import handoff.

## Local Robots session feed review

1. `src/components/OfficeWorld.tsx`: delete: per-frame `userData` assignment with no consumer. Nothing replaces it. Addressed.

net: -5 lines applied.

Follow-up review: Lean already. Ship.

Validation: production build and eight parser, state-mapping, and local-request-boundary tests. Playwright verified real Robots import, recorded work at a desk, completion returning to idle, connection loss/recovery, and disconnect. The local feed reads session metadata only; hosted pairing remains separate.
# Current office integration review

1. src/officeReplay.ts:L22: delete: unused playbackLabel helper. Nothing replaces it. Addressed.
2. server/office-import.mjs:L44: reuse: duplicate snapshot field allowlist. Use serializeOffice from src/officeStore.ts. Addressed.

net: -7 lines applied.

Follow-up review of the local changes: Lean already. Ship.

## Agent run health feature

Reviewed the health/cost trackers, optional snapshot fields, context display, and
retry pose on top of the Robots session feed. No dependencies or extra transport
were added. The native progress element provides the context bar.

Lean already. Ship.

Validation: production build, source/health/cost/pose/snapshot tests and local
browser check with the actual hackathon agent. Confirmed retry transitions are
covered by fixtures; no real failed retry was forced for the browser demo.

Context layout follow-up: moved the existing progress component outside the
definition list so list flex rules cannot override it. No extra wrapper layer or
dependency. Lean already. Ship. Verified full-width bar and unbroken percentage
in the local browser; unavailable pricing now explains missing model/usage rates.

Vitals polish review: one component groups the health badge, counts, cost and
context display using scoped styles. Native progress and details elements handle
bar semantics and estimate disclosure. No new dependencies. Lean already. Ship.

## Final main integration review

1. src/App.tsx: reuse: duplicate import modal and file parsing. Use the existing Welcome import and local-source selector. Addressed.

net: -118 lines applied.

Follow-up review: Lean already. Ship.

Final review includes the combined rooms, live links, recorded production example, and import styling. Lean already. Ship.

Validation: production build and 34 tests; fresh Playwright context verified fireworks above visible models, toy hammer pickup/drop, local workspace import with real run health, replay/pause, saved residents after reload, empty collections, default-off sharing, read-only guest entry, mobile overflow, and the production recorded-example entry. Review browser remains open.

Import-button alignment follow-up: one scoped selector corrects the single-icon case. Lean already. Ship. Playwright verified the import dialog at mobile width without overflow.

## Session joining and desk capacity review

1. scripts/verify-session-room.mjs: delete: unused context registry and redundant hidden-input visibility branch. Browser.close owns context cleanup; check the import dialog directly. Addressed.

net: -4 lines applied.

Follow-up review: Lean already. Ship.

Uses the existing snapshot importer, storage serializer, room invitations, instanced furniture, and camera reset. No dependency or transport was added. Invitations and imports support 50 agents; fresh-browser verification uses supplied real source metadata rather than product fixtures.

## Final carpet demo review

1. src/officeBehavior.ts: delete: unused model and harness appearance parameters. Session ID alone selects a stable character. Addressed.

net: -4 lines applied.

Follow-up review: Lean already. Ship. The carpet renderer and walk path share officeLayout bounds; the existing shared animation clock keeps new arrivals synchronized. Verified source statuses remain unchanged.

## Shared live rooms and mobile cleanup

GPT-6.1 Sol high cleanup and individual mobile, authorization, lifecycle and hosted test agents reviewed this change. Medical UI and its unused endpoints/components, hardcoded source choices, automatic demo population, and automatic snapshot replay were removed.

1. src/components/ContextUsage.tsx: delete: component and CSS have no callers after medical panel removal. Removed.
2. src/officeReplay.ts: delete: appendOfficeReplay and its start offsets have no application callers. Removed along with append-only tests; retained source-timeline replay checks.
3. server/live-room.mjs: delete: assignments immediately discarded before participant removal. Removed.

net: -44 production lines applied for these findings. Follow-up: Lean already. Ship.

Verification uses actual Codex source sessions in fresh Playwright contexts. Desktop/mobile new users create and join rooms, preserve session identity across reload, copy invitations/prompts, and disconnect only their own agents. A real cleanup task was observed idle → working → idle in two browsers. Real bridge heartbeat loss/recovery and credential revocation passed. Three mobile sizes (320×740,390×844,760×390) passed with no browser errors or horizontal overflow. The React nested-root warnings were fixed by moving accessible toy controls outside the Canvas; no checks or StrictMode were disabled.

## Disconnected departures and animated showcase

Reviewed the relay's expiry/seat accounting, browser reconnect handling, and two decorative characters that reuse the existing assets, walker, poses, and labels without creating session records.

1. Delete: the unused empty-room overlay styles and entered-office storage constant after removing the floating call to action. Addressed.

Follow-up review: Lean already. Ship.

Validation: 58 unit tests and production build pass. Fresh Playwright at 1280×900, 320×740, and 390×844 verifies separate demo counts, actual snapshot imports, browser offline/reconnect with stable session identities, and no renderer errors. The complete 68-second showcase loop was observed in real time. Real bridge expiry removes agents from two viewers and restart restores their original IDs; expired agents release seats while reconnects still respect the 50-agent limit. The browser network test also found a detached label sprite during removal; frame layout now skips detached sprites.

## Production release review

1. Delete: remaining replay-only styles after replay removal. Addressed.
2. Shrink: local source picker, state, storage, and query for one supported workspace. Replaced with one local-watch button. Addressed.

Final review: Lean already. Ship. Production build and all 62 tests pass. Compact labels and the subsequently requested 30-minute disconnected retention are preserved.
