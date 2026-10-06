# OpenAI-hack-


Someone does teh 3 model and the world (openai dots as example, lovable heart) 


Someone does the import mechanis of being able to import user's account (codex sessions so that they can visualise their agents as well whiel teh site is hosted online)
1. User copies the prompt we give it, sends to codex, codex then uploads their agent sessions to remove lovable) 

## Running Dots

Node.js 22 recommended.

```sh
npm install
npm run dev
```

Open http://127.0.0.1:3000. Production: `npm run build` (output: `dist/`). Verification: `npm test`.

The current build contains a walking Three.js character playground, six reference-based models, a Claw3D-derived office, camera/lighting controls, and validated JSON agent snapshot import. Live Codex pairing and hosted account/session import are the next workstream; the app explicitly distinguishes character previews from imported data.

## Teammate ownership

- [World and character workstream](docs/tasks/01-world-and-characters.md)
- [Hosted Codex import workstream](docs/tasks/02-codex-import.md)
- App shell, integration, and deployment coordination remain with the third workstream.

The shared data contract is in `src/types.ts`. Snapshot data stays in the current browser tab and clears on refresh. Do not commit real session exports or credentials.

Office code and assets are adapted from [Claw3D](https://github.com/iamlukethedev/Claw3D); see `THIRD_PARTY_LICENSES/` for attribution and the source revision.

## Local Robots session feed

In the import dialog choose **Import Robots sessions**. The local dev server reads up to six recent, non-archived sessions whose project is `~/Dev/Robots`. It refreshes every five seconds using the local Codex SQLite index and bounded tails of each session event log. Credentials and tool arguments/output are never returned. No session data is committed or bundled into the site.

- Recorded running work sends the character to a desk with a seated typing animation.
- A completed/interrupted turn becomes idle and the character wanders with short pauses.
- Missing, unreadable, or stale running state is unknown; connection loss stops work animation.
- **Replay last recorded task** compresses that session's actual last completed task into 20 seconds, explicitly labelled as a replay. It does not execute or restart a task.

This reader runs only on the loopback development server. The public site's remote pairing/upload flow is still owned by workstream 2. `server/codex-sessions.mjs` returns the shared `OfficeSnapshot` contract with optional recorded history and can inform that connector without exposing the local database.
