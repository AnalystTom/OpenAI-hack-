# Codex welcome and snapshot import

The first screen at `/` is the running Three.js office with the Codex import card over it. **I just want to see the app** dismisses the card without replacing the Canvas or resetting the camera. **Import agents** reopens it in the same world. The original characters stay when imported sessions join.

Imports merge by session ID, preserving existing residents and updating only equally recent or newer source data. Adding agents to a recording preserves the existing replay clock; new agents start their history at arrival. The minimal office snapshot and dismissed-welcome preference are saved in this browser's local storage and restored on refresh. Storage failures are shown explicitly. This persistence is per browser; it is not a shared server-backed office across visitors.

## Local development

Run `npm run dev` and open `http://127.0.0.1:3000`. The welcome creates a temporary import, and the copied prompt includes its HTTP PUT URL and upload bearer token. Codex reads the requested project locally and uploads a minimal `OfficeSnapshot`. The browser polls using a separate read token, then offers session selection. This is a one-shot snapshot, not a live feed.

`server/office-import.mjs` is a development-only Vite middleware. It accepts loopback clients with matching host/origin checks. Uploads are validated against `src/snapshot.ts`, limited to 2 MB, and reduced to known snapshot fields. Upload tokens cannot read data, and one browser's read token cannot access another import. Identical retries are accepted; a different second upload is rejected. Pending imports expire after 15 minutes, are deleted when the card unmounts, and disappear on server restart. Accepted agents are persisted in browser storage; temporary upload tokens are not.

## Static hosting, including Lovable

`npm run build` produces a static site. Its prompt asks Codex to save `dots-snapshot.json`; the user chooses **Import snapshot file**. It never promises a remote upload link. That file is parsed in the browser and is not uploaded to a server.

Automatic remote uploads still require a deployed HTTPS backend with scoped upload/read authorization, expiry, limits, and appropriate retention. The loopback development middleware must not be exposed as that service. No hosted backend or Lovable deployment was created by this change.

## Verification

`npm test` covers upload validation, separate read/write authorization, browser isolation, expiry, revocation, identical retries, and the static-host prompt. `npm run build` checks TypeScript and the production bundle.

The local browser journey was tested using actual recent Robots sessions, with session contents kept outside the repository. The browser receives only metadata and bounded recorded event labels, not raw conversations or tool arguments. Real-data browser testing should use a fresh context and verify prompt copying, HTTP acceptance, session selection, replay pause/status transitions, invalid/empty file states, and mobile layout.
