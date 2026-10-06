# First-aid station: local demo

Run `npm run dev` and open http://127.0.0.1:3000. Click the green kit on the left
wall, or the first-aid button in the office controls, then Run setup check.

The development-only POST endpoint executes the fixed command `codex doctor
--json` on this computer. If Codex is not on the server PATH, set
`DOTS_CODEX_BIN` to the installed executable's absolute path before starting
Vite. It takes no executable, shell command, or agent arguments from the browser.
Same-origin, loopback and Host checks restrict access. Checks time out after
45 seconds; only one can run at a time. A nonzero exit with a valid diagnostic
report still displays its findings.

The panel returns only check IDs, categories, statuses, summaries and suggested
remediation, plus CLI version and completion time. Detailed inventory, auth
fields and raw stderr stay out of the response. No report is saved to disk or
uploaded to an observability service. Findings describe the diagnostic invocation;
network restrictions and a non-interactive terminal can affect its results.

This checks the shared local installation, not an individual session's retry or
context state. It performs no repairs and does not clear agent run health.
Hosted use and teammate machines require a separately authenticated local
connector. The production static build has no command-running endpoint.

## Proposed hosted path

A deployed static site cannot inspect a visitor's computer or run Codex doctor.
Each user would pair an explicitly started local connector with their room. The
connector sends minimal health updates and heartbeat timestamps over an outbound
HTTPS connection. A first-aid request travels through that authenticated channel
to the paired computer; the connector runs only the fixed diagnostic action and
returns a check result tied to the request and machine. Only that machine's owner
can request diagnostics. Offline connectors show unavailable or last-checked
state rather than simulating a successful check. OTLP can export the result for
observability; command requests need their own authenticated transport. None of
this hosted relay/pairing flow is implemented in the current local demo.
