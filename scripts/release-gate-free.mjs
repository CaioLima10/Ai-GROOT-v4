#!/usr/bin/env node
import { spawn } from "node:child_process";
import process from "node:process";

function parseStringArg(name, fallback) {
  const token = process.argv.find((arg) => arg.startsWith(`--${name}=`));
  if (!token) return fallback;
  return String(token.split("=").slice(1).join("=") || fallback).trim();
}

function runCommand(command, args) {
  return new Promise((resolve) => {
    const child = spawn(command, args, {
      stdio: "inherit",
      shell: process.platform === "win32"
    });

    child.on("exit", (code) => {
      resolve(code === 0);
    });
  });
}

async function main() {
  const profile = parseStringArg("profile", "standard").toLowerCase();
  const includeEval = !process.argv.includes("--skip-eval");
  const includeLint = !process.argv.includes("--skip-lint");

  const checksByProfile = {
    fast: [
      ["npm", ["run", "typecheck:web"]],
      ["npm", ["run", "typecheck:api-runtime"]],
      ["npm", ["run", "audit:enterprise:routes:parity"]],
      ["npm", ["run", "reliability:gate:checks-only"]]
    ],
    standard: [
      ["npm", ["run", "typecheck:web"]],
      ["npm", ["run", "typecheck:api-runtime"]],
      ["npm", ["run", "audit:enterprise:routes:parity"]],
      ["npm", ["run", "reliability:gate:checks-only"]],
      ["node", ["--test", "tests/ask-endpoint.integration.test.js"]]
    ]
  };

  const steps = [...(checksByProfile[profile] || checksByProfile.standard)];
  if (includeLint) {
    steps.splice(2, 0, ["npm", ["run", "lint"]]);
  }
  if (includeEval) {
    steps.push(["npm", ["run", "eval:giom:language"]]);
  }

  for (const [command, args] of steps) {
    console.log(`\n[release-gate-free] running ${command} ${args.join(" ")}`);
    const ok = await runCommand(command, args);
    if (!ok) {
      console.error(`[release-gate-free] FAILED at ${command} ${args.join(" ")}`);
      process.exit(1);
    }
  }

  console.log("\n[release-gate-free] ALL CHECKS PASSED");
}

main().catch((error) => {
  console.error("[release-gate-free] fatal", error?.message || error);
  process.exit(1);
});
