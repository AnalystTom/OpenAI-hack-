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
