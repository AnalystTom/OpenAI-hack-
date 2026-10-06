import { test } from "node:test";
import assert from "node:assert/strict";
import { doctorReport, doctorRequestAllowed } from "../server/codex-doctor.mjs";

test("doctor preserves failing findings without exposing detailed inventory", () => {
  const report = doctorReport(JSON.stringify({ schemaVersion: 1, overallStatus: "fail", codexVersion: "test", checks: {
    network: { id: "network", category: "network", status: "fail", summary: "Unreachable", remediation: "Check connection", details: { credential: "PRIVATE_TEST_VALUE" } },
  }, auth: "PRIVATE_TEST_VALUE" }));
  assert.equal(report.status, "fail");
  assert.equal(report.checks[0].remediation, "Check connection");
  assert.ok(!JSON.stringify(report).includes("PRIVATE_TEST_VALUE"));
});
test("doctor rejects malformed or unsupported reports", () => {
  for (const text of ["bad", "null", '{"schemaVersion":2}', '{"schemaVersion":1,"overallStatus":"ok","checks":{"a":{"status":"made-up"}}}'])
    assert.throws(() => doctorReport(text));
});
test("diagnostic actions require a same-origin loopback request", () => {
  const req = { socket: { remoteAddress: "127.0.0.1" }, headers: { host: "127.0.0.1:3000", origin: "http://127.0.0.1:3000", "sec-fetch-site": "same-origin" } };
  assert.equal(doctorRequestAllowed(req), true);
  assert.equal(doctorRequestAllowed({ ...req, headers: { host: req.headers.host } }), false);
  assert.equal(doctorRequestAllowed({ ...req, headers: { ...req.headers, origin: "https://evil.test" } }), false);
  assert.equal(doctorRequestAllowed({ ...req, socket: { remoteAddress: "10.0.0.1" } }), false);
  assert.equal(doctorRequestAllowed({ ...req, headers: { ...req.headers, host: "evil.test:3000" } }), false);
});

test("update probe failures get an explanation without exposing probe details", () => {
  const report = doctorReport(JSON.stringify({ schemaVersion: 1, overallStatus: "warning", checks: {
    updates: { id: "updates.status", category: "updates", status: "warning", summary: "Configuration is consistent", details: { "latest version probe": "error sending request for url PRIVATE_TEST_VALUE" } },
  } }));
  assert.match(report.checks[0].explanation, /lookup failed/);
  assert.ok(!JSON.stringify(report).includes("PRIVATE_TEST_VALUE"));
});
