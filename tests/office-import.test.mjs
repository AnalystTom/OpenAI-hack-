import { test } from "node:test";
import assert from "node:assert/strict";
import { createServer } from "node:http";
import { createOfficeImportHandler } from "../server/office-import.mjs";
import { importPrompt } from "../src/integrations/codex/importPrompt.ts";

test("temporary upload separates write/read access, validates data, expires and revokes", async () => {
  let now = Date.now();
  const server = createServer(createOfficeImportHandler({ now: () => now }));
  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
  const base = `http://127.0.0.1:${server.address().port}`;
  const call = (id = "", method = "GET", token, body) => fetch(`${base}/${id}`, {
    method,
    headers: { "Content-Type": "application/json", ...(token ? { Authorization: `Bearer ${token}` } : {}) },
    ...(body !== undefined ? { body: JSON.stringify(body) } : {}),
  });
  try {
    const pairing = await (await call("", "POST")).json();
    const other = await (await call("", "POST")).json();
    assert.equal((await call(pairing.id)).status, 403);
    assert.equal((await call(pairing.id, "GET", pairing.uploadToken)).status, 403);
    assert.equal((await call(pairing.id, "GET", other.readToken)).status, 403);
    assert.equal((await call(pairing.id, "PUT", pairing.readToken, {})).status, 403);
    assert.equal((await call(pairing.id, "PUT", pairing.uploadToken, {})).status, 400);
    const empty = { version: 1, agents: [], privateArchive: "must-not-be-stored" };
    assert.equal((await call(pairing.id, "PUT", pairing.uploadToken, empty)).status, 200);
    assert.deepEqual(await (await call(pairing.id, "GET", pairing.readToken)).json(), { snapshot: { version: 1, agents: [] } });
    assert.equal((await call(pairing.id, "PUT", pairing.uploadToken, empty)).status, 200);
    assert.equal((await call(pairing.id, "DELETE", pairing.readToken)).status, 200);
    assert.equal((await call(pairing.id, "GET", pairing.readToken)).status, 410);
    now += 15 * 60_000;
    assert.equal((await call(other.id, "GET", other.readToken)).status, 410);
    assert.equal((await fetch(`${base}/`, { method: "POST", headers: { Origin: "https://unrelated.test" } })).status, 403);
  } finally {
    await new Promise((resolve) => server.close(resolve));
  }
});

test("static-host prompt gives a real file-import route without a pretend upload", () => {
  const prompt = importPrompt("");
  assert.match(prompt, /Ask me which project/);
  assert.match(prompt, /Save the JSON as dots-snapshot.json/);
  assert.doesNotMatch(prompt, /Bearer|HTTP PUT/);
  const local = importPrompt("My project", { url: "http://127.0.0.1:3000/api/office-import/unit-test", token: "unit-test-only" });
  assert.match(local, /Only the project I specify/);
  assert.match(local, /HTTP PUT/);
});
