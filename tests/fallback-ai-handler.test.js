import test from "node:test"
import assert from "node:assert/strict"

import { fallbackAIHandler } from "../backend/src/application/ask/handlers/fallbackAIHandler.js"

function createBaseInput(overrides = {}) {
  return {
    routeQuestion: "me explique esse erro",
    modelQuestion: "me explique esse erro",
    payload: {
      context: {
        channel: "test"
      }
    },
    ports: {
      aiProvider: {
        ask: async () => ({ response: "ok" })
      },
      response: {
        normalize: (answer) => String(answer?.response || answer?.answer || "").trim(),
        postProcess: (_question, responseText) => responseText,
        contingency: (_question, _context, reason) => `fallback: ${reason}`
      }
    },
    ...overrides
  }
}

test("fallbackAIHandler retries once when provider returns empty response then succeeds", async () => {
  let calls = 0
  const input = createBaseInput({
    ports: {
      aiProvider: {
        ask: async () => {
          calls += 1
          return calls === 1 ? { response: "" } : { response: "Resposta final valida" }
        }
      },
      response: {
        normalize: (answer) => String(answer?.response || "").trim(),
        postProcess: (_question, responseText) => responseText,
        contingency: (_question, _context, reason) => `fallback: ${reason}`
      }
    }
  })

  const result = await fallbackAIHandler(input)

  assert.equal(calls, 2)
  assert.equal(result.routeType, "ai")
  assert.equal(result.responseText, "Resposta final valida")
  assert.equal(result.diagnostics.attemptsUsed, 2)
})

test("fallbackAIHandler retries once when post process sanitizes first answer into generic fallback", async () => {
  let calls = 0
  const input = createBaseInput({
    ports: {
      aiProvider: {
        ask: async () => {
          calls += 1
          return calls === 1
            ? { response: "resposta do provider 1" }
            : { response: "Resposta final valida" }
        }
      },
      response: {
        normalize: (answer) => String(answer?.response || "").trim(),
        postProcess: (_question, responseText) => {
          if (responseText === "resposta do provider 1") {
            return "Nao consegui processar sua pergunta neste momento. Tente novamente em alguns instantes."
          }
          return responseText
        },
        contingency: (_question, _context, reason) => `fallback: ${reason}`
      }
    }
  })

  const result = await fallbackAIHandler(input)

  assert.equal(calls, 2)
  assert.equal(result.routeType, "ai")
  assert.equal(result.responseText, "Resposta final valida")
  assert.equal(result.diagnostics.attemptsUsed, 2)
})