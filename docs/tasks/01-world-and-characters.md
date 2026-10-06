# Workstream 1 — The 3D world and its little coworkers

Owner: unclaimed — add your name here when you pick this up.

## Goal

Make the Dots office the part of the demo the OpenAI and Lovable judges remember: six expressive, recognisable characters walking around a polished, interactive office. The world must also visualise real imported Codex agents without inventing activity.

## Starting point

The app is a working React + Vite + TypeScript + Three.js/React Three Fiber application. Run `npm install`, then `npm run dev`; open http://127.0.0.1:3000. Run `npm run build` for the production bundle (`dist/`).

Claw3D is the base: its furniture renderer, geometry helpers, constants, and GLB assets were copied and adapted. Preserve attribution in `THIRD_PARTY_LICENSES/`. Upstream: https://github.com/iamlukethedev/Claw3D. The exact source revision is recorded in `THIRD_PARTY_LICENSES/README.md`.

Astra has already created six procedural characters based on the supplied images:

- Blue rounded Dot with a black beret.
- Lime frog Dot with raised eyes.
- Yellow rounded triangle Dot with glasses.
- Pink heart Dot with black sunglasses.
- Purple rounded ghost Dot.
- Lovable's asymmetric heart with an orange/pink/purple/blue gradient.

These are actual Three.js meshes with alternating legs and arms, body bounce, and a disposal API. They are already integrated into the walking playground. Improve these; do not replace them with unrelated avatars.

## Files you own

- `src/components/OfficeWorld.tsx`: scene, floor plan, lighting, camera, movement, character selection.
- `src/components/office/characters/`: character geometry, materials, animation.
- `src/features/retro-office/`: adapted Claw3D furniture and geometry.
- `public/office-assets/`: models and scene assets.

Coordinate before editing `src/App.tsx`, `src/style.css`, `src/types.ts`, or package dependencies. The third workstream owns the app shell and integration. The import teammate owns connection/data acquisition.

## Shared interface

`src/types.ts` is the source of truth for `OfficeAgent`, `AgentStatus`, `CharacterKind`, and `OfficeSnapshot`.

`OfficeWorld` currently receives `agents`, `preview`, `paused`, `night`, `cameraKey`, `selected`, `onSelect`, and `onReady`.

Character factory:

```ts
const mascot = createMascotCharacter(kind);
scene.add(mascot.group); // faces +Z, feet on y=0, height about 2 units
mascot.update(elapsedSeconds, walkingIntensity); // 0–1
mascot.dispose();
```

Keep the agent ID as the selection identity. A preview character is an art asset, not a fabricated connected agent. Preview mode must remain visibly labelled; an empty real roster must show an empty office.

## Priorities for the two-hour demo

1. Improve framing, furniture scale, character readability, shadows, and the first impression. Make the Lovable heart and Dots clearly recognisable at the default zoom.
2. Make walking look intentional. Keep agents on navigable floor, avoid desks/walls/each other, and provide convincing turns and idle behaviour. The current playground uses a simple oval path; replace that only as needed.
3. Map real statuses to understandable behaviour: working at a desk, blocked near a help point, idle taking a coffee break. Show unknown or disconnected status honestly; movement alone must not claim a real tool execution.
4. Make harness and model visibly affect the avatar. Respect an explicit `character` selection; agree deterministic fallback mapping with integration. Never infer the model from the task title.
5. Implement the context-window visual: body/backpack fills only from reported `contextUsed / contextWindow`. Unknown values get an explicit unknown state, not an invented percentage. A compaction animation needs a real reported event; do not trigger it on a timer.
6. Keep orbit, zoom, select, pause, lighting, and camera reset usable. Respect reduced-motion preferences and check a laptop-sized viewport before chasing extra effects.

## Scope boundaries

Do not implement Codex sign-in, import transport, session parsing, database storage, account isolation, or message dispatch. Consume the agreed data interface and coordinate any extra event fields before changing it. Do not add scripted fake tasks, progress, token usage, or publication activity.

## Done means

- All six reference-based models render and walk without browser errors or asset failures.
- A fresh user can open the world, orbit/zoom, select a character, inspect details, pause/resume, reset the camera, and change lighting.
- Preview mode and actual agents are clearly distinguished; an empty or disconnected account has no fabricated workers.
- Known context usage is visibly represented; unavailable usage remains unknown.
- `npm run build` passes. Verify the journey with Playwright in a fresh browser context, inspect a screenshot, and leave the verified page open for review.
- Report changed files, verification, and any unfinished acceptance criteria to the integration owner.

Before any commit or push, run `/ponytail-review`, address its findings, and do not bypass the repository's Ponytail hooks.
