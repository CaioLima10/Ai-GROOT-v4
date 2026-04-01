#!/usr/bin/env node
import { spawn } from "node:child_process";
import process from "node:process";

function parseStringArg(name, fallback) {
  const token = process.argv.find((arg) => arg.startsWith(`--${name}=`));
  if (!token) return fallback;
  return String(token.split("=").slice(1).join("=") || fallback).trim();
}

function runCommand(command, args, options = {}) {
  return new Promise((resolve) => {
    const child = spawn(command, args, {
      stdio: "inherit",
      shell: process.platform === "win32",
      ...options
    });

    child.on("exit", (code) => {
      resolve(code === 0);
    });
  });
}

async function main() {
  const explicitSkipChaos = process.argv.includes("--skip-chaos") || process.env.RELIABILITY_SKIP_CHAOS === "true";
  const runningInCi = String(process.env.CI || "").toLowerCase() === "true";
  const forceChaosInCi = String(process.env.RELIABILITY_FORCE_CHAOS || "").toLowerCase() === "true";
  const skipChaos = explicitSkipChaos || (runningInCi && !forceChaosInCi);
  const profile = parseStringArg("profile", process.env.RELIABILITY_PROFILE || "standard").toLowerCase();
  const reportDir = parseStringArg("reportDir", process.env.RELIABILITY_REPORT_DIR || "reports/reliability");

  if (runningInCi && !explicitSkipChaos && !forceChaosInCi) {
    console.log("[reliability-gate] CI detected: chaos probes disabled by default (set RELIABILITY_FORCE_CHAOS=true to enable)");
  }

  const chaosByProfile = {
    fast: {
      ask: ["--requests=12", "--concurrency=3", "--maxErrorRate=0.10", "--maxFallbackRate=0.28"],
      stream: ["--requests=8", "--concurrency=2", "--maxErrorRate=0.14", "--maxFallbackRate=0.30"]
    },
    standard: {
      ask: ["--requests=24", "--concurrency=4", "--maxErrorRate=0.08", "--maxFallbackRate=0.20"],
      stream: ["--requests=12", "--concurrency=3", "--maxErrorRate=0.10", "--maxFallbackRate=0.25"]
    },
    strict: {
      ask: ["--requests=48", "--concurrency=6", "--maxErrorRate=0.05", "--maxFallbackRate=0.12"],
      stream: ["--requests=24", "--concurrency=4", "--maxErrorRate=0.07", "--maxFallbackRate=0.16", "--minDurationForPingMs=10000"]
    }
  };

  const selectedChaos = chaosByProfile[profile] || chaosByProfile.standard;

  const steps = [
    {
      name: "typecheck:web",
      cmd: "npm",
      args: ["run", "typecheck:web"]
    },
    {
      name: "typecheck:api-ts",
      cmd: "npm",
      args: ["run", "typecheck:api-ts"]
    },
    {
      name: "tests:runtime-fallback",
      cmd: "node",
      args: ["--test", "tests/fallback-ai-handler.test.js", "tests/enterprise-response-processing-runtime.test.js"]
    }
  ];

  if (!skipChaos) {
    steps.push({
      name: "chaos:ask-stability",
      cmd: "node",
      args: [
        "scripts/reliability-chaos-ask.mjs",
        ...selectedChaos.ask,
        `--out=${reportDir}/chaos-ask-${profile}.json`,
        "--report=json"
      ]
    });

    steps.push({
      name: "chaos:stream-stability",
      cmd: "node",
      args: [
        "scripts/reliability-chaos-stream.mjs",
        ...selectedChaos.stream,
        `--out=${reportDir}/chaos-stream-${profile}.json`,
        "--report=json"
      ]
    });
  }

  for (const step of steps) {
    console.log(`\n[reliability-gate] running ${step.name}`);
    const ok = await runCommand(step.cmd, step.args);
    if (!ok) {
      console.error(`[reliability-gate] FAILED at ${step.name}`);
      process.exit(1);
    }
  }

  console.log("\n[reliability-gate] ALL CHECKS PASSED");
}

main().catch((error) => {
  console.error("[reliability-gate] fatal", error?.message || error);
  process.exit(1);
});
