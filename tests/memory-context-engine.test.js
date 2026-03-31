import assert from "node:assert/strict"
import test from "node:test"

import { buildRuntimeContext } from "../backend/src/application/context/buildRuntimeContext.js"

function makeTurn(role, content, createdAt) {
  return { role, content, created_at: createdAt }
}

test("memory context engine ranks, deduplicates and enforces limits", async () => {
  const stmTurns = [
    makeTurn("user", "Meu nome e Gabe e trabalho com Node.js e TypeScript.", "2026-03-30T10:00:00.000Z"),
    makeTurn("assistant", "Entendido, Gabe. Vamos otimizar seu backend.", "2026-03-30T10:01:00.000Z"),
    makeTurn("user", "Preciso reduzir latencia do endpoint ask com memoria relevante.", "2026-03-30T10:02:00.000Z")
  ]

  const retrievalTurns = [
    makeTurn("user", "Preciso reduzir latencia do endpoint ask com memoria relevante.", "2026-03-30T10:02:00.000Z"),
    makeTurn("assistant", "Vamos usar ranking por relevancia, recencia e importancia.", "2026-03-30T10:03:00.000Z"),
    makeTurn("user", "Ontem comi pizza e fui ao cinema.", "2026-03-20T10:03:00.000Z")
  ]

  const history = [
    {
      user: "Quero contexto enxuto e rapido para o ask",
      ai: "Foco em sinais de memoria util e corte de ruido",
      timestamp: "2026-03-29T18:00:00.000Z"
    }
  ]

  const retrievalPort = {
    async retrieveRelevant() {
      return {
        contextSummary: "Topicos recentes: latencia, ask, memoria",
        summary: "Usuario pediu resposta objetiva e tecnica",
        knownFactsText: "Nome: Gabe | Area: backend",
        conversationTurns: retrievalTurns,
        history,
        userProfile: { style: "technical" },
        diagnostics: {
          cacheHit: false,
          source: "mock_retrieval",
          connectorFetchMs: 4,
          retrievalMs: 5
        }
      }
    }
  }

  const runtimeContextPort = {
    async enrich(question, context) {
      return {
        ...context,
        instructions: `Q: ${question}`
      }
    }
  }

  const result = await buildRuntimeContext({
    preparedPayload: {
      normalizedQuestion: "Como reduzir latencia e custo de contexto no ask?",
      preparedQuestion: "Como reduzir latencia e custo de contexto no ask?",
      context: {
        activeModules: ["backend"],
        bibleStudyModules: []
      },
      enrichedData: {
        request: {
          userId: "u_gabe",
          sessionId: "s_prod",
          requestId: "req_test",
          timestamp: "2026-03-30T10:05:00.000Z"
        }
      }
    },
    decisionResult: {
      intent: "technical_optimization"
    },
    ports: {
      stm: {
        getRecentTurns() {
          return stmTurns
        },
        appendTurn() { }
      },
      retrieval: retrievalPort,
      runtimeContext: runtimeContextPort
    },
    limits: {
      maxConversationTurns: 6,
      maxMemorySummaryChars: 240,
      maxContextTokens: 380,
      maxRetrievedItems: 10
    }
  })

  const diagnostics = result.diagnostics
  const memory = result.preparedPayload.enrichedData.memory

  assert.ok(diagnostics.candidateCount >= diagnostics.dedupedCount)
  assert.ok(diagnostics.dedupedCount >= diagnostics.selectedTurns)
  assert.ok(diagnostics.selectedTurns <= 6)

  assert.equal(typeof diagnostics.timings.retrievalMs, "number")
  assert.equal(typeof diagnostics.timings.enrichMs, "number")
  assert.equal(typeof diagnostics.timings.totalMs, "number")

  assert.ok(Array.isArray(diagnostics.topScores))
  assert.ok(diagnostics.topScores.length > 0)

  assert.ok(memory.contextTokens <= 420)
  assert.equal(typeof diagnostics.selectedSourceCounts, "object")
  assert.ok(Object.keys(diagnostics.selectedSourceCounts).length > 0)

  assert.equal(typeof diagnostics.semantic, "object")
  assert.equal(typeof diagnostics.semantic.retrievalAccuracyProxy, "number")
})
