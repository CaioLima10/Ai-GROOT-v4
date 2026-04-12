#!/usr/bin/env node
import fs from "node:fs/promises";
import path from "node:path";
import process from "node:process";
import { createEnterpriseLocalVoiceRuntime } from "../apps/api/src/enterpriseLocalVoiceRuntime.js";
import { createEnterpriseVoiceRuntime } from "../apps/api/src/enterpriseVoiceRuntime.js";

function assert(condition, message) {
  if (!condition) {
    throw new Error(message);
  }
}

async function loadDotEnv() {
  const envPath = path.join(process.cwd(), ".env");
  let raw;
  try {
    raw = await fs.readFile(envPath, "utf8");
  } catch {
    return;
  }

  for (const line of raw.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#") || !trimmed.includes("=")) {
      continue;
    }

    const separatorIndex = trimmed.indexOf("=");
    const key = trimmed.slice(0, separatorIndex).trim();
    const value = trimmed.slice(separatorIndex + 1).trim().replace(/^['"]|['"]$/g, "");

    if (key && !(key in process.env)) {
      process.env[key] = value;
    }
  }
}

function normalizeText(value, maxLength = 240) {
  const normalized = String(value || "").trim();
  if (!normalized) {
    return "";
  }

  return normalized.length <= maxLength
    ? normalized
    : `${normalized.slice(0, Math.max(0, maxLength - 3)).trim()}...`;
}

function buildWavBase64(samples, sampleRate = 16_000) {
  const channelCount = 1;
  const bitsPerSample = 16;
  const blockAlign = channelCount * (bitsPerSample / 8);
  const byteRate = sampleRate * blockAlign;
  const dataSize = samples.length * blockAlign;
  const buffer = Buffer.alloc(44 + dataSize);

  buffer.write("RIFF", 0, "ascii");
  buffer.writeUInt32LE(36 + dataSize, 4);
  buffer.write("WAVE", 8, "ascii");
  buffer.write("fmt ", 12, "ascii");
  buffer.writeUInt32LE(16, 16);
  buffer.writeUInt16LE(1, 20);
  buffer.writeUInt16LE(channelCount, 22);
  buffer.writeUInt32LE(sampleRate, 24);
  buffer.writeUInt32LE(byteRate, 28);
  buffer.writeUInt16LE(blockAlign, 32);
  buffer.writeUInt16LE(bitsPerSample, 34);
  buffer.write("data", 36, "ascii");
  buffer.writeUInt32LE(dataSize, 40);

  for (let index = 0; index < samples.length; index += 1) {
    const sample = Math.max(-1, Math.min(1, Number(samples[index] || 0)));
    buffer.writeInt16LE(Math.round(sample * 32767), 44 + index * 2);
  }

  return buffer.toString("base64");
}

function buildSpeechLikeSamples() {
  const silenceFrames = 16_000 * 0.18;
  const speechFrames = 16_000 * 0.36;
  const endingSilenceFrames = 16_000 * 0.14;
  const samples = [];

  for (let index = 0; index < silenceFrames; index += 1) {
    samples.push(0);
  }

  for (let index = 0; index < speechFrames; index += 1) {
    samples.push(Math.sin((2 * Math.PI * 440 * index) / 16_000) * 0.24);
  }

  for (let index = 0; index < endingSilenceFrames; index += 1) {
    samples.push(0);
  }

  return samples;
}

function isEnvTrue(value) {
  const normalized = String(value || "").trim().toLowerCase();
  return normalized === "1" || normalized === "true" || normalized === "yes";
}

async function loadSmokeAudioPayload() {
  const filePath = normalizeText(process.env.GIOM_VOICE_SMOKE_AUDIO_FILE || "", 400);
  if (filePath) {
    const resolvedFilePath = path.resolve(process.cwd(), filePath);
    const audioBuffer = await fs.readFile(resolvedFilePath);
    const extension = path.extname(resolvedFilePath).toLowerCase();
    const mimeType = extension === ".wav" ? "audio/wav" : "application/octet-stream";

    return {
      audioBase64: audioBuffer.toString("base64"),
      mimeType,
      fileName: path.basename(resolvedFilePath)
    };
  }

  return {
    audioBase64: buildWavBase64(buildSpeechLikeSamples()),
    mimeType: "audio/wav",
    fileName: "voice-smoke-fallback.wav"
  };
}

function assertProviderReady(kind, status) {
  if (!status?.requested) {
    return;
  }

  assert(
    status.available,
    `${kind.toUpperCase()} provider requested but unavailable (${status.reason || "unknown_reason"})`
  );
}

async function runLocalVoiceSmoke() {
  const runtime = createEnterpriseLocalVoiceRuntime();
  const status = runtime.getStatus();

  assert(Array.isArray(status.fallbackOrder), "missing voice fallback order");
  assert(status.vad?.available !== undefined, "missing vad status");
  assertProviderReady("stt", status.stt);
  assertProviderReady("tts", status.tts);

  const vad = await runtime.analyzeVad({
    audioBase64: buildWavBase64(buildSpeechLikeSamples()),
    mimeType: "audio/wav",
    vad: {
      threshold: 0.02,
      silenceMs: 220
    }
  });

  assert(vad.supported === true, "expected server VAD support for wav payload");
  assert(vad.detected === true, "expected server VAD to detect speech-like audio");

  if (!isEnvTrue(process.env.GIOM_VOICE_SMOKE_REAL)) {
    return {
      status,
      exercised: []
    };
  }

  const exercised = [];
  let synthesizedAudio = null;

  if (status.tts?.available) {
    const speech = await runtime.synthesize({
      text: "Teste de voz local do GIOM.",
      language: "pt-BR"
    });

    assert(speech.audioBase64, "local TTS smoke did not return audio");
    exercised.push("tts");
    synthesizedAudio = {
      audioBase64: speech.audioBase64,
      mimeType: speech.mimeType || "audio/wav",
      fileName: "voice-smoke-tts.wav"
    };
  }

  if (status.stt?.available) {
    const audioPayload = synthesizedAudio || await loadSmokeAudioPayload();
    const transcription = await runtime.transcribe({
      ...audioPayload,
      language: "pt-BR",
      final: true
    });

    assert(normalizeText(transcription.text, 120).length >= 1, "local STT smoke returned empty text");
    exercised.push("stt");
  }

  return {
    status,
    exercised
  };
}

async function main() {
  await loadDotEnv();

  const runtime = createEnterpriseVoiceRuntime({
    maxSessions: 10,
    maxEventsPerSession: 10
  });

  const session = runtime.createSession({
    userId: "smoke_user",
    locale: "pt-BR",
    metadata: {
      source: "smoke"
    }
  });

  assert(session.sessionId, "missing sessionId");
  runtime.appendEvent(session.sessionId, {
    type: "transcription.partial",
    direction: "input",
    final: false,
    text: "teste parcial"
  });
  runtime.appendEvent(session.sessionId, {
    type: "transcription.final",
    direction: "input",
    final: true,
    text: "teste final"
  });

  const events = runtime.getEvents(session.sessionId, 10);
  assert(events.length === 2, "unexpected event count");
  assert(events[1]?.type === "transcription.final", "final event missing");

  runtime.closeSession(session.sessionId, "smoke_complete");
  const summary = runtime.getSummary();
  assert(summary.totalEvents >= 3, "summary did not count close event");

  const localVoice = await runLocalVoiceSmoke();

  console.log(JSON.stringify({
    ok: true,
    sessionRuntime: {
      sessionId: session.sessionId,
      totalEvents: summary.totalEvents
    },
    localVoice: {
      status: localVoice.status,
      exercised: localVoice.exercised
    }
  }));
  console.log("VOICE_RUNTIME_SMOKE_OK");
}

main().catch((error) => {
  console.error(`VOICE_RUNTIME_SMOKE_ERROR ${error?.message || error}`);
  process.exit(1);
});
