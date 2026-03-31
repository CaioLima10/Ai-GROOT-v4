import test from "node:test"
import assert from "node:assert/strict"
import {
  buildGreetingLead,
  buildGreetingResponse,
  detectGreetingSignals,
  normalizeForIntent
} from "../core/greetingBehavior.js"

test("normalizeForIntent removes accents and lowercases", () => {
  const normalized = normalizeForIntent("Olá, VOCÊ está bem?")
  assert.equal(normalized, "ola, voce esta bem?")
})

test("detectGreetingSignals identifies greeting-only input", () => {
  const result = detectGreetingSignals("Bom dia! Tudo bem?")
  assert.equal(result.hasGreeting, true)
  assert.equal(result.hasWellBeing, true)
  assert.equal(result.isGreetingOnly, true)
})

test("detectGreetingSignals accepts informal elongated greeting", () => {
  const result = detectGreetingSignals("oiii")
  assert.equal(result.hasGreeting, true)
  assert.equal(result.isGreetingOnly, true)
})

test("detectGreetingSignals does not short-circuit mixed requests", () => {
  const result = detectGreetingSignals("Bom dia, me explique Romanos 8")
  assert.equal(result.hasGreeting, true)
  assert.equal(result.isGreetingOnly, false)
})

test("buildGreetingResponse personalizes with user name and christian tone", () => {
  const response = buildGreetingResponse("Oi, como voce esta?", { userName: "Ana Maria" })
  assert.match(response, /Ana Maria/i)
  assert.match(response, /gracas a Deus/i)
})

test("buildGreetingResponse uses night blessing for good night", () => {
  const response = buildGreetingResponse("Boa noite", {})
  assert.match(response, /Boa noite/i)
  assert.match(response, /noite abencoada/i)
})

test("buildGreetingLead adapts opening and keeps first two name tokens", () => {
  const lead = buildGreetingLead("Boa tarde", { fullName: "Carlos Henrique Souza Lima" })
  assert.match(lead, /^Boa tarde, Carlos Henrique!/)
})
