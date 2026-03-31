#!/usr/bin/env node
import { appendFile, mkdir, writeFile } from "node:fs/promises";
import { dirname } from "node:path";
import process from "node:process";

const GENERIC_FALLBACK_PATTERN = /^nao consegui (?:responder|processar) /i;

function parseNumberArg(name, fallback) {
  const token = process.argv.find((arg) => arg.startsWith(`--${name}=`));
  if (!token) return fallback;
  const parsed = Number(token.split("=")[1]);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function parseStringArg(name, fallback) {
  const token = process.argv.find((arg) => arg.startsWith(`--${name}=`));
  if (!token) return fallback;
  return String(token.split("=").slice(1).join("=") || fallback).trim();
}

function percentile(values, pct) {
  if (!values.length) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const index = Math.min(sorted.length - 1, Math.max(0, Math.floor((pct / 100) * sorted.length)));
  return sorted[index];
}

function parseSSEPacket(packet) {
  const lines = String(packet || "").split(/\r?\n/);
  let event = "message";
  const dataLines = [];

  for (const line of lines) {
    if (line.startsWith("event:")) {
      event = line.slice(6).trim();
      continue;
    }

    if (line.startsWith("data:")) {
      dataLines.push(line.slice(5).trim());
    }
  }

  if (!dataLines.length) return null;

  try {
    return {
      event,
      data: JSON.parse(dataLines.join("\n"))
    };
  } catch {
    return null;
  }
}

function extractAnswer(payload = {}) {
  return String(payload?.response || payload?.data?.response || "").trim();
}

async function askStreamOnce(baseUrl, requestIndex, timeoutMs, minDurationForPingMs) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  const startedAt = Date.now();

  let chunkCount = 0;
  let pingCount = 0;
  let completePayload = null;
  let errorPayload = null;

  try {
    const response = await fetch(`${baseUrl.replace(/\/$/, "")}/ask/stream`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-User-Id": "reliability_chaos_stream"
      },
      body: JSON.stringify({
        question: `Teste de estabilidade SSE #${requestIndex}: responda em 3 frases objetivas sobre resiliencia de API.`,
        context: {
          channel: "reliability-chaos-stream",
          migrationStage: 4,
          clientRetryAttempt: 1
        }
      }),
      signal: controller.signal
    });

    if (!response.ok || !response.body) {
      const raw = await response.text().catch(() => "");
      return {
        ok: false,
        kind: "http_error",
        status: response.status,
        latencyMs: Date.now() - startedAt,
        detail: raw || `HTTP ${response.status}`,
        chunkCount,
        pingCount
      };
    }

    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let buffer = "";

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      buffer += decoder.decode(value, { stream: true });
      const packets = buffer.split("\n\n");
      buffer = packets.pop() || "";

      for (const packet of packets) {
        const parsed = parseSSEPacket(packet);
        if (!parsed) continue;

        if (parsed.event === "ping") {
          pingCount += 1;
          continue;
        }

        if (parsed.event === "chunk") {
          chunkCount += 1;
          continue;
        }

        if (parsed.event === "complete") {
          completePayload = parsed.data || {};
          break;
        }

        if (parsed.event === "error") {
          errorPayload = parsed.data || {};
          break;
        }
      }

      if (completePayload || errorPayload) break;
    }

    if (!completePayload && !errorPayload && buffer.trim()) {
      const parsed = parseSSEPacket(buffer.trim());
      if (parsed?.event === "complete") {
        completePayload = parsed.data || {};
      } else if (parsed?.event === "error") {
        errorPayload = parsed.data || {};
      }
    }

    const latencyMs = Date.now() - startedAt;

    if (errorPayload) {
      return {
        ok: false,
        kind: "stream_error",
        latencyMs,
        detail: String(errorPayload?.error || "stream_error"),
        chunkCount,
        pingCount
      };
    }

    if (!completePayload) {
      return {
        ok: false,
        kind: "missing_complete",
        latencyMs,
        detail: "stream fechado sem evento complete",
        chunkCount,
        pingCount
      };
    }

    const answer = extractAnswer(completePayload);
    const metadata = completePayload?.metadata || {};

    if (!answer) {
      return {
        ok: false,
        kind: "empty_answer",
        latencyMs,
        detail: "Resposta final vazia",
        chunkCount,
        pingCount
      };
    }

    const provider = String(metadata?.provider || "").toLowerCase();
    const deterministicNoChunk = provider === "decision_router_direct" || provider === "standard_fallback";

    if (chunkCount === 0 && !deterministicNoChunk) {
      return {
        ok: false,
        kind: "no_chunk",
        latencyMs,
        detail: "Nenhum evento chunk recebido",
        chunkCount,
        pingCount
      };
    }

    if (chunkCount === 0 && deterministicNoChunk) {
      return {
        ok: true,
        kind: "ok_no_chunk",
        latencyMs,
        detail: answer.slice(0, 120),
        chunkCount,
        pingCount
      };
    }

    if (metadata?.fallback && GENERIC_FALLBACK_PATTERN.test(answer)) {
      return {
        ok: true,
        kind: "generic_fallback",
        latencyMs,
        detail: answer.slice(0, 200),
        chunkCount,
        pingCount
      };
    }

    if (latencyMs >= minDurationForPingMs && pingCount === 0) {
      return {
        ok: false,
        kind: "missing_ping_long_stream",
        latencyMs,
        detail: `stream>${minDurationForPingMs}ms sem ping`,
        chunkCount,
        pingCount
      };
    }

    return {
      ok: true,
      kind: "ok",
      latencyMs,
      detail: answer.slice(0, 120),
      chunkCount,
      pingCount
    };
  } catch (error) {
    return {
      ok: false,
      kind: "network_error",
      latencyMs: Date.now() - startedAt,
      detail: error?.name === "AbortError"
        ? `timeout>${timeoutMs}ms`
        : String(error?.message || error || "network_error"),
      chunkCount,
      pingCount
    };
  } finally {
    clearTimeout(timer);
  }
}

