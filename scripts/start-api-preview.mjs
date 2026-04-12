import { spawn } from "node:child_process";
import { openSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { resolveGiomApiPort } from "../config/runtimePorts.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(__dirname, "..");
const port = String(process.argv[2] || resolveGiomApiPort(process.env));
const logPath = path.join(repoRoot, "reports", `api-preview-${port}.log`);
const out = openSync(logPath, "a");

const child = spawn(process.execPath, ["apps/api/src/server.js"], {
  cwd: repoRoot,
  detached: true,
  stdio: ["ignore", out, out],
  env: {
    ...process.env,
    PORT: port,
    API_PORT: port
  }
});

child.unref();

console.log(JSON.stringify({
  started: true,
  pid: child.pid,
  port,
  cwd: repoRoot,
  logPath
}, null, 2));
