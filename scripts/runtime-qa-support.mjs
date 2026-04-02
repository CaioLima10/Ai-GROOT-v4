import { spawn } from "node:child_process"

export function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

export function spawnCommand(command, args, options = {}) {
  if (process.platform === "win32") {
    const comspec = process.env.ComSpec || "C:\\Windows\\System32\\cmd.exe"
    return spawn(comspec, ["/d", "/s", "/c", [command, ...args].join(" ")], options)
  }

  return spawn(command, args, options)
}

function attachLogs(child, logs, label = "runtime") {
  child.stdout?.on("data", (chunk) => {
    logs.push(`[${label}:stdout] ${String(chunk)}`)
  })

  child.stderr?.on("data", (chunk) => {
    logs.push(`[${label}:stderr] ${String(chunk)}`)
  })
}

export function startNodeProcess(entry, options = {}) {
  const {
    cwd = process.cwd(),
    env = {},
    label = "node-process"
  } = options

  const child = spawn(process.execPath, [entry], {
    cwd,
    env: {
      ...process.env,
      ...env
    },
    stdio: ["ignore", "pipe", "pipe"]
  })

  const logs = []
  attachLogs(child, logs, label)
  return { child, logs, label }
}

export function startNpmProcess(args, options = {}) {
  const {
    cwd = process.cwd(),
    env = {},
    label = "npm-process"
  } = options

  const child = spawnCommand("npm", args, {
    cwd,
    env: {
      ...process.env,
      ...env
    },
    stdio: "pipe"
  })

  const logs = []
  attachLogs(child, logs, label)
  return { child, logs, label }
}

export async function waitForUrl(url, options = {}) {
  const {
    timeoutMs = 45_000,
    intervalMs = 500,
    accept = (response) => response.ok
  } = options

  const startedAt = Date.now()

  while (Date.now() - startedAt < timeoutMs) {
    try {
      const response = await fetch(url)
      if (accept(response)) {
        return true
      }
    } catch {
      // keep polling
    }

    await sleep(intervalMs)
  }

  return false
}

export async function waitForAnyUrl(urls, options = {}) {
  const {
    timeoutMs = 45_000,
    intervalMs = 500,
    accept = (response) => response.ok
  } = options

  const startedAt = Date.now()

  while (Date.now() - startedAt < timeoutMs) {
    for (const url of urls) {
      try {
        const response = await fetch(url)
        if (accept(response)) {
          return true
        }
      } catch {
        // keep polling
      }
    }

    await sleep(intervalMs)
  }

  return false
}

export async function stopChildProcess(child, options = {}) {
  const { forceAfterMs = 6_000 } = options

  if (!child || child.exitCode !== null) {
    return
  }

  await new Promise((resolve) => {
    const finalize = () => {
      clearTimeout(forceTimer)
      clearTimeout(exitGuardTimer)
      resolve()
    }

    const forceTimer = setTimeout(() => {
      try {
        if (process.platform === "win32") {
          spawn("taskkill", ["/pid", String(child.pid), "/t", "/f"], {
            shell: true,
            stdio: "ignore"
          })
        } else {
          child.kill("SIGKILL")
        }
      } catch {
        // noop
      }
    }, forceAfterMs)

    const exitGuardTimer = setTimeout(finalize, forceAfterMs + 1_500)

    child.once("exit", finalize)

    try {
      if (process.platform === "win32") {
        spawn("taskkill", ["/pid", String(child.pid), "/t", "/f"], {
          shell: true,
          stdio: "ignore"
        })
      } else {
        child.kill("SIGTERM")
      }
    } catch {
      finalize()
    }
  })
}

export function formatRecentLogs(logs, lines = 40) {
  if (!Array.isArray(logs) || logs.length === 0) {
    return ""
  }

  return logs.slice(-lines).join("")
}
