import { spawn } from "node:child_process";
import { openSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  resolveGiomBackendProxyTarget,
  resolveGiomWebPreviewPort
} from "../config/runtimePorts.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(__dirname, "..");
const webRoot = path.join(repoRoot, "apps", "web-next");
const nextBin = path.join(repoRoot, "node_modules", "next", "dist", "bin", "next");
const port = String(process.argv[2] || resolveGiomWebPreviewPort(process.env));
const backendTarget = resolveGiomBackendProxyTarget(process.env);
const logPath = path.join(repoRoot, "reports", "front-preview.log");
const out = openSync(logPath, "a");

const child = spawn(process.execPath, [nextBin, "start", "-p", port], {
  cwd: webRoot,
  detached: true,
  stdio: ["ignore", out, out],
  env: {
    ...process.env,
    NEXT_PUBLIC_BACKEND_PROXY_TARGET: process.env.NEXT_PUBLIC_BACKEND_PROXY_TARGET || backendTarget
  }
});

child.unref();

console.log(JSON.stringify({
  started: true,
  pid: child.pid,
  port,
  backendTarget,
  webRoot,
  logPath
}, null, 2));