async function runPool(total, concurrency, worker) {
  const results = new Array(total);
  let cursor = 0;

  async function runWorker() {
    while (cursor < total) {
      const current = cursor;
      cursor += 1;
      results[current] = await worker(current + 1);
    }
  }

  const runners = Array.from({ length: Math.max(1, concurrency) }, () => runWorker());
  await Promise.all(runners);
  return results;
}

async function main() {
  const baseUrl = parseStringArg("base", process.env.RELIABILITY_ASK_BASE_URL || "http://localhost:3002/backend");
  const requests = Math.max(1, parseNumberArg("requests", Number(process.env.RELIABILITY_STREAM_REQUESTS || 12)));
  const concurrency = Math.max(1, parseNumberArg("concurrency", Number(process.env.RELIABILITY_STREAM_CONCURRENCY || 3)));
  const timeoutMs = Math.max(7_000, parseNumberArg("timeoutMs", Number(process.env.RELIABILITY_STREAM_TIMEOUT_MS || 80_000)));
  const maxErrorRate = Math.max(0, parseNumberArg("maxErrorRate", Number(process.env.RELIABILITY_STREAM_MAX_ERROR_RATE || 0.10)));
  const maxFallbackRate = Math.max(0, parseNumberArg("maxFallbackRate", Number(process.env.RELIABILITY_STREAM_MAX_FALLBACK_RATE || 0.25)));
  const minDurationForPingMs = Math.max(2_000, parseNumberArg("minDurationForPingMs", Number(process.env.RELIABILITY_STREAM_MIN_DURATION_FOR_PING_MS || 12_000)));
  const outPath = parseStringArg("out", process.env.RELIABILITY_REPORT_OUT || "");
  const reportFormat = parseStringArg("report", process.env.RELIABILITY_REPORT_FORMAT || "json").toLowerCase();

  console.log(`[reliability-chaos-stream] base=${baseUrl} requests=${requests} concurrency=${concurrency} timeoutMs=${timeoutMs}`);

  const results = await runPool(requests, concurrency, (index) =>
    askStreamOnce(baseUrl, index, timeoutMs, minDurationForPingMs)
  );

  const latencies = results.map((item) => item?.latencyMs || 0).filter((n) => n > 0);
  const chunkSamples = results.map((item) => item?.chunkCount || 0).filter((n) => n >= 0);
  const pingSamples = results.map((item) => item?.pingCount || 0).filter((n) => n >= 0);

  const byKind = results.reduce((acc, item) => {
    const key = item?.kind || "unknown";
    acc[key] = (acc[key] || 0) + 1;
    return acc;
  }, {});

  const hardErrors =
    (byKind.http_error || 0)
    + (byKind.network_error || 0)
    + (byKind.stream_error || 0)
    + (byKind.missing_complete || 0)
    + (byKind.empty_answer || 0)
    + (byKind.no_chunk || 0)
    + (byKind.missing_ping_long_stream || 0);

  const genericFallbacks = byKind.generic_fallback || 0;
  const errorRate = hardErrors / requests;
  const fallbackRate = genericFallbacks / requests;

  const summary = {
    total: requests,
    ok: byKind.ok || 0,
    genericFallbacks,
    hardErrors,
    errorRate,
    fallbackRate,
    p50Ms: percentile(latencies, 50),
    p95Ms: percentile(latencies, 95),
    p99Ms: percentile(latencies, 99),
    avgChunks: chunkSamples.length ? Number((chunkSamples.reduce((a, b) => a + b, 0) / chunkSamples.length).toFixed(2)) : 0,
    avgPings: pingSamples.length ? Number((pingSamples.reduce((a, b) => a + b, 0) / pingSamples.length).toFixed(2)) : 0,
    byKind,
    timestamp: new Date().toISOString(),
    baseUrl
  };

  console.log("[reliability-chaos-stream] summary", JSON.stringify(summary, null, 2));

  if (outPath) {
    await mkdir(dirname(outPath), { recursive: true });
    if (reportFormat === "jsonl") {
      await appendFile(outPath, `${JSON.stringify(summary)}\n`, "utf8");
    } else {
      await writeFile(outPath, `${JSON.stringify(summary, null, 2)}\n`, "utf8");
    }
    console.log(`[reliability-chaos-stream] report saved at ${outPath}`);
  }

  if (errorRate > maxErrorRate || fallbackRate > maxFallbackRate) {
    console.error(
      `[reliability-chaos-stream] FAILED thresholds: errorRate=${errorRate.toFixed(3)} (max ${maxErrorRate}), fallbackRate=${fallbackRate.toFixed(3)} (max ${maxFallbackRate})`
    );
    process.exit(1);
  }

  console.log("[reliability-chaos-stream] PASSED thresholds");
}

main().catch((error) => {
  console.error("[reliability-chaos-stream] fatal", error?.message || error);
  process.exit(1);
});
