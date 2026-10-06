import { agentCostTracker } from "./agent-cost.mjs";
import { runHealthTracker } from "./run-health.mjs";
import { DatabaseSync } from "node:sqlite";
import { open, realpath } from "node:fs/promises";
import { homedir } from "node:os";
import path from "node:path";

const MAX_TAIL_BYTES = 2 * 1024 * 1024;
const ACTIVE_LEASE_MS = 5 * 60 * 1000;
const validTime = (value) => {
  const ms = typeof value === "number" ? value * 1000 : Date.parse(value);
  return Number.isFinite(ms) ? new Date(ms).toISOString() : null;
};

/** Never interprets instructions or includes tool arguments/output from a rollout. */
export function parseSessionEvents(text, now = Date.now(), currentModel = null) {
  let status = "unknown",
    contextUsed = null,
    contextWindow = null,
    updatedAt = null;
  let lastComplete = null,
    activeStart = null;
  const activity = [];
  const health = runHealthTracker();
  const cost = agentCostTracker(currentModel);
  for (const line of text.split("\n")) {
    let event;
    try {
      event = JSON.parse(line);
    } catch {
      continue;
    } // partial first/last append
    const p = event.payload;
    if (!p || !validTime(event.timestamp)) continue;
    const at = validTime(event.timestamp);
    health.observe(event);
    cost.observe(event);
    if (event.type === "event_msg") {
      if (p.type === "task_started") {
        status = "working";
        activeStart = at;
        contextUsed = null;
        activity.push({ at, status, label: "Task started" });
      }
      if (p.type === "task_complete") {
        status = "idle";
        const start = validTime(p.started_at) ?? activeStart;
        lastComplete = start
          ? { start, end: validTime(p.completed_at) ?? at }
          : null;
        activity.push({ at, status, label: "Task completed" });
        activeStart = null;
      }
      if (p.type === "turn_aborted") {
        status = "idle";
        activeStart = null;
        activity.push({ at, status, label: "Task interrupted" });
      }
      if (p.type === "token_count" && p.info) {
        const used = p.info.last_token_usage?.input_tokens;
        const window = p.info.model_context_window;
        contextUsed = Number.isFinite(used) && used >= 0 ? used : null;
        contextWindow = Number.isFinite(window) && window > 0 ? window : null;
      }
      if (["error", "turn_failed"].includes(p.type)) {
        status = "error"; updatedAt = at; activeStart = null;
      }
      // Settings changes do not constitute a heartbeat for running work.
      if (
        [
          "task_started",
          "task_complete",
          "turn_aborted",
          "token_count",
          "item_completed",
        ].includes(p.type)
      )
        updatedAt = at;
    }
    if (
      event.type === "response_item" &&
      ["function_call", "custom_tool_call"].includes(p.type)
    ) {
      updatedAt = at;
      // A recorded tool call is evidence of execution even when start is outside the bounded tail.
      status = "working";
      const name =
        typeof p.name === "string" && /^[a-zA-Z0-9_.-]{1,100}$/.test(p.name)
          ? p.name
          : "tool";
      activity.push({ at, status, label: `Using ${name}` });
    }
  }
  if (
    status === "working" &&
    (!updatedAt || now - Date.parse(updatedAt) > ACTIVE_LEASE_MS)
  )
    status = "unknown";
  let history = [];
  if (
    lastComplete &&
    Date.parse(lastComplete.end) > Date.parse(lastComplete.start)
  ) {
    const during = activity.filter(
      (e) => e.at >= lastComplete.start && e.at < lastComplete.end,
    );
    const step = Math.max(1, Math.ceil(during.length / 8));
    history = [
      { at: lastComplete.start, status: "working", label: "Task started" },
      ...during.filter((_, i) => i % step === 0).slice(0, 8),
      { at: lastComplete.end, status: "idle", label: "Task completed" },
    ];
  }
  return { status, contextUsed, contextWindow, updatedAt, history,
    health: health.snapshot(status, contextUsed, contextWindow), cost: cost.snapshot() };
}

