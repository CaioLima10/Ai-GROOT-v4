import { resolveFrontendBaseUrl } from "./lib/resolveFrontendBaseUrl.mjs"
import { resolveGiomApiBaseUrl } from "../config/runtimePorts.js"

function readCliOption(name, fallback = "") {
  const prefix = `--${name}=`
  const arg = process.argv.find((entry) => entry.startsWith(prefix))
  return arg ? arg.slice(prefix.length).trim() : fallback
}

const payload = {
  question: process.env.ASK_QUESTION || "oi",
  context: {
    channel: "web-next",
    migrationStage: 4
  }
};

const preferredFrontendUrl = readCliOption("frontend-url", process.env.FRONTEND_URL || "")
const preferredApiUrl = readCliOption("api-url", process.env.GIOM_API_BASE_URL || "")
const { baseUrl } = await resolveFrontendBaseUrl({
  preferredUrl: preferredFrontendUrl
})
const apiBaseUrl = preferredApiUrl || resolveGiomApiBaseUrl(process.env)

const endpoints = [
  `${apiBaseUrl}/ask`,
  `${apiBaseUrl}/ask/stream`,
  `${baseUrl}/backend/ask`,
  `${baseUrl}/backend/ask/stream`
];

for (const url of endpoints) {
  try {
    const response = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-User-Id": "probe-user"
      },
      body: JSON.stringify(payload)
    });

    const text = await response.text();
    console.log(`=== ${url} ===`);
    console.log(`status=${response.status}`);
    console.log(text.slice(0, 2000));
  } catch (error) {
    console.log(`=== ${url} ===`);
    console.log(`network_error=${error instanceof Error ? error.message : String(error)}`);
  }
}
