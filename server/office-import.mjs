import { randomBytes } from "node:crypto";
import { localRequestAllowed } from "./codex-sessions.mjs";
import { parseOfficeSnapshot } from "../src/snapshot.ts";
import { serializeOffice } from "../src/officeStore.ts";

// Development-only rendezvous. No filesystem reader or public session endpoint.
export function createOfficeImportHandler({ now = Date.now } = {}) {
  const imports = new Map();
  const token = () => randomBytes(24).toString("hex");
  return async (req, res) => {
    const send = (status, body) => {
      res.writeHead(status, { "Content-Type": "application/json", "Cache-Control": "no-store" });
      res.end(JSON.stringify(body));
    };
    if (!localRequestAllowed(req)) return send(403, { error: "Open the local office on this computer." });
    for (const [id, entry] of imports) if (entry.expiresAt <= now()) imports.delete(id);
    const pathname = new URL(req.url, "http://localhost").pathname;
    if (pathname === "/" && req.method === "POST") {
      if (imports.size >= 50) return send(429, { error: "Too many open imports. Try again after an import expires." });
      const entry = { id: token(), readToken: token(), uploadToken: token(), expiresAt: now() + 15 * 60_000, snapshot: null };
      imports.set(entry.id, entry);
      return send(201, { ...entry, snapshot: undefined });
    }
    const entry = imports.get(pathname.slice(1));
    if (!entry) return send(410, { error: "This import expired. Create a new prompt." });
    const auth = req.headers.authorization;
    if (req.method === "GET" || req.method === "DELETE") {
      if (auth !== `Bearer ${entry.readToken}`) return send(403, { error: "This import belongs to another browser." });
      if (req.method === "DELETE") imports.delete(entry.id);
      return send(200, { snapshot: req.method === "GET" ? entry.snapshot : null });
    }
    if (req.method !== "PUT") return send(405, { error: "Unsupported import action." });
    if (auth !== `Bearer ${entry.uploadToken}`) return send(403, { error: "Invalid upload token." });
    if (!req.headers["content-type"]?.startsWith("application/json")) return send(415, { error: "Send an office snapshot as application/json." });
    try {
      let length = 0;
      const chunks = [];
      for await (const chunk of req) {
        length += chunk.length;
        if (length > 2_000_000) return send(413, { error: "Choose a snapshot smaller than 2 MB." });
        chunks.push(chunk);
      }
      const parsed = parseOfficeSnapshot(Buffer.concat(chunks).toString("utf8"));
      // Allowlist stored fields; never retain arbitrary uploaded archive fields.
      const snapshot = JSON.parse(serializeOffice(parsed.agents, parsed.interactions));
      if (entry.snapshot && JSON.stringify(entry.snapshot) !== JSON.stringify(snapshot))
        return send(409, { error: "This prompt already received a snapshot. Create a new prompt to import again." });
      entry.snapshot = snapshot;
      return send(200, { accepted: snapshot.agents.length });
    } catch (error) {
      return send(400, { error: error instanceof Error ? error.message : "Unable to read snapshot." });
    }
  };
}

export function officeImportPlugin() {
  return {
    name: "dots-office-import",
    configureServer(server) {
      server.middlewares.use("/api/office-import", createOfficeImportHandler());
    },
  };
}
