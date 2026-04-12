import test from "node:test"
import assert from "node:assert/strict"

import { createEnterpriseLocalVoiceRuntime } from "../apps/api/src/enterpriseLocalVoiceRuntime.js"

function buildWavBase64(samples, sampleRate = 16_000) {
  const channelCount = 1
  const bitsPerSample = 16
  const blockAlign = channelCount * (bitsPerSample / 8)
  const byteRate = sampleRate * blockAlign
  const dataSize = samples.length * blockAlign
  const buffer = Buffer.alloc(44 + dataSize)

  buffer.write("RIFF", 0, "ascii")
  buffer.writeUInt32LE(36 + dataSize, 4)
  buffer.write("WAVE", 8, "ascii")
  buffer.write("fmt ", 12, "ascii")
  buffer.writeUInt32LE(16, 16)
  buffer.writeUInt16LE(1, 20)
  buffer.writeUInt16LE(channelCount, 22)
  buffer.writeUInt32LE(sampleRate, 24)
  buffer.writeUInt32LE(byteRate, 28)
  buffer.writeUInt16LE(blockAlign, 32)
  buffer.writeUInt16LE(bitsPerSample, 34)
  buffer.write("data", 36, "ascii")
  buffer.writeUInt32LE(dataSize, 40)

  for (let index = 0; index < samples.length; index += 1) {
    const sample = Math.max(-1, Math.min(1, Number(samples[index] || 0)))
    buffer.writeInt16LE(Math.round(sample * 32767), 44 + index * 2)
  }

  return buffer.toString("base64")
}

function buildSpeechLikeSamples() {
  const silenceFrames = 16_000 * 0.2
  const speechFrames = 16_000 * 0.4
  const endingSilenceFrames = 16_000 * 0.15
  const samples = []

  for (let index = 0; index < silenceFrames; index += 1) {
    samples.push(0)
  }

  for (let index = 0; index < speechFrames; index += 1) {
    samples.push(Math.sin((2 * Math.PI * 440 * index) / 16_000) * 0.24)
  }

  for (let index = 0; index < endingSilenceFrames; index += 1) {
    samples.push(0)
  }

  return samples
}

test("local voice runtime reports disabled providers by default", () => {
  const runtime = createEnterpriseLocalVoiceRuntime({
    requestedSttProvider: "disabled",
    requestedTtsProvider: "disabled",
    serverVadEnabled: true
  })

  const status = runtime.getStatus()
  assert.equal(status.stt.available, false)
  assert.equal(status.tts.available, false)
  assert.equal(status.vad.available, true)
  assert.deepEqual(status.fallbackOrder, ["server-local", "browser-assisted", "text-only"])
})

test("local voice runtime marks requested local providers unavailable when command or model are missing", () => {
  const runtime = createEnterpriseLocalVoiceRuntime({
    requestedSttProvider: "whisper.cpp",
    requestedTtsProvider: "piper",
    stt: {
      command: "__missing_whisper_cli__",
      model: "./__missing_whisper_model__.bin"
    },
    tts: {
      command: "__missing_piper_cli__",
      model: "./__missing_piper_model__.onnx"
    },
    serverVadEnabled: true
  })

  const status = runtime.getStatus()
  assert.equal(status.stt.requested, true)
  assert.equal(status.stt.configured, true)
  assert.equal(status.stt.available, false)
  assert.deepEqual(status.stt.issues, ["command_not_found", "model_not_found"])
  assert.equal(status.tts.requested, true)
  assert.equal(status.tts.configured, true)
  assert.equal(status.tts.available, false)
  assert.deepEqual(status.tts.issues, ["command_not_found", "model_not_found"])
  assert.equal(runtime.hasServerTranscriptions(), false)
  assert.equal(runtime.hasServerSpeech(), false)
})

test("local voice runtime detects speech activity in wav payload", async () => {
  const runtime = createEnterpriseLocalVoiceRuntime({
    requestedSttProvider: "disabled",
    requestedTtsProvider: "disabled",
    serverVadEnabled: true
  })

  const vad = await runtime.analyzeVad({
    audioBase64: buildWavBase64(buildSpeechLikeSamples()),
    mimeType: "audio/wav",
    vad: {
      threshold: 0.02,
      silenceMs: 220
    }
  })

  assert.equal(vad.supported, true)
  assert.equal(vad.detected, true)
  assert.ok(vad.speechMs >= 250)
  assert.ok(Array.isArray(vad.segments))
  assert.ok(vad.segments.length >= 1)
})

test("local voice runtime delegates STT and TTS to injected providers", async () => {
  const runtime = createEnterpriseLocalVoiceRuntime({
    requestedSttProvider: "mock-stt",
    requestedTtsProvider: "mock-tts",
    sttProvider: {
      getStatus() {
        return {
          id: "mock-stt",
          kind: "stt",
          configured: true,
          available: true,
          mode: "mock"
        }
      },
      async transcribe(input = {}) {
        assert.equal(Buffer.isBuffer(input.audio?.audioBuffer), true)
        return {
          provider: "mock-stt",
          model: "mock-model",
          text: "transcricao local ok",
          language: input.language || "pt-BR",
          final: true,
          segments: [],
          source: "server_audio"
        }
      }
    },
    ttsProvider: {
      getStatus() {
        return {
          id: "mock-tts",
          kind: "tts",
          configured: true,
          available: true,
          mode: "mock"
        }
      },
      async synthesize(input = {}) {
        assert.equal(input.text, "fala de teste")
        return {
          provider: "mock-tts",
          model: "mock-model",
          format: "wav",
          mimeType: "audio/wav",
          voice: "mock-voice",
          audioBase64: Buffer.from("mock-audio").toString("base64"),
          audioBytes: 10,
          durationMs: 1200
        }
      }
    }
  })

  const transcription = await runtime.transcribe({
    audioBase64: buildWavBase64(buildSpeechLikeSamples()),
    mimeType: "audio/wav",
    language: "pt-BR"
  })

  const speech = await runtime.synthesize({
    text: "fala de teste",
    language: "pt-BR"
  })

  assert.equal(transcription.provider, "mock-stt")
  assert.equal(transcription.text, "transcricao local ok")
  assert.equal(speech.provider, "mock-tts")
  assert.match(String(speech.dataUrl || ""), /^data:audio\/wav;base64,/)
})