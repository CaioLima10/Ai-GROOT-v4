export type RealtimeVoiceSession = {
  sessionId: string;
  status: string;
  locale: string;
  transport: string;
  voice?: {
    input?: string;
    output?: string;
  } | null;
  vad?: {
    enabled?: boolean;
    threshold?: number;
    silenceMs?: number;
    sampleRate?: number;
  } | null;
}

export type BrowserSpeechController = {
  promise: Promise<void>;
  cancel: () => void;
}

export type SilenceDetectorController = {
  stop: () => void;
}

export type AudioLevelMonitorController = {
  stop: () => void;
}

export type WavAudioCaptureResult = {
  audioDataUrl: string;
  audioBase64: string;
  mimeType: string;
  sampleRate: number;
  channels: number;
  durationMs: number;
}

export type WavAudioRecorderController = {
  stop: () => Promise<WavAudioCaptureResult | null>;
  cancel: () => void;
}

type SilenceDetectorOptions = {
  threshold?: number;
  silenceMs?: number;
  minSpeechMs?: number;
  onLevel?: (level: number) => void;
  onSpeechStart?: () => void;
  onSpeechEnd?: () => void;
}

type AudioLevelMonitorOptions = {
  onLevel?: (level: number) => void;
}

type BrowserSpeechOptions = {
  text?: string;
  language?: string;
  voiceName?: string;
  rate?: number;
  pitch?: number;
}

type WavAudioRecorderOptions = {
  targetSampleRate?: number;
  channelCount?: number;
}

function getAudioContextCtor() {
  return window.AudioContext || (window as typeof window & { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
}

function mergeFloatChunks(chunks: Float32Array[]) {
  const totalLength = chunks.reduce((sum, chunk) => sum + chunk.length, 0);
  const merged = new Float32Array(totalLength);
  let offset = 0;

  for (const chunk of chunks) {
    merged.set(chunk, offset);
    offset += chunk.length;
  }

  return merged;
}

function downsamplePcm(input: Float32Array, inputSampleRate: number, targetSampleRate: number) {
  if (!input.length || targetSampleRate >= inputSampleRate) {
    return input;
  }

  const ratio = inputSampleRate / targetSampleRate;
  const newLength = Math.max(1, Math.round(input.length / ratio));
  const output = new Float32Array(newLength);
  let offsetResult = 0;
  let offsetBuffer = 0;

  while (offsetResult < output.length) {
    const nextOffsetBuffer = Math.min(input.length, Math.round((offsetResult + 1) * ratio));
    let accum = 0;
    let count = 0;

    for (let index = offsetBuffer; index < nextOffsetBuffer; index += 1) {
      accum += input[index];
      count += 1;
    }

    output[offsetResult] = count > 0 ? accum / count : 0;
    offsetResult += 1;
    offsetBuffer = nextOffsetBuffer;
  }

  return output;
}

function encodeMonoWav(samples: Float32Array, sampleRate: number) {
  const bytesPerSample = 2;
  const blockAlign = bytesPerSample;
  const byteRate = sampleRate * blockAlign;
  const dataSize = samples.length * bytesPerSample;
  const buffer = new ArrayBuffer(44 + dataSize);
  const view = new DataView(buffer);

  const writeAscii = (offset: number, value: string) => {
    for (let index = 0; index < value.length; index += 1) {
      view.setUint8(offset + index, value.charCodeAt(index));
    }
  };

  writeAscii(0, "RIFF");
  view.setUint32(4, 36 + dataSize, true);
  writeAscii(8, "WAVE");
  writeAscii(12, "fmt ");
  view.setUint32(16, 16, true);
  view.setUint16(20, 1, true);
  view.setUint16(22, 1, true);
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, byteRate, true);
  view.setUint16(32, blockAlign, true);
  view.setUint16(34, 16, true);
  writeAscii(36, "data");
  view.setUint32(40, dataSize, true);

  let offset = 44;
  for (let index = 0; index < samples.length; index += 1) {
    const sample = Math.max(-1, Math.min(1, samples[index] || 0));
    view.setInt16(offset, sample < 0 ? sample * 0x8000 : sample * 0x7fff, true);
    offset += 2;
  }

  return new Blob([buffer], { type: "audio/wav" });
}

async function blobToDataUrl(blob: Blob) {
  return await new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result || ""));
    reader.onerror = () => reject(new Error("blob_to_data_url_failed"));
    reader.readAsDataURL(blob);
  });
}

