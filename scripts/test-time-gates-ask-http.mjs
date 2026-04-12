import http from "node:http";
import { spawn } from "node:child_process";

function delay(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function startMockTimeServer() {
  const server = http.createServer((req, res) => {
    const url = new URL(req.url || "/", "http://127.0.0.1");

    if (url.pathname.startsWith("/primary-ok/")) {
      const payload = {
        timezone: "America/Sao_Paulo",
        datetime: "2026-03-31T20:25:00-03:00",
        utc_datetime: "2026-03-31T23:25:00Z",
        utc_offset: "-03:00",
        unixtime: Math.floor(new Date("2026-03-31T23:25:00Z").getTime() / 1000)
      };
      res.writeHead(200, { "content-type": "application/json" });
      res.end(JSON.stringify(payload));
      return;
    }

    if (url.pathname.startsWith("/secondary-ok")) {
      const payload = {
        timeZone: String(url.searchParams.get("timeZone") || "America/Sao_Paulo"),
        dateTime: "2026-03-31T20:25:00",
        utcOffset: "-03:00",
        unixTime: Math.floor(new Date("2026-03-31T23:25:00Z").getTime() / 1000)
      };
      res.writeHead(200, { "content-type": "application/json" });
      res.end(JSON.stringify(payload));
      return;
    }

    if (url.pathname.startsWith("/primary-down/") || url.pathname.startsWith("/secondary-down")) {
      res.writeHead(503, { "content-type": "application/json" });
      res.end(JSON.stringify({ error: "unavailable" }));
      return;
    }

    res.writeHead(404, { "content-type": "application/json" });
    res.end(JSON.stringify({ error: "not-found", path: url.pathname }));
  });

  return await new Promise((resolve, reject) => {
    server.listen(0, "127.0.0.1", () => {
      const address = server.address();
      if (!address || typeof address === "string") {
        reject(new Error("mock time server bind failed"));
        return;
      }
      resolve({ server, port: address.port });
    });
    server.on("error", reject);
  });
}

async function waitForHealth(port, timeoutMs = 45000) {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    try {
      const response = await fetch(`http://127.0.0.1:${port}/health`);
      // Some deployments report degraded readiness as 503 but the API is already serving requests.
      if (response.status >= 200 && response.status < 600) return true;
    } catch {
      // keep polling
    }
    await delay(500);
  }
  return false;
}

function startApiServer(port, env) {
  const child = spawn(process.execPath, ["apps/api/dist/server.js"], {
    cwd: process.cwd(),
    env: {
      ...process.env,
      ...env,
      PORT: String(port),
      NODE_ENV: "test",
      OPENROUTER_KEY: process.env.OPENROUTER_KEY || "sk-or-v1-test",
      RESEARCH_WEATHER_ENABLED: "true",
      RESEARCH_SPORTS_ENABLED: "true"
    },
    stdio: ["ignore", "pipe", "pipe"]
  });

  const logs = [];
  child.stdout.on("data", (chunk) => {
    logs.push(String(chunk));
  });
  child.stderr.on("data", (chunk) => {
    logs.push(String(chunk));
  });

  return { child, logs };
}

function stopApiServer(child) {
  return new Promise((resolve) => {
    if (!child || child.killed) {
      resolve();
      return;
    }

    const timer = setTimeout(() => {
      try {
        child.kill("SIGKILL");
      } catch {
        // ignore
      }
      resolve();
    }, 4000);

    child.once("exit", () => {
      clearTimeout(timer);
      resolve();
    });

    try {
      child.kill("SIGTERM");
    } catch {
      clearTimeout(timer);
      resolve();
    }
  });
}

async function buildScenarioClock(primaryPath, secondaryPath, scenarioName) {
  process.env.TIME_VERIFICATION_ENABLED = "true";
  process.env.TIME_VERIFICATION_DEFAULT_ZONE = "America/Sao_Paulo";
  process.env.TIME_VERIFICATION_TIMEOUT_MS = "1200";
  process.env.TIME_VERIFICATION_CACHE_TTL_MS = "1000";
  process.env.TIME_VERIFICATION_API_BASE_URL = primaryPath;
  process.env.TIME_VERIFICATION_SECONDARY_API_BASE_URL = secondaryPath;

  const runtimeClock = await import(`../apps/api/src/runtimeClock.js?ask-http=${encodeURIComponent(scenarioName)}-${Date.now()}`);
  const clock = await runtimeClock.getVerifiedRuntimeClock("America/Sao_Paulo");
  const timeVerification = runtimeClock.buildClockVerificationMeta(clock);
  const referenceDate = runtimeClock.formatDateInTimeZone(clock.nowMs, "America/Sao_Paulo");

  return { clock, timeVerification, referenceDate };
}

async function postAsk(port, payload) {
  const response = await fetch(`http://127.0.0.1:${port}/ask`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(payload)
  });
  const body = await response.json();
  return { status: response.status, body };
}

function parseCardResponse(answerText) {
  const text = String(answerText || "").trim();
  if (!text.startsWith("{")) return null;
  try {
    return JSON.parse(text);
  } catch {
    return null;
  }
}

async function runScenario(index, scenario) {
  const apiPort = 3400 + index;
  const env = {
    TIME_VERIFICATION_ENABLED: "true",
    TIME_VERIFICATION_DEFAULT_ZONE: "America/Sao_Paulo",
    TIME_VERIFICATION_TIMEOUT_MS: "1200",
    TIME_VERIFICATION_CACHE_TTL_MS: "1000",
    TIME_VERIFICATION_API_BASE_URL: scenario.primaryPath,
    TIME_VERIFICATION_SECONDARY_API_BASE_URL: scenario.secondaryPath
  };

  const { child, logs } = startApiServer(apiPort, env);
  const healthy = await waitForHealth(apiPort);
  if (!healthy) {
    await stopApiServer(child);
    return {
      name: scenario.name,
      ok: false,
      error: "API nao ficou saudavel a tempo",
      logs: logs.join("")
    };
  }

  try {
    const { clock, timeVerification, referenceDate } = await buildScenarioClock(
      scenario.primaryPath,
      scenario.secondaryPath,
      scenario.name
    );

    const weatherContext = {
      preferredResponseVariant: "weather",
      agroWeather: {
        provider: "open-meteo",
        timezone: "America/Sao_Paulo",
        locationLabel: "Sao Paulo, BR",
        city: "Sao Paulo",
        region: "SP",
        country: "Brasil",
        coordinates: { latitude: -23.55, longitude: -46.63 },
        current: {
          temperature: 27,
          precipitation: 0,
          windSpeed: 8,
          weatherCode: 1,
          isDay: true,
          observedAt: new Date(clock.nowMs).toISOString()
        },
        daily: [
          { date: referenceDate, tempMax: 30, tempMin: 21, precipitationProbability: 20, precipitationSum: 0, weatherCode: 1, uvIndexMax: 7 },
          { date: referenceDate, tempMax: 29, tempMin: 20, precipitationProbability: 30, precipitationSum: 1, weatherCode: 2, uvIndexMax: 6 }
        ],
        todayIndex: 0,
        referenceDate,
        fetchedAt: new Date(clock.nowMs).toISOString(),
        timeVerification
      }
    };

    const fixtureContext = {
      preferredResponseVariant: "fixture",
      liveFixture: {
        provider: "thesportsdb_verified",
        teamName: "Botafogo",
        subjectType: "club",
        league: "Brasileirao",
        hasUpcomingFixture: true,
        wantsHistory: true,
        homeTeam: "Botafogo",
        awayTeam: "Flamengo",
        kickoff: "20:00",
        dateLabel: "31 mar",
        status: "agendado",
        venue: "Nilton Santos",
        summary: "Partida valida",
        nextMatches: [
          {
            id: "fx-1",
            homeTeam: "Botafogo",
            awayTeam: "Flamengo",
            kickoff: "20:00",
            dateLabel: "31 mar",
            status: "agendado",
            timestampMs: clock.nowMs + 3600000
          }
        ],
        recentMatches: [
          {
            id: "fx-r1",
            homeTeam: "Botafogo",
            awayTeam: "Vasco",
            homeScore: 2,
            awayScore: 1,
            dateLabel: "28 mar",
            status: "encerrado",
            timestampMs: clock.nowMs - 86400000
          }
        ],
        liveMatches: [],
        verification: {
          status: "checked",
          label: "dados conferidos",
          note: "ok",
          checkedAt: new Date(clock.nowMs).toISOString(),
          clock: timeVerification,
          providerChain: ["TheSportsDB", timeVerification?.source || "system_clock"]
        },
        timeVerification
      }
    };

    const weatherAsk = await postAsk(apiPort, {
      question: "clima em sao paulo",
      context: weatherContext
    });
    const fixtureAsk = await postAsk(apiPort, {
      question: "proximo jogo do botafogo",
      context: fixtureContext
    });

    const weatherCard = parseCardResponse(weatherAsk.body?.response || weatherAsk.body?.answer || weatherAsk.body?.data?.response);
    const fixtureCard = parseCardResponse(fixtureAsk.body?.response || fixtureAsk.body?.answer || fixtureAsk.body?.data?.response);

    const weatherIsCard = weatherCard?.meta?.variant === "weather";
    const fixtureIsCard = fixtureCard?.meta?.variant === "fixture";
    const fixtureSafeMode = fixtureCard?.content?.hasUpcomingFixture === false;

    const checks = {
      httpOk: weatherAsk.status === 200 && fixtureAsk.status === 200,
      weatherGateOk: scenario.expectedVerified ? weatherIsCard : !weatherIsCard,
      fixtureGateOk: scenario.expectedVerified ? fixtureIsCard : fixtureSafeMode,
      sourceOk: String(timeVerification?.source || "") === scenario.expectedSource,
      verifiedOk: Boolean(timeVerification?.verified) === scenario.expectedVerified
    };

    return {
      name: scenario.name,
      ok: Object.values(checks).every(Boolean),
      checks,
      output: {
        weatherStatus: weatherAsk.status,
        fixtureStatus: fixtureAsk.status,
        source: timeVerification?.source || null,
        verified: Boolean(timeVerification?.verified),
        weatherVariant: weatherCard?.meta?.variant || null,
        fixtureVariant: fixtureCard?.meta?.variant || null,
        fixtureHasUpcoming: fixtureCard?.content?.hasUpcomingFixture ?? null,
        weatherCalendar: weatherCard?.content?.calendar || null,
        fixtureCalendar: fixtureCard?.content?.calendar || null
      }
    };
  } finally {
    await stopApiServer(child);
  }
}

