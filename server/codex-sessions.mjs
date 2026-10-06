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

/** Extract only destination metadata from known session-message tools. */
function messageDestination(name, raw) {
  if (typeof raw !== "string") return null;
  if (name === "exec") {
    const call = raw.match(/tools\.mcp__codex_app__send_message_to_thread\s*\(\s*\{([\s\S]{0,300})/);
    const id = call?.[1].match(/\bthreadId\s*:\s*(['"])([a-zA-Z0-9-]{8,100})\1/);
    return id ? { toId: id[2] } : null;
  }
  if (!["send_message_to_thread", "mcp__codex_app__send_message_to_thread", "send_message", "followup_task"].includes(name)) return null;
  try {
    const args = JSON.parse(raw);
    if (typeof args?.threadId === "string" && args.threadId.length <= 100) return { toId: args.threadId };
    if (typeof args?.target === "string" && /^[a-zA-Z0-9_/-]{1,100}$/.test(args.target)) return { toPath: args.target };
  } catch { /* Ignore malformed tool arguments. */ }
  return null;
}

/** Never interprets instructions or includes tool arguments/output from a rollout. */
export function parseSessionEvents(text, now = Date.now()) {
  let status = "unknown",
    contextUsed = null,
    contextWindow = null,
    updatedAt = null;
  let lastComplete = null,
    activeStart = null;
  const activity = [];
  const outbound = [];
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
    if (event.type === "event_msg") {
      if (p.type === "task_started") {
        status = "working";
        activeStart = at;
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
      const destination = messageDestination(name, p.arguments);
      if (destination && outbound.length < 20)
        outbound.push({ ...destination, at, kind: "message" });
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
  return { status, contextUsed, contextWindow, updatedAt, history, outbound };
}

function workspaceProject(database, cwd = process.cwd()) {
  const candidates = database.prepare("SELECT DISTINCT cwd FROM threads WHERE archived=0 AND cwd IS NOT NULL").all();
  return candidates.map((row) => row.cwd)
    .filter((candidate) => {
      const relative = path.relative(candidate, cwd);
      return relative === "" || (!relative.startsWith("..") && !path.isAbsolute(relative) && relative.split(path.sep).length <= 2);
    })
    .sort((a, b) => b.length - a.length)[0] ?? cwd;
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
  project,
  now = Date.now(),
} = {}) {
  const database = new DatabaseSync(path.join(codexHome, "state_5.sqlite"), {
    readOnly: true,
  });
  let rows, total, edges = [], selectedProject;
  try {
    selectedProject = project ?? process.env.DOTS_SESSION_CWD ?? workspaceProject(database);
    total = database
      .prepare(
        "SELECT count(*) AS count FROM threads WHERE archived=0 AND cwd=? AND (length(name)>0 OR length(title)>0)",
      )
      .get(selectedProject).count;
    rows = database
      .prepare(
        "SELECT id,name,title,model,agent_path,created_at,updated_at,rollout_path FROM threads WHERE archived=0 AND cwd=? AND (length(name)>0 OR length(title)>0) ORDER BY updated_at DESC LIMIT 6",
      )
      .all(selectedProject);
    if (rows.length > 1) {
      try {
        const ids = rows.map((row) => row.id);
        const placeholders = ids.map(() => "?").join(",");
        edges = database.prepare(
          `SELECT parent_thread_id,child_thread_id FROM thread_spawn_edges WHERE parent_thread_id IN (${placeholders}) AND child_thread_id IN (${placeholders})`,
        ).all(...ids, ...ids);
      } catch { /* Older Codex indexes may not have spawn edges. */ }
    }
  } finally {
    database.close();
  }
  const root = await realpath(codexHome);
  const parsed = await Promise.all(
    rows.map(async (row) => {
      let observed = {
        status: "unknown",
        contextUsed: null,
        contextWindow: null,
        updatedAt: null,
        history: [],
        outbound: [],
      };
      try {
        const rollout = await realpath(row.rollout_path);
        if (!rollout.startsWith(root + path.sep))
          throw new Error("Rollout is outside Codex data directory");
        observed = parseSessionEvents(await readTail(rollout), now);
      } catch {
        /* Unreadable source remains explicitly unknown. */
      }
      const { outbound, ...state } = observed;
      return { outbound, agent: {
        id: row.id,
        name: row.name?.trim() || row.title.trim(),
        harness: "Codex",
        model: row.model || null,
        task: row.name?.trim() || row.title.trim(),
        ...state,
        updatedAt:
          observed.updatedAt ?? new Date(row.updated_at * 1000).toISOString(),
        sourceUrl: `codex://threads/${encodeURIComponent(row.id)}`,
      } };
    }),
  );
  const agents = parsed.map((item) => item.agent);
  const selectedIds = new Set(agents.map((agent) => agent.id));
  const pathToId = new Map(rows.filter((row) => row.agent_path).map((row) => [row.agent_path, row.id]));
  const rowById = new Map(rows.map((row) => [row.id, row]));
  const destinationId = (sourceId, event) => {
    if (event.toId) return event.toId;
    const target = event.toPath;
    if (!target) return null;
    if (target === "/root") return edges.find((edge) => edge.child_thread_id === sourceId)?.parent_thread_id ?? null;
    const sourcePath = rowById.get(sourceId)?.agent_path ?? "/root";
    return pathToId.get(target.startsWith("/") ? target : `${sourcePath}/${target}`) ?? null;
  };
  const createdAt = new Map(rows.map((row) => [row.id, validTime(row.created_at)]));
  const interactions = [
    ...edges.map((edge) => ({
      fromId: edge.parent_thread_id,
      toId: edge.child_thread_id,
      at: createdAt.get(edge.child_thread_id),
      kind: "delegation",
    })),
    ...parsed.flatMap(({ agent, outbound }) => outbound.map((event) => ({
      fromId: agent.id, toId: destinationId(agent.id, event), at: event.at, kind: event.kind,
    }))),
  ].filter((link) => link.at && selectedIds.has(link.fromId) && selectedIds.has(link.toId) && link.fromId !== link.toId)
    .sort((a, b) => Date.parse(b.at) - Date.parse(a.at)).slice(0, 100);
  return {
    version: 1,
    agents,
    interactions,
    project: path.basename(selectedProject),
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