function pickVoice(
  synth: SpeechSynthesis,
  language = "pt-BR",
  voiceName?: string
) {
  const voices = synth.getVoices()
  if (!voices.length) {
    return null
  }

  const exactVoice = voiceName
    ? voices.find((voice) => voice.name.toLowerCase() === String(voiceName).toLowerCase())
    : null
  if (exactVoice) {
    return exactVoice
  }

  const languageLower = String(language || "pt-BR").toLowerCase()
  const sameLanguage = voices.find((voice) => String(voice.lang || "").toLowerCase() === languageLower)
  if (sameLanguage) {
    return sameLanguage
  }

  const languagePrefix = languageLower.split("-")[0]
  return voices.find((voice) => String(voice.lang || "").toLowerCase().startsWith(languagePrefix)) || voices[0]
}

export function isBrowserSpeechSynthesisSupported() {
  return typeof window !== "undefined" && typeof window.speechSynthesis !== "undefined"
}

export function isBrowserAudioCaptureSupported() {
  return typeof navigator !== "undefined" && !!navigator.mediaDevices?.getUserMedia
}

export function isBrowserWavRecorderSupported() {
  return typeof window !== "undefined"
    && typeof navigator !== "undefined"
    && !!navigator.mediaDevices?.getUserMedia
    && typeof getAudioContextCtor() !== "undefined";
}

