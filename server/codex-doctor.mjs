import { execFile } from "node:child_process";
import { localRequestAllowed } from "./codex-sessions.mjs";

const statuses = new Set(["ok", "warning", "fail", "unknown", "skipped"]);

// Forward check summaries only, never the detailed local inventory or auth fields.
export function doctorReport(text) {
  const raw = JSON.parse(text);
  if (raw.schemaVersion !== 1 || !statuses.has(raw.overallStatus) ||
      !raw.checks || typeof raw.checks !== "object" || Array.isArray(raw.checks))
    throw new Error("Unsupported Codex diagnostic report.");
  const checks = Object.values(raw.checks).map((check) => {
    if (!check || !statuses.has(check.status) ||
        ![check.id, check.category, check.summary].every((v) => typeof v === "string"))
      throw new Error("Invalid Codex diagnostic check.");
    return {
      id: check.id, category: check.category, status: check.status,
      summary: check.summary,
      explanation: check.id === "updates.status" && check.status !== "ok" &&
        /error|failed|unreachable/i.test(check.details?.["latest version probe"] ?? "")
          ? "The latest-version lookup failed, so update availability could not be verified." : null,
      remediation: typeof check.remediation === "string" ? check.remediation : null,
    };
  });
  return {
    checkedAt: new Date().toISOString(),
    version: typeof raw.codexVersion === "string" ? raw.codexVersion : "Unknown",
    status: raw.overallStatus, checks,
  };
}

export function runDoctor() {
  return new Promise((resolve, reject) => {
    execFile(process.env.DOTS_CODEX_BIN || "codex", ["doctor", "--json"], {
      timeout: 45_000, maxBuffer: 1024 * 1024, windowsHide: true,
    }, (error, stdout) => {
      // Exit 1 can mean a valid report with failing checks, not an execution failure.
      if (error && (error.killed || typeof error.code !== "number")) {
        reject(new Error(error.code === "ENOENT"
          ? "Codex CLI is unavailable on this computer."
          : "The diagnostic check could not finish. Try again."));
        return;
      }
      try { resolve(doctorReport(stdout)); }
      catch { reject(new Error("Codex did not return a supported diagnostic report.")); }
    });
  });
}

export function doctorRequestAllowed(req) {
  return localRequestAllowed(req) && req.headers.origin === `http://${req.headers.host}`;
}

export function codexDoctorPlugin() {
  let running = false;
  return {
    name: "dots-codex-doctor",
    configureServer(server) {
      server.middlewares.use("/api/local-codex/doctor", async (req, res) => {
        res.setHeader("Cache-Control", "no-store");
        res.setHeader("Content-Type", "application/json");
        if (!doctorRequestAllowed(req)) {
          res.statusCode = 403;
          res.end(JSON.stringify({ error: "Run diagnostics from the local office on this computer." }));
          return;
        }
        if (req.method !== "POST") {
          res.statusCode = 405;
          res.setHeader("Allow", "POST");
          res.end(JSON.stringify({ error: "Use Run setup check to start diagnostics." }));
          return;
        }
        if (running) {
          res.statusCode = 409;
          res.end(JSON.stringify({ error: "A diagnostic check is already running. Try again shortly." }));
          return;
        }
        running = true;
        try { res.end(JSON.stringify(await runDoctor())); }
        catch (error) {
          res.statusCode = 503;
          res.end(JSON.stringify({ error: error.message }));
        } finally { running = false; }
      });
    },
  };
}
