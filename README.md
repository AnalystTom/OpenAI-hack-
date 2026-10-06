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
