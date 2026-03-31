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

function extractAnswer(payload = {}) {
  return String(payload?.data?.response || payload?.response || payload?.answer || payload?.message || "").trim();
}

async function askOnce(baseUrl, requestIndex, timeoutMs) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  const startedAt = Date.now();

  try {
    const response = await fetch(`${baseUrl.replace(/\/$/, "")}/ask`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-User-Id": "reliability_chaos"
      },
      body: JSON.stringify({
        question: `Teste de estabilidade #${requestIndex}: responda em 2 frases objetivas sobre confiabilidade de sistemas.`,
        context: {
          channel: "reliability-chaos",
          migrationStage: 4,
          clientRetryAttempt: 1
        }
      }),
      signal: controller.signal
    });

    const latencyMs = Date.now() - startedAt;
    const raw = await response.text();
    let payload = {};

    try {
      payload = raw ? JSON.parse(raw) : {};
    } catch {
      payload = { raw };
    }

    if (!response.ok) {
      return {
        ok: false,
        kind: "http_error",
        status: response.status,
        latencyMs,
        detail: String(payload?.error || raw || `HTTP ${response.status}`)
      };
    }

    const answer = extractAnswer(payload);
    const metadata = payload?.metadata || payload?.data?.metadata || {};
    const isGenericFallback = GENERIC_FALLBACK_PATTERN.test(answer);

    if (metadata?.fallback && isGenericFallback) {
      return {
        ok: true,
        kind: "generic_fallback",
        latencyMs,
        detail: answer.slice(0, 200)
      };
    }

    if (!answer) {
      return {
        ok: false,
        kind: "empty_answer",
        latencyMs,
        detail: "Resposta vazia"
      };
    }

    return {
      ok: true,
      kind: "ok",
      latencyMs,
      detail: answer.slice(0, 120)
    };
  } catch (error) {
    const latencyMs = Date.now() - startedAt;
    return {
      ok: false,
      kind: "network_error",
      latencyMs,
      detail: error?.name === "AbortError"
        ? `timeout>${timeoutMs}ms`
        : String(error?.message || error || "network_error")
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

function percentile(values, pct) {
  if (!values.length) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const index = Math.min(sorted.length - 1, Math.max(0, Math.floor((pct / 100) * sorted.length)));
  return sorted[index];
}

async function main() {
  const baseUrl = parseStringArg("base", process.env.RELIABILITY_ASK_BASE_URL || "http://localhost:3002/backend");
  const requests = Math.max(1, parseNumberArg("requests", Number(process.env.RELIABILITY_REQUESTS || 24)));
  const concurrency = Math.max(1, parseNumberArg("concurrency", Number(process.env.RELIABILITY_CONCURRENCY || 4)));
  const timeoutMs = Math.max(5_000, parseNumberArg("timeoutMs", Number(process.env.RELIABILITY_TIMEOUT_MS || 70_000)));
  const maxErrorRate = Math.max(0, parseNumberArg("maxErrorRate", Number(process.env.RELIABILITY_MAX_ERROR_RATE || 0.08)));
  const maxFallbackRate = Math.max(0, parseNumberArg("maxFallbackRate", Number(process.env.RELIABILITY_MAX_FALLBACK_RATE || 0.2)));
  const outPath = parseStringArg("out", process.env.RELIABILITY_REPORT_OUT || "");
  const reportFormat = parseStringArg("report", process.env.RELIABILITY_REPORT_FORMAT || "json").toLowerCase();

  console.log(`[reliability-chaos] base=${baseUrl} requests=${requests} concurrency=${concurrency} timeoutMs=${timeoutMs}`);

  const results = await runPool(requests, concurrency, (index) => askOnce(baseUrl, index, timeoutMs));
  const latencies = results.map((item) => item?.latencyMs || 0).filter((n) => n > 0);

  const byKind = results.reduce((acc, item) => {
    const key = item?.kind || "unknown";
    acc[key] = (acc[key] || 0) + 1;
    return acc;
  }, {});

  const hardErrors = (byKind.http_error || 0) + (byKind.network_error || 0) + (byKind.empty_answer || 0);
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
    byKind,
    timestamp: new Date().toISOString(),
    baseUrl
  };

  console.log("[reliability-chaos] summary", JSON.stringify(summary, null, 2));

  if (outPath) {
    await mkdir(dirname(outPath), { recursive: true });
    if (reportFormat === "jsonl") {
      await appendFile(outPath, `${JSON.stringify(summary)}\n`, "utf8");
    } else {
      await writeFile(outPath, `${JSON.stringify(summary, null, 2)}\n`, "utf8");
    }
    console.log(`[reliability-chaos] report saved at ${outPath}`);
  }

  if (errorRate > maxErrorRate || fallbackRate > maxFallbackRate) {
    console.error(
      `[reliability-chaos] FAILED thresholds: errorRate=${errorRate.toFixed(3)} (max ${maxErrorRate}), fallbackRate=${fallbackRate.toFixed(3)} (max ${maxFallbackRate})`
    );
    process.exit(1);
  }

  console.log("[reliability-chaos] PASSED thresholds");
}

main().catch((error) => {
  console.error("[reliability-chaos] fatal", error?.message || error);
  process.exit(1);
});