async function readTail(file) {
  const handle = await open(file, "r");
  try {
    const { size } = await handle.stat();
    const length = Math.min(size, MAX_TAIL_BYTES);
    const buffer = Buffer.alloc(length);
    await handle.read(buffer, 0, length, size - length);
    return buffer.toString("utf8");
  } finally {
    await handle.close();
  }
}

export async function readRobotsSessions({
  codexHome = path.join(homedir(), ".codex"),
  project = process.env.DOTS_CODEX_PROJECT || path.join(homedir(), "Dev", "Robots"),
  now = Date.now(),
} = {}) {
  const database = new DatabaseSync(path.join(codexHome, "state_5.sqlite"), {
    readOnly: true,
  });
  let rows, total;
  try {
    total = database
      .prepare(
        "SELECT count(*) AS count FROM threads WHERE archived=0 AND cwd=? AND (length(name)>0 OR length(title)>0)",
      )
      .get(project).count;
    rows = database
      .prepare(
        "SELECT id,name,title,model,updated_at,rollout_path FROM threads WHERE archived=0 AND cwd=? AND (length(name)>0 OR length(title)>0) ORDER BY updated_at DESC LIMIT 6",
      )
      .all(project);
  } finally {
    database.close();
  }
  const root = await realpath(codexHome);
  const agents = await Promise.all(
    rows.map(async (row) => {
      let observed = {
        status: "unknown",
        contextUsed: null,
        contextWindow: null,
        updatedAt: null,
        history: [],
      };
      try {
        const rollout = await realpath(row.rollout_path);
        if (!rollout.startsWith(root + path.sep))
          throw new Error("Rollout is outside Codex data directory");
        observed = parseSessionEvents(await readTail(rollout), now, row.model);
      } catch {
        /* Unreadable source remains explicitly unknown. */
      }
      return {
        id: row.id,
        name: row.name?.trim() || row.title.trim(),
        harness: "Codex",
        model: row.model || null,
        task: row.name?.trim() || row.title.trim(),
        ...observed,
        updatedAt:
          observed.updatedAt ?? new Date(row.updated_at * 1000).toISOString(),
        sourceUrl: `codex://threads/${encodeURIComponent(row.id)}`,
      };
    }),
  );
  return {
    version: 1,
    agents,
    project: path.basename(project),
    total,
    observedAt: new Date(now).toISOString(),
  };
}

export function localRequestAllowed(req) {
  const ip = req.socket?.remoteAddress;
  if (!["127.0.0.1", "::1", "::ffff:127.0.0.1"].includes(ip)) return false;
  const host = req.headers.host;
  if (!host || !/^(127\.0\.0\.1|localhost|\[::1\]):\d+$/.test(host))
    return false;
  if (req.headers.origin && req.headers.origin !== `http://${host}`)
    return false;
  if (
    req.headers["sec-fetch-site"] &&
    req.headers["sec-fetch-site"] !== "same-origin"
  )
    return false;
  return true;
}

export function localCodexPlugin() {
  return {
    name: "dots-local-codex",
    configureServer(server) {
      server.middlewares.use("/api/local-codex/robots", async (req, res) => {
        res.setHeader("Cache-Control", "no-store");
        res.setHeader("Content-Type", "application/json");
        if (!localRequestAllowed(req)) {
          res.statusCode = 403;
          res.end(
            JSON.stringify({ error: "Use the local office on this computer." }),
          );
          return;
        }
        if (req.method !== "GET") {
          res.statusCode = 405;
          res.end(JSON.stringify({ error: "Read-only endpoint." }));
          return;
        }
        try {
          res.end(JSON.stringify(await readRobotsSessions()));
        } catch {
          res.statusCode = 503;
          res.end(
            JSON.stringify({
              error:
                "Local Codex sessions are unavailable. Open Codex on this computer, or import a snapshot.",
            }),
          );
        }
      });
    },
  };
}
