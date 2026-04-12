# GIOM Voice And AI Roadmap

## Objective

Evolve GIOM from chat plus helper features into a stronger multimodal assistant with:

- continuous voice conversation
- microphone capture with automatic turn-taking
- named voice personas: GIOM and DIANA
- richer on-screen voice UX
- stronger memory, tools, evals, and runtime quality

## Current Baseline

Already available in the stack:

- realtime voice sessions
- browser microphone capture and browser speech synthesis
- server-side transcription and speech capability flags
- long memory runtime and profile/session summary infrastructure
- tool registry, trace store, async jobs, and capability matrix

## Phase 1 - Voice Foundation

Status: in progress

Delivered in this cycle:

- frontend voice preference persistence
- explicit voice personas for GIOM and DIANA
- distinct persona tuning for GIOM and DIANA plus preview of the selected voice
- centered voice conversation overlay with richer cinematic orb, layered motion, and live status card
- continuous voice conversation loop: listen -> think -> speak -> listen again
- barge-in support so user speech can interrupt playback and return to listening
- explicit pause, resume, and mute controls inside the live voice overlay
- reactive visualizer driven by live microphone level and server-audio playback level when available
- server-side voice persona mapping for GIOM and DIANA when the local TTS runtime is configured
- local frontend proxy correction to the real backend port

Still to validate live in browser:

- end-to-end microphone permission flow on desktop and mobile
- browser voice mapping quality for GIOM and DIANA on Windows voices
- stop/close behavior during listening, processing, and speaking

## Phase 2 - Voice Product Quality

Status: in progress

Delivered in this cycle:

- in-overlay runtime badges for microphone, voice engine, and session readiness
- recovery card with quick retry and direct access to voice settings from the live overlay

Target outcomes:

- voice-specific onboarding and permission recovery UX
- fallbacks per browser/device when speech synthesis voices are missing
- deeper server-side named TTS quality with dedicated GIOM and DIANA speaker assets

## Phase 3 - GIOM As A Stronger AI Assistant

Target outcomes:

- better model routing by task type, latency, and cost
- stronger retrieval and ranking for memory and knowledge
- grounded live research with web results and source honesty
- eval packs covering voice, ask, tools, memory, and multimodal regressions
- production observability with SLOs, provider error budgets, and rollback paths
- user profile memory with explicit controls over what is stored or forgotten

## Phase 4 - Product Parity Direction

Capabilities needed to approach assistants like ChatGPT or Gemini:

- continuous multimodal turn management
- high-confidence tool use with schema validation and retries
- fast memory recall plus compacted long context
- live research and verification with source ranking
- voice interaction that feels native, not bolted on
- evaluation gates before release, not only after bugs appear

## Next Execution Steps

1. Validate the full voice recovery flow in the browser with real permission denial and reconnect scenarios.
2. Validate the new cinematic overlay and barge-in flow in the browser with real microphone and speakers.
3. Tune dedicated GIOM and DIANA Piper speaker assets in the local TTS runtime.
4. Add voice regression tests and a lightweight UX battery for the overlay.
5. Add browser validation and tuning for amplitude thresholds so the visualizer feels stable across devices.
