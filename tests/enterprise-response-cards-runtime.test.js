import assert from "node:assert/strict"
import test from "node:test"

import {
  buildFixtureIntentFallback,
  buildPromptCardResponse,
  buildTableCardResponse
} from "../apps/api/src/enterpriseResponseCardsRuntime.js"

test("prompt card response strips decorative labels and fallback noise", () => {
  const response = buildPromptCardResponse([
    "PROMPT PRONTO (COPIA E COLA)",
    "Escrita",
    "Voce e um analista de onboarding de clientes.",
    "",
    "Nao consegui responder a esta pergunta no momento. Tente novamente em alguns instantes."
  ].join("\n"))

  assert.ok(response)
  const parsed = JSON.parse(String(response))
  assert.equal(parsed.type, "prompt")
  assert.match(String(parsed.content || ""), /analista de onboarding/i)
  assert.doesNotMatch(String(parsed.content || ""), /PROMPT PRONTO|Escrita/i)
  assert.doesNotMatch(String(parsed.content || ""), /Nao consegui responder/i)
})

test("prompt card response recovers a deterministic onboarding prompt from a generic fallback", () => {
  const response = buildPromptCardResponse(
    "Nao consegui responder a esta pergunta no momento. Tente novamente em alguns instantes.",
    "Ainda sem arquivo, me de um prompt curto para outro analista tocar esse onboarding.",
    {
      conversationHistory: [
        {
          role: "user",
          content: "Agora gere um documento docx com um plano de onboarding de clientes em 5 pontos."
        }
      ]
    }
  )

  assert.ok(response)
  const parsed = JSON.parse(String(response))
  assert.equal(parsed.type, "prompt")
  assert.match(String(parsed.content || ""), /analista de onboarding de clientes/i)
  assert.match(String(parsed.content || ""), /bloqueios|marco de valor|follow-up|prioridade/i)
})

test("prompt card response replaces raw bible prose with a study prompt fallback", () => {
  const response = buildPromptCardResponse(
    "Romanos 8 mostra que nao ha condenacao para os que estao em Cristo Jesus e que nada nos separa do amor de Deus.",
    "Faca um prompt curto para estudar Romanos 8 por 7 dias.",
    {}
  )

  assert.ok(response)
  const parsed = JSON.parse(String(response))
  assert.equal(parsed.type, "prompt")
  assert.match(String(parsed.content || ""), /mentor biblico|estudo devocional/i)
  assert.match(String(parsed.content || ""), /7 dias|Romanos 8|tema central/i)
  assert.doesNotMatch(String(parsed.content || ""), /nada nos separa/i)
})

test("fixture fallback keeps the sports subject in the note", () => {
  const response = buildFixtureIntentFallback("E qual horario dessa partida?", {
    liveFixture: {
      error: "SPORTS_SCHEDULE_FAILED",
      teamName: "Santos"
    }
  })

  const parsed = JSON.parse(String(response))
  assert.match(String(parsed?.content?.note || ""), /de Santos/i)
})

test("fixture fallback recovers the sports subject from conversation history", () => {
  const response = buildFixtureIntentFallback("E qual horario dessa partida?", {
    conversationHistory: [
      {
        role: "user",
        content: "Quando joga o Santos?"
      },
      {
        role: "assistant",
        content: "Posso verificar a agenda do Santos."
      }
    ]
  })

  const parsed = JSON.parse(String(response))
  assert.equal(parsed?.content?.teamName, "Santos")
  assert.match(String(parsed?.content?.note || ""), /de Santos/i)
})

test("table card response builds a structured comparison for Romanos 8", () => {
  const response = buildTableCardResponse(
    "Romanos 8 mostra contraste entre condenacao e seguranca.",
    "Monte uma tabela simples comparando culpa e seguranca em Romanos 8.",
    {
      preferredResponseCard: "table"
    }
  )

  assert.ok(response)
  const parsed = JSON.parse(String(response))
  assert.equal(parsed.type, "table")
  assert.deepEqual(parsed.content.columns, ["Aspecto", "culpa", "seguranca"])
  assert.equal(parsed.content.rows.length, 4)
  assert.match(String(parsed.content.rows[2][1] || ""), /Romanos 8/i)
})
