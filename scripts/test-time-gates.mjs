import http from "node:http";
import { buildWeatherCardResponse } from "../apps/api/src/weatherRuntime.js";
import { buildFixtureCardResponse } from "../apps/api/src/enterpriseResponseCardsRuntime.js";

function startMockServer() {
  const server = http.createServer((req, res) => {
    const url = new URL(req.url || "/", "http://127.0.0.1");

    if (url.pathname.startsWith("/primary-ok/")) {
      const now = new Date("2026-03-31T20:25:00-03:00");
      const utcNow = new Date(now.getTime() + (3 * 60 * 60 * 1000));
      const payload = {
        timezone: "America/Sao_Paulo",
        datetime: now.toISOString().replace(".000Z", "-03:00"),
        utc_datetime: utcNow.toISOString(),
        utc_offset: "-03:00",
        unixtime: Math.floor(utcNow.getTime() / 1000)
      };
      res.writeHead(200, { "content-type": "application/json" });
      res.end(JSON.stringify(payload));
      return;
    }

    if (url.pathname.startsWith("/secondary-ok")) {
      const local = "2026-03-31T20:25:00";
      const payload = {
        timeZone: String(url.searchParams.get("timeZone") || "America/Sao_Paulo"),
        dateTime: local,
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

  return new Promise((resolve, reject) => {
    server.listen(0, "127.0.0.1", () => {
      const address = server.address();
      if (!address || typeof address === "string") {
        reject(new Error("Unable to bind mock server"));
        return;
      }
      resolve({ server, port: address.port });
    });
    server.on("error", reject);
  });
}

async function runScenario({ name, primaryPath, secondaryPath, expectedSource, expectedVerified }) {
  process.env.TIME_VERIFICATION_TIMEOUT_MS = "1200";
  process.env.TIME_VERIFICATION_CACHE_TTL_MS = "1000";
  process.env.TIME_VERIFICATION_ENABLED = "true";
  process.env.TIME_VERIFICATION_DEFAULT_ZONE = "America/Sao_Paulo";
  process.env.TIME_VERIFICATION_API_BASE_URL = primaryPath;
  process.env.TIME_VERIFICATION_SECONDARY_API_BASE_URL = secondaryPath;

  const runtimeClock = await import(`../apps/api/src/runtimeClock.js?scenario=${encodeURIComponent(name)}-${Date.now()}`);
  const { getVerifiedRuntimeClock, buildClockVerificationMeta, formatDateInTimeZone } = runtimeClock;

  const timezone = "America/Sao_Paulo";
  const clock = await getVerifiedRuntimeClock(timezone);
  const timeVerification = buildClockVerificationMeta(clock);
  const referenceDate = formatDateInTimeZone(clock.nowMs, timezone);

  const agroWeather = {
    provider: "open-meteo",
    timezone,
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
  };

  const liveFixture = {
    provider: "thesportsdb_verified",
    teamName: "Botafogo",
    subjectType: "club",
    league: "Brasileirao",
    hasUpcomingFixture: true,
    wantsHistory: false,
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
    recentMatches: [],
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
  };

  const weatherCard = buildWeatherCardResponse("clima em sao paulo", { agroWeather });
  const fixtureCard = buildFixtureCardResponse({ liveFixture });
  const fixturePayload = fixtureCard ? JSON.parse(fixtureCard) : null;
  const fallbackSafeMode = fixturePayload?.content?.hasUpcomingFixture === false;
  const parsed = {
    source: clock.source,
    verified: clock.verified,
    weatherCardBuilt: Boolean(weatherCard),
    fixtureCardBuilt: Boolean(fixtureCard),
    fixtureFallbackSafeMode: Boolean(fallbackSafeMode),
    weatherCalendar: weatherCard ? JSON.parse(weatherCard)?.content?.calendar || null : null,
    fixtureCalendar: fixturePayload?.content?.calendar || null
  };

  const sourceOk = parsed.source === expectedSource;
  const verifiedOk = parsed.verified === expectedVerified;
  const weatherGateOk = expectedVerified ? parsed.weatherCardBuilt : !parsed.weatherCardBuilt;
  const fixtureGateOk = expectedVerified ? parsed.fixtureCardBuilt : parsed.fixtureFallbackSafeMode;

  return {
    name,
    ok: sourceOk && verifiedOk && weatherGateOk && fixtureGateOk,
    checks: {
      sourceOk,
      verifiedOk,
      weatherGateOk,
      fixtureGateOk
    },
    output: parsed
  };
}

const { server, port } = await startMockServer();

try {
  const base = `http://127.0.0.1:${port}`;
  const scenarios = [
    {
      name: "Etapa 1 - Primario OK",
      primaryPath: `${base}/primary-ok`,
      secondaryPath: `${base}/secondary-ok`,
      expectedSource: "worldtimeapi",
      expectedVerified: true
    },
    {
      name: "Etapa 2 - Fallback TimeAPI",
      primaryPath: `${base}/primary-down`,
      secondaryPath: `${base}/secondary-ok`,
      expectedSource: "timeapiio",
      expectedVerified: true
    },
    {
      name: "Etapa 3 - Falha total bloqueia",
      primaryPath: `${base}/primary-down`,
      secondaryPath: `${base}/secondary-down`,
      expectedSource: "system_clock:TIME_VERIFICATION_SECONDARY_HTTP_ERROR",
      expectedVerified: false
    }
  ];

  const results = [];
  for (const scenario of scenarios) {
    results.push(await runScenario(scenario));
  }
  const failed = results.filter((entry) => !entry.ok);

  console.log("=== RESULTADOS TIME GATES ===");
  for (const item of results) {
    console.log(`\\n${item.name}: ${item.ok ? "PASSOU" : "FALHOU"}`);
    if (item.checks) {
      console.log(JSON.stringify(item.checks));
      console.log(JSON.stringify(item.output));
    } else {
      console.log(String(item.error || "erro desconhecido"));
    }
  }

  if (failed.length > 0) {
    process.exitCode = 1;
  }
} finally {
  server.close();
}