export function buildSpeechSafeText(text = "") {
  return String(text || "")
    .replace(/```[\s\S]*?```/g, " ")
    .replace(/`([^`]+)`/g, "$1")
    .replace(/!\[[^\]]*]\([^)]*\)/g, " ")
    .replace(/\[[^\]]*]\([^)]*\)/g, " ")
    .replace(/[#>*_~-]+/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 1_200)
}

export function speakWithBrowser(options: BrowserSpeechOptions = {}): BrowserSpeechController {
  if (!isBrowserSpeechSynthesisSupported()) {
    throw new Error("Speech synthesis indisponivel neste navegador.")
  }

  const synth = window.speechSynthesis
  const text = buildSpeechSafeText(String(options.text || ""))
  if (!text) {
    throw new Error("Texto vazio para reproducao em voz.")
  }

  synth.cancel()
  const utterance = new SpeechSynthesisUtterance(text)
  utterance.lang = String(options.language || "pt-BR")
  utterance.rate = Math.max(0.6, Math.min(Number(options.rate || 1) || 1, 1.6))
  utterance.pitch = Math.max(0.4, Math.min(Number(options.pitch || 1) || 1, 1.6))

  const voice = pickVoice(synth, utterance.lang, options.voiceName)
  if (voice) {
    utterance.voice = voice
  }

  const promise: Promise<void> = new Promise<void>((resolve, reject) => {
    utterance.onend = () => resolve()
    utterance.onerror = (event) => reject(new Error(event.error || "speech_synthesis_failed"))
  })

  synth.speak(utterance)

  return {
    promise,
    cancel: () => synth.cancel()
  }
}

export async function createSilenceDetector(
  stream: MediaStream,
  options: SilenceDetectorOptions = {}
): Promise<SilenceDetectorController> {
  const AudioContextCtor = getAudioContextCtor()
  if (!AudioContextCtor) {
    throw new Error("AudioContext indisponivel neste navegador.")
  }

  const audioContext = new AudioContextCtor()
  const analyser = audioContext.createAnalyser()
  analyser.fftSize = 2048
  analyser.smoothingTimeConstant = 0.85

  const source = audioContext.createMediaStreamSource(stream)
  source.connect(analyser)

  const data = new Uint8Array(analyser.fftSize)
  const threshold = Math.max(0.01, Math.min(Number(options.threshold || 0.045) || 0.045, 0.5))
  const silenceMs = Math.max(300, Number(options.silenceMs || 1_400) || 1_400)
  const minSpeechMs = Math.max(120, Number(options.minSpeechMs || 300) || 300)
  let frame = 0
  let stopped = false
  let isSpeaking = false
  let speechStartedAt = 0
  let lastAboveThresholdAt = 0

  const tick = () => {
    if (stopped) {
      return
    }

    analyser.getByteTimeDomainData(data)
    let sum = 0
    for (let index = 0; index < data.length; index += 1) {
      const normalized = (data[index] - 128) / 128
      sum += normalized * normalized
    }

    const rms = Math.sqrt(sum / data.length)
    options.onLevel?.(Math.min(1, Math.max(0, rms * 4.4)))
    const now = performance.now()

    if (rms >= threshold) {
      lastAboveThresholdAt = now
      if (!isSpeaking) {
        isSpeaking = true
        speechStartedAt = now
        options.onSpeechStart?.()
      }
    } else if (isSpeaking && now - lastAboveThresholdAt >= silenceMs && now - speechStartedAt >= minSpeechMs) {
      isSpeaking = false
      options.onSpeechEnd?.()
    }

    frame = window.requestAnimationFrame(tick)
  }

  frame = window.requestAnimationFrame(tick)

  return {
    stop: () => {
      stopped = true
      if (frame) {
        window.cancelAnimationFrame(frame)
      }
      try {
        source.disconnect()
      } catch {
        // noop
      }
      try {
        analyser.disconnect()
      } catch {
        // noop
      }
      void audioContext.close().catch(() => undefined)
    }
  }
}

export async function createAudioLevelMonitor(
  stream: MediaStream,
  options: AudioLevelMonitorOptions = {}
): Promise<AudioLevelMonitorController> {
  const AudioContextCtor = getAudioContextCtor()
  if (!AudioContextCtor) {
    throw new Error("AudioContext indisponivel neste navegador.")
  }

  const audioContext = new AudioContextCtor()
  await audioContext.resume().catch(() => undefined)

  const analyser = audioContext.createAnalyser()
  analyser.fftSize = 1024
  analyser.smoothingTimeConstant = 0.78

  const source = audioContext.createMediaStreamSource(stream)
  source.connect(analyser)

  const data = new Uint8Array(analyser.fftSize)
  let frame = 0
  let stopped = false

  const tick = () => {
    if (stopped) {
      return
    }

    analyser.getByteTimeDomainData(data)
    let sum = 0
    for (let index = 0; index < data.length; index += 1) {
      const normalized = (data[index] - 128) / 128
      sum += normalized * normalized
    }

    const rms = Math.sqrt(sum / data.length)
    options.onLevel?.(Math.min(1, Math.max(0, rms * 4.8)))
    frame = window.requestAnimationFrame(tick)
  }

  frame = window.requestAnimationFrame(tick)

  return {
    stop: () => {
      stopped = true
      if (frame) {
        window.cancelAnimationFrame(frame)
      }
      try {
        source.disconnect()
      } catch {
        // noop
      }
      try {
        analyser.disconnect()
      } catch {
        // noop
      }
      void audioContext.close().catch(() => undefined)
    }
  }
}

export async function createWavAudioRecorder(
  stream: MediaStream,
  options: WavAudioRecorderOptions = {}
): Promise<WavAudioRecorderController> {
  const AudioContextCtor = getAudioContextCtor();
  if (!AudioContextCtor) {
    throw new Error("AudioContext indisponivel neste navegador.");
  }

  const audioContext = new AudioContextCtor();
  await audioContext.resume().catch(() => undefined);

  const source = audioContext.createMediaStreamSource(stream);
  const processor = audioContext.createScriptProcessor(4096, 1, 1);
  const silenceGain = audioContext.createGain();
  silenceGain.gain.value = 0;

  const chunks: Float32Array[] = [];
  const targetSampleRate = Math.max(8_000, Math.min(Number(options.targetSampleRate || 16_000) || 16_000, 48_000));
  const channelCount = Math.max(1, Math.min(Number(options.channelCount || 1) || 1, 1));
  let cleanedUp = false;
  let cancelled = false;

  processor.onaudioprocess = (event) => {
    if (cleanedUp || cancelled) {
      return;
    }

    const channel = event.inputBuffer.getChannelData(0);
    chunks.push(new Float32Array(channel));
  };

  source.connect(processor);
  processor.connect(silenceGain);
  silenceGain.connect(audioContext.destination);

  const cleanup = () => {
    if (cleanedUp) {
      return;
    }

    cleanedUp = true;
    processor.onaudioprocess = null;

    try {
      source.disconnect();
    } catch {
      // noop
    }

    try {
      processor.disconnect();
    } catch {
      // noop
    }

    try {
      silenceGain.disconnect();
    } catch {
      // noop
    }

    void audioContext.close().catch(() => undefined);
  };

  return {
    stop: async () => {
      cleanup();
      if (cancelled) {
        return null;
      }

      const merged = mergeFloatChunks(chunks);
      if (!merged.length) {
        return null;
      }

      const sampleRate = audioContext.sampleRate || targetSampleRate;
      const downsampled = downsamplePcm(merged, sampleRate, targetSampleRate);
      const durationMs = Math.round((downsampled.length / targetSampleRate) * 1000);
      if (!downsampled.length || durationMs < 120) {
        return null;
      }

      const wavBlob = encodeMonoWav(downsampled, targetSampleRate);
      const audioDataUrl = await blobToDataUrl(wavBlob);
      const audioBase64 = audioDataUrl.split(",")[1] || "";

      return {
        audioDataUrl,
        audioBase64,
        mimeType: "audio/wav",
        sampleRate: targetSampleRate,
        channels: channelCount,
        durationMs
      };
    },
    cancel: () => {
      cancelled = true;
      cleanup();
    }
  };
}
