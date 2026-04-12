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

test("memory context engine prioritizes request conversation history for immediate continuity", async () => {
  let retrievalArgs = null

  const requestConversationHistory = [
    {
      role: "user",
      content: "Meu nome e Gabriel e estamos estudando o Livro de Genesis. Responda apenas: entendido."
    },
    {
      role: "assistant",
      content: "Entendido."
    }
  ]

  const result = await buildRuntimeContext({
    preparedPayload: {
      normalizedQuestion: "Qual e meu nome e qual livro estamos estudando agora?",
      preparedQuestion: "Qual e meu nome e qual livro estamos estudando agora?",
      context: {
        conversationHistory: requestConversationHistory,
        activeModules: [],
        bibleStudyModules: []
      },
      enrichedData: {
        request: {
          userId: "u_gabriel",
          sessionId: "s_genesis",
          requestId: "req_continuity",
          timestamp: "2026-04-02T09:00:00.000Z"
        }
      }
    },
    decisionResult: {
      intent: "fallback_ai"
    },
    ports: {
      stm: {
        getRecentTurns() {
          return []
        },
        appendTurn() { }
      },
      retrieval: {
        async retrieveRelevant(args) {
          retrievalArgs = args
          return {
            contextSummary: "Topicos recentes: clima, futebol",
            summary: "Historico distante do usuario",
            knownFactsText: "Nome: Gabriel | Objetivo atual: Livro de Genesis",
            conversationTurns: [
              makeTurn("user", "clima em sao paulo", "2026-04-01T10:00:00.000Z"),
              makeTurn("assistant", "Hoje esta ensolarado em Sao Paulo.", "2026-04-01T10:01:00.000Z")
            ],
            history: [],
            userProfile: { style: "natural" },
            diagnostics: {
              cacheHit: false,
              source: "mock_retrieval",
              connectorFetchMs: 3,
              retrievalMs: 4
            }
          }
        }
      },
      runtimeContext: {
        async enrich(_question, context) {
          return context
        }
      }
    },
    limits: {
      maxConversationTurns: 6,
      maxMemorySummaryChars: 240,
      maxContextTokens: 360,
      maxRetrievedItems: 10
    }
  })

  assert.ok(Array.isArray(retrievalArgs?.conversationHistory))
  assert.ok(retrievalArgs.conversationHistory.some((turn) => /gabriel/i.test(turn.content)))
  assert.ok(retrievalArgs.conversationHistory.some((turn) => /genesis/i.test(turn.content)))

  assert.equal(result.diagnostics.requestConversationTurns, 2)
  assert.ok((result.diagnostics.selectedSourceCounts.request_history || 0) >= 1)
  assert.ok(result.preparedPayload.context.conversationHistory.some((turn) => /gabriel/i.test(turn.content)))
  assert.ok(result.preparedPayload.context.conversationHistory.some((turn) => /genesis/i.test(turn.content)))
  assert.ok(result.preparedPayload.context.conversationHistory.every((turn) => !/clima em sao paulo|ensolarado/i.test(turn.content)))
  assert.match(String(result.preparedPayload.context.memorySummary || ""), /Gabriel|Genesis/i)
  assert.doesNotMatch(String(result.preparedPayload.context.memorySummary || ""), /clima|futebol|historico distante/i)
})

test("memory context engine keeps new-thread conversation history local even when retrieval finds older chats", async () => {
  const result = await buildRuntimeContext({
    preparedPayload: {
      normalizedQuestion: "Explique JWT sem jargao para produto.",
      preparedQuestion: "Explique JWT sem jargao para produto.",
      context: {
        activeModules: [],
        bibleStudyModules: []
      },
      enrichedData: {
        request: {
          userId: "u_jwt",
          sessionId: "s_new_thread",
          requestId: "req_new_thread",
          timestamp: "2026-04-03T02:30:00.000Z"
        }
      }
    },
    decisionResult: {
      intent: "fallback_ai"
    },
    ports: {
      stm: {
        getRecentTurns() {
          return []
        },
        appendTurn() { }
      },
      retrieval: {
        async retrieveRelevant() {
          return {
            contextSummary: "Topicos antigos: Romanos 8 e onboarding de clientes",
            summary: "Historico distante com threads diferentes",
            knownFactsText: "Nome: Marina",
            conversationTurns: [
              makeTurn("user", "Meu nome e Marina e estamos tratando de onboarding de clientes.", "2026-04-02T10:00:00.000Z"),
              makeTurn("assistant", "Entendido, Marina.", "2026-04-02T10:01:00.000Z")
            ],
            history: [
              {
                user: "Agora estamos estudando Romanos 8.",
                ai: "Ok.",
                timestamp: "2026-04-02T11:00:00.000Z"
              }
            ],
            userProfile: { name: "Marina" },
            diagnostics: {
              cacheHit: false,
              source: "mock_retrieval",
              connectorFetchMs: 3,
              retrievalMs: 4
            }
          }
        }
      },
      runtimeContext: {
        async enrich(_question, context) {
          return context
        }
      }
    },
    limits: {
      maxConversationTurns: 6,
      maxMemorySummaryChars: 240,
      maxContextTokens: 360,
      maxRetrievedItems: 10
    }
  })

  assert.deepEqual(result.preparedPayload.context.conversationHistory, [])
  assert.equal(result.diagnostics.requestConversationTurns, 0)
  assert.equal(result.diagnostics.stmTurns, 0)
  assert.match(String(result.preparedPayload.context.memorySummary || ""), /Marina/i)
  assert.doesNotMatch(String(result.preparedPayload.context.memorySummary || ""), /Romanos|onboarding|Historico distante/i)
})