const { server, port } = await startMockTimeServer();

try {
  const base = `http://127.0.0.1:${port}`;
  const scenarios = [
    {
      name: "Etapa 1 HTTP - Primario OK",
      primaryPath: `${base}/primary-ok`,
      secondaryPath: `${base}/secondary-ok`,
      expectedSource: "worldtimeapi",
      expectedVerified: true
    },
    {
      name: "Etapa 2 HTTP - Fallback TimeAPI",
      primaryPath: `${base}/primary-down`,
      secondaryPath: `${base}/secondary-ok`,
      expectedSource: "timeapiio",
      expectedVerified: true
    },
    {
      name: "Etapa 3 HTTP - Falha total bloqueia",
      primaryPath: `${base}/primary-down`,
      secondaryPath: `${base}/secondary-down`,
      expectedSource: "system_clock:TIME_VERIFICATION_SECONDARY_HTTP_ERROR",
      expectedVerified: false
    }
  ];

  const results = [];
  for (let index = 0; index < scenarios.length; index += 1) {
    results.push(await runScenario(index, scenarios[index]));
  }

  console.log("=== RESULTADOS HTTP /ask TIME GATES ===");
  for (const result of results) {
    console.log(`\n${result.name}: ${result.ok ? "PASSOU" : "FALHOU"}`);
    if (result.checks) {
      console.log(JSON.stringify(result.checks));
      console.log(JSON.stringify(result.output));
    } else {
      console.log(String(result.error || "erro desconhecido"));
    }
  }

  if (results.some((entry) => !entry.ok)) {
    process.exitCode = 1;
  }
} finally {
  server.close();
}
