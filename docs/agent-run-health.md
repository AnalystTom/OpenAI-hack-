# Agent run health and retry movement

This feature extends the existing local Robots feed. It does not change which
sessions are imported, add a backend, or run installation diagnostics.

Run health summarizes the latest observed turn within the existing bounded log
tail. A terminal turn failure needs attention. Unresolved tool failures or latest
reported input at least 90% of capacity show an issue. Missing/stale source state
is unknown. Otherwise the label is "No issues observed", not a guaranteed score.
Counts include observed tool failures, retries and successful retry recoveries.
Context remains last reported input size rather than lifetime tokens or an exact
current occupancy measurement. A new turn resets its health counts and input size.

A retry is detected conservatively when an explicitly failed call is repeated
with the exact same tool name and input in that turn. Input signatures stay only
in the local parser; arguments, output and signatures are never returned. Changed
inputs and outcomes without a machine status are not classified as retries.
While that retry is pending, its character walks a small circle in the aisle.
The motion stops on the result, interruption/completion, stale state or disconnect.
Replay does not carry live health. Existing snapshots without health still work.

Validation: `npm test` covers failure/recovery, false-positive avoidance, privacy,
staleness, turn reset, context pressure, the circle geometry and snapshot validation.

Cost is a Standard API equivalent in USD for observed request token events in the
existing bounded tail, not a session-lifetime total or subscription invoice. Rates
for GPT-6 Astra, GPT-6.1 Sol and GPT-6 Luna were verified on 2026-10-06 against
[OpenAI API pricing](https://developers.openai.com/api/docs/pricing). Cache reads
are discounted; requests above 272K input use long-context multipliers. Reasoning
tokens are already part of output usage and are not added again. Duplicate token
reports are deduplicated by cumulative usage. Models are taken from source context
records per request; unknown requests are counted as unpriced. Partial totals and pricing coverage are
shown explicitly; no priced requests yield Unavailable. This
estimate includes recorded cache writes but excludes tools, Fast/Ultrafast, regional uplifts and plan
allowances. Update the small rate table when official pricing changes.

To run against your own project instead of the default Robots folder:

```sh
DOTS_CODEX_PROJECT=/absolute/project/path npm run dev -- --strictPort
```

Use the existing local import button; the endpoint and default Robots setup are
unchanged. The filter matches the working directory recorded by Codex exactly.

Context displays both a filled usage bar and a percentage labelled used, with the
reported token count and capacity underneath. Missing usage stays Not reported.
