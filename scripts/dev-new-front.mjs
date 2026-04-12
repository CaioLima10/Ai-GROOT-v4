import "dotenv/config";
import { spawn } from "node:child_process";
import net from "node:net";
import { resolveGiomApiPort, resolveGiomWebPort } from "../config/runtimePorts.js";

function spawnCommand(command, args, options = {}) {
  if (process.platform === "win32") {
    const comspec = process.env.ComSpec || "C:\\Windows\\System32\\cmd.exe";
    return spawn(comspec, ["/d", "/s", "/c", [command, ...args].join(" ")], options);
  }

  return spawn(command, args, options);
}

function startProcess(command, args, label) {
  const child = spawnCommand(command, args, {
    stdio: "inherit",
    env: process.env
  });

  child.on("exit", (code) => {
    if (code !== 0) {
      console.error(`[${label}] exited with code ${code}`);
    }
  });

  return child;
}

function isPortAvailable(port) {
  return new Promise((resolve) => {
    const socket = new net.Socket();
    socket.setTimeout(600);

    socket.on("connect", () => {
      socket.destroy();
      resolve(false);
    });

    socket.on("timeout", () => {
      socket.destroy();
      resolve(true);
    });

    socket.on("error", (error) => {
      const code = String(error?.code || "");
      if (code === "ECONNREFUSED" || code === "EHOSTUNREACH") {
        resolve(true);
        return;
      }

      resolve(false);
    });

    socket.connect(port, "127.0.0.1");
  });
}

async function findAvailablePort(startPort, maxAttempts = 10) {
  for (let offset = 0; offset < maxAttempts; offset += 1) {
    const candidate = startPort + offset;
    // eslint-disable-next-line no-await-in-loop
    const available = await isPortAvailable(candidate);
    if (available) {
      return candidate;
    }
  }

  return null;
}

async function waitForPortToListen(port, timeoutMs = 120_000) {
  const startedAt = Date.now();

  while (Date.now() - startedAt < timeoutMs) {
    // eslint-disable-next-line no-await-in-loop
    const available = await isPortAvailable(port);
    if (!available) {
      return true;
    }

    // eslint-disable-next-line no-await-in-loop
    await new Promise((resolve) => setTimeout(resolve, 750));
  }

  return false;
}

const apiPort = resolveGiomApiPort(process.env);
const webPort = resolveGiomWebPort(process.env);

const apiPortAvailable = await isPortAvailable(apiPort);
const webPortAvailable = await isPortAvailable(webPort);

const apiProcess = apiPortAvailable
  ? startProcess("npm", ["run", "dev:api"], "api")
  : null;

if (!apiPortAvailable) {
  console.warn(`[api] porta ${apiPort} ocupada; assumindo backend ja em execucao`);
}

if (apiProcess) {
  const apiReady = await waitForPortToListen(apiPort);
  if (!apiReady) {
    console.error(`[api] backend nao ficou pronto na porta ${apiPort} dentro do tempo esperado`);
  }
}

const webProcess = webPortAvailable
  ? startProcess(
    "npm",
    ["--workspace", "web-next", "run", "dev", "--", "-p", String(webPort)],
    "web-next"
  )
  : null;

if (!webPortAvailable) {
  console.warn(`[web-next] porta ${webPort} ocupada; assumindo frontend ja em execucao`);
}

if (!apiProcess && !webProcess) {
  console.log(`Development mode: backend (${apiPort}) + web-next (${webPort}) ja estavam ativos`);
}

function shutdown(signal) {
  if (apiProcess) apiProcess.kill(signal);
  if (webProcess) webProcess.kill(signal);
  process.exit(0);
}

process.on("SIGINT", () => shutdown("SIGINT"));
process.on("SIGTERM", () => shutdown("SIGTERM"));

if (apiProcess || webProcess) {
  console.log(`Development mode: backend (${apiPort}) + web-next (${webPort})`);
}
