import test from "node:test"
import assert from "node:assert/strict"
import { createEnterpriseVoiceRuntime } from "../apps/api/src/enterpriseVoiceRuntime.js"

test("voice runtime creates sessions and stores normalized events", () => {
  const runtime = createEnterpriseVoiceRuntime({
    maxSessions: 10,
    maxEventsPerSession: 10
  })

  const session = runtime.createSession({
    userId: "tester",
    locale: "pt-BR",
    metadata: {
      surface: "test"
    }
  })

  assert.ok(session.sessionId)
  assert.equal(session.userId, "tester")
  assert.equal(session.locale, "pt-BR")

  const partial = runtime.appendEvent(session.sessionId, {
    type: "transcription.partial",
    direction: "input",
    final: false,
    text: "ola giom",
    payload: {
      source: "browser_microphone"
    }
  })

  assert.equal(partial.type, "transcription.partial")
  assert.equal(partial.final, false)
  assert.equal(partial.text, "ola giom")

  const finalEvent = runtime.appendEvent(session.sessionId, {
    type: "transcription.final",
    direction: "input",
    final: true,
    text: "ola giom tudo bem",
    payload: {
      source: "browser_microphone"
    }
  })

  assert.equal(finalEvent.final, true)
  assert.equal(runtime.getEvents(session.sessionId).length, 2)
  assert.equal(runtime.getSummary().totalEvents, 2)

  const touched = runtime.touchSession(session.sessionId)
  assert.equal(touched.sessionId, session.sessionId)

  const closed = runtime.closeSession(session.sessionId, "test_complete")
  assert.equal(closed.status, "closed")
  assert.ok(runtime.getEvents(session.sessionId).some((event) => event.type === "session.closed"))
})
