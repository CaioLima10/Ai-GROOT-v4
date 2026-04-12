import assert from "node:assert/strict"

import { buildAssistantPrompt } from "../packages/ai-core/src/promptBuilder.js"
import {
  evaluateConversationTurn,
  runConversationBenchmark,
  summarizeConversationEvaluation
} from "../packages/ai-core/src/conversationEvaluator.js"

function testBuildAssistantPromptShape() {
  const promptPackage = buildAssistantPrompt({
    task: "Explique Joao 15 com clareza e aplicacao pastoral.",
    context: {
      assistantProfile: "pastoral_companion",
      activeModules: ["bible"],
      promptPacks: ["chatgpt_reasoning"],
      preferredBibleCode: "NAA",
      ministryFocus: "new_believers"
    },
    memoryContext: {
      knownFacts: {
        name: "Gabriel"
      }
    }
  })

  assert.equal(typeof promptPackage.requestedProfileId, "string")
  assert.equal(typeof promptPackage.profileId, "string")
  assert.equal(typeof promptPackage.systemPrompt, "string")
  assert.ok(promptPackage.systemPrompt.includes("GIOM"))
  assert.ok(Array.isArray(promptPackage.activeModules))
  assert.ok(promptPackage.activeModules.includes("bible"))
  assert.equal(typeof promptPackage.domainSubmodules, "object")
}

function testBuildAssistantPromptContinuityInstructions() {
  const promptPackage = buildAssistantPrompt({
    task: "Continue nesse assunto e aprofunde o ponto principal.",
    context: {
      activeModules: ["bible"]
    },
    memoryContext: {
      knownFacts: {
        name: "Gabriel",
        currentGoal: "Livro de Genesis"
      },
      conversationState: {
        mode: "follow_up",
        resolvedFocus: "Livro de Genesis",
        summary: "Estado conversacional: continuidade real | Foco resolvido: Livro de Genesis"
      }
    }
  })

  assert.match(promptPackage.systemPrompt, /CONTINUIDADE CONVERSACIONAL:/)
  assert.match(promptPackage.systemPrompt, /Foco resolvido para este turno: Livro de Genesis\./)
  assert.match(promptPackage.systemPrompt, /Resolva referencias implicitas/i)
  assert.match(promptPackage.systemPrompt, /Se o usuario mudar claramente de assunto/i)
}

function testConversationEvaluationShape() {
  const evaluation = evaluateConversationTurn({
    userMessage: "Voce consegue pesquisar Google ao vivo agora?",
    aiResponse: "Hoje eu opero sem pesquisa web ao vivo. Posso usar memoria conversacional, base curada e RAG nesta execucao.",
    researchCapabilities: {
      mode: "offline"
    },
    tags: ["transparency", "self_model"]
  })

  assert.equal(typeof evaluation.score, "number")
  assert.equal(typeof evaluation.status, "string")
  assert.ok(Array.isArray(evaluation.issues))
  assert.ok(Array.isArray(evaluation.dimensions))
  assert.ok(evaluation.dimensions.some((dimension) => dimension.id === "transparency"))
  assert.equal(typeof evaluation.details.memory.score, "number")
  assert.ok(Array.isArray(evaluation.details.transparency.notes))
}

function testConversationSummaryShape() {
  const evaluation = evaluateConversationTurn({
    userMessage: "Responda apenas: Memoria registrada.",
    aiResponse: "Memoria registrada.",
    history: [],
    tags: ["memory"]
  })

  const summary = summarizeConversationEvaluation([
    {
      scenarioId: "memory_check",
      scenarioLabel: "Memory check",
      question: "Responda apenas: Memoria registrada.",
      answer: "Memoria registrada.",
      context: {},
      evaluation,
      metadata: {}
    }
  ])

  assert.equal(typeof summary.score, "number")
  assert.equal(typeof summary.status, "string")
  assert.ok(Array.isArray(summary.dimensions))
  assert.ok(Array.isArray(summary.strengths))
  assert.ok(Array.isArray(summary.risks))
}

async function testBenchmarkShape() {
  const benchmark = await runConversationBenchmark({
    packId: "core_diagnostics",
    researchCapabilities: {
      mode: "offline"
    },
    requestTurn: async ({ turn }) => ({
      answer: `Resposta operacional de teste para: ${turn.question}`,
      requestId: "benchmark_contract_test"
    })
  })

  assert.equal(benchmark.pack.id, "core_diagnostics")
  assert.equal(typeof benchmark.summary.score, "number")
  assert.ok(Array.isArray(benchmark.turns))
  assert.ok(benchmark.turns.length > 0)
  assert.ok(benchmark.turns.every((turn) => typeof turn.answer === "string"))
}

await (async () => {
  testBuildAssistantPromptShape()
  testBuildAssistantPromptContinuityInstructions()
  testConversationEvaluationShape()
  testConversationSummaryShape()
  await testBenchmarkShape()
  console.log("ai-core-contracts tests passed")
})()
