import test from "node:test"
import assert from "node:assert/strict"

import {
  buildUnknownInformationResponseCore,
  postProcessAssistantResponseCore
} from "../apps/api/src/enterpriseResponseProcessingRuntime.js"

test("buildUnknownInformationResponseCore returns human-friendly fallback text", () => {
  const text = buildUnknownInformationResponseCore(
    "qual o placar agora?",
    {},
    { includeReason: true, offerRetry: true },
    {
      runtimeIsWeatherQuestion: () => false,
      runtimeIsFixtureQuestion: () => true
    }
  )

  assert.match(text, /Nao consegui responder a esta pergunta no momento/i)
  assert.match(text, /Tente novamente em alguns instantes/i)
  assert.doesNotMatch(text, /PERGUNTE DENOVO/i)
})

test("postProcessAssistantResponseCore blocks internal context leak for greeting", () => {
  const output = postProcessAssistantResponseCore(
    "oiii",
    "Com o contexto que eu tenho agora, o ponto principal e este: Topicos recentes...",
    {},
    {
      detectGreetingSignals: () => ({ isGreetingOnly: true, hasGreeting: true, hasWellBeing: false }),
      buildGreetingResponse: () => "Ola! Tudo bem com voce?",
      shouldKeepIdentityPreamble: () => false,
      buildGospelCoreFallback: () => null,
      resolveDeterministicUploadResponseRuntime: () => null,
      deterministicUploadResponseDeps: {},
      resolveDeterministicBibleGuidanceResponse: () => null,
      isPromptCardPreferred: () => false,
      buildPromptCardResponse: () => null,
      resolveDeterministicWeatherResponse: () => null,
      runtimeIsWeatherCardPreferred: () => false,
      runtimeBuildWeatherCardResponse: () => null,
      runtimeBuildWeatherIntentFallback: () => "",
      resolveDeterministicFixtureResponse: () => null,
      isInterpretiveBibleQuestion: () => false,
      refineBibleInterpretiveResponse: (_q, text) => text,
      buildGreetingLead: () => "Ola"
    }
  )

  assert.equal(output, "Ola! Tudo bem com voce?")
})

test("postProcessAssistantResponseCore blocks internal context leak for normal question", () => {
  const output = postProcessAssistantResponseCore(
    "me ajuda com isso",
    "Com o contexto que eu tenho agora, o ponto principal e este: Topicos recentes...",
    {},
    {
      detectGreetingSignals: () => ({ isGreetingOnly: false, hasGreeting: false, hasWellBeing: false }),
      buildGreetingResponse: () => "",
      shouldKeepIdentityPreamble: () => false,
      buildGospelCoreFallback: () => null,
      resolveDeterministicUploadResponseRuntime: () => null,
      deterministicUploadResponseDeps: {},
      resolveDeterministicBibleGuidanceResponse: () => null,
      isPromptCardPreferred: () => false,
      buildPromptCardResponse: () => null,
      resolveDeterministicWeatherResponse: () => null,
      runtimeIsWeatherCardPreferred: () => false,
      runtimeBuildWeatherCardResponse: () => null,
      runtimeBuildWeatherIntentFallback: () => "",
      resolveDeterministicFixtureResponse: () => null,
      isInterpretiveBibleQuestion: () => false,
      refineBibleInterpretiveResponse: (_q, text) => text,
      buildGreetingLead: () => "Ola"
    }
  )

  assert.equal(output, "Nao consegui processar sua pergunta neste momento. Tente novamente em alguns instantes.")
  assert.doesNotMatch(output, /Com o contexto que eu tenho agora/i)
})

test("postProcessAssistantResponseCore blocks leaked prompt scaffolding", () => {
  const output = postProcessAssistantResponseCore(
    "me explica IA",
    "[ System Prompt ]\nnao mostrar\n\n[ Memoria relevante ]\nsegredo interno\n\n[ Pergunta do usuario ]\nme explica IA",
    {},
    {
      detectGreetingSignals: () => ({ isGreetingOnly: false, hasGreeting: false, hasWellBeing: false }),
      buildGreetingResponse: () => "",
      shouldKeepIdentityPreamble: () => false,
      buildGospelCoreFallback: () => null,
      resolveDeterministicUploadResponseRuntime: () => null,
      deterministicUploadResponseDeps: {},
      resolveDeterministicBibleGuidanceResponse: () => null,
      isPromptCardPreferred: () => false,
      buildPromptCardResponse: () => null,
      resolveDeterministicWeatherResponse: () => null,
      runtimeIsWeatherCardPreferred: () => false,
      runtimeBuildWeatherCardResponse: () => null,
      runtimeBuildWeatherIntentFallback: () => "",
      resolveDeterministicFixtureResponse: () => null,
      isInterpretiveBibleQuestion: () => false,
      refineBibleInterpretiveResponse: (_q, text) => text,
      buildGreetingLead: () => "Ola"
    }
  )

  assert.equal(output, "Nao consegui processar sua pergunta neste momento. Tente novamente em alguns instantes.")
  assert.doesNotMatch(output, /\[ System Prompt \]/i)
  assert.doesNotMatch(output, /\[ Memoria relevante \]/i)
})

test("postProcessAssistantResponseCore blocks operational provider dump", () => {
  const output = postProcessAssistantResponseCore(
    "me responde isso",
    "Estou em modo de contingencia operacional no momento.\n\nPergunta recebida: \"me responde isso\"\n\nEstado dos providers: Groq degradado.",
    {},
    {
      detectGreetingSignals: () => ({ isGreetingOnly: false, hasGreeting: false, hasWellBeing: false }),
      buildGreetingResponse: () => "",
      shouldKeepIdentityPreamble: () => false,
      buildGospelCoreFallback: () => null,
      resolveDeterministicUploadResponseRuntime: () => null,
      deterministicUploadResponseDeps: {},
      resolveDeterministicBibleGuidanceResponse: () => null,
      isPromptCardPreferred: () => false,
      buildPromptCardResponse: () => null,
      resolveDeterministicWeatherResponse: () => null,
      runtimeIsWeatherCardPreferred: () => false,
      runtimeBuildWeatherCardResponse: () => null,
      runtimeBuildWeatherIntentFallback: () => "",
      resolveDeterministicFixtureResponse: () => null,
      isInterpretiveBibleQuestion: () => false,
      refineBibleInterpretiveResponse: (_q, text) => text,
      buildGreetingLead: () => "Ola"
    }
  )

  assert.equal(output, "Nao consegui processar sua pergunta neste momento. Tente novamente em alguns instantes.")
  assert.doesNotMatch(output, /Pergunta recebida/i)
  assert.doesNotMatch(output, /Estado dos providers/i)
})

test("postProcessAssistantResponseCore passes question and context to prompt card recovery", () => {
  let capturedQuestion = ""
  let capturedContext = null

  const output = postProcessAssistantResponseCore(
    "Ainda sem arquivo, me de um prompt curto para outro analista tocar esse onboarding.",
    "Nao consegui responder a esta pergunta no momento. Tente novamente em alguns instantes.",
    {
      preferredResponseCard: "prompt",
      conversationHistory: [
        {
          role: "user",
          content: "Agora gere um documento docx com um plano de onboarding de clientes em 5 pontos."
        }
      ]
    },
    {
      detectGreetingSignals: () => ({ isGreetingOnly: false, hasGreeting: false, hasWellBeing: false }),
      buildGreetingResponse: () => "",
      shouldKeepIdentityPreamble: () => false,
      buildGospelCoreFallback: () => null,
      resolveDeterministicUploadResponseRuntime: () => null,
      deterministicUploadResponseDeps: {},
      resolveDeterministicBibleGuidanceResponse: () => null,
      isPromptCardPreferred: () => true,
      buildPromptCardResponse: (_text, question, context) => {
        capturedQuestion = String(question || "")
        capturedContext = context
        return JSON.stringify({ type: "prompt", content: "Atue como analista de onboarding de clientes." })
      },
      isTableCardPreferred: () => false,
      buildTableCardResponse: () => null,
      resolveDeterministicWeatherResponse: () => null,
      runtimeIsWeatherCardPreferred: () => false,
      runtimeBuildWeatherCardResponse: () => null,
      runtimeBuildWeatherIntentFallback: () => "",
      resolveDeterministicFixtureResponse: () => null,
      isInterpretiveBibleQuestion: () => false,
      refineBibleInterpretiveResponse: (_q, text) => text,
      buildGreetingLead: () => "Ola"
    }
  )

  assert.match(output, /"type":"prompt"/i)
  assert.match(capturedQuestion, /outro analista tocar esse onboarding/i)
  assert.equal(capturedContext?.preferredResponseCard, "prompt")
})

test("postProcessAssistantResponseCore passes question and context to table card recovery", () => {
  let capturedQuestion = ""
  let capturedContext = null

  const output = postProcessAssistantResponseCore(
    "Monte uma tabela simples comparando culpa e seguranca em Romanos 8.",
    "Romanos 8 fala sobre vida no Espirito e amor de Deus.",
    {
      preferredResponseCard: "table",
      biblePassage: {
        content: "Romanos 8"
      }
    },
    {
      detectGreetingSignals: () => ({ isGreetingOnly: false, hasGreeting: false, hasWellBeing: false }),
      buildGreetingResponse: () => "",
      shouldKeepIdentityPreamble: () => false,
      buildGospelCoreFallback: () => null,
      resolveDeterministicUploadResponseRuntime: () => null,
      deterministicUploadResponseDeps: {},
      resolveDeterministicBibleGuidanceResponse: () => null,
      isPromptCardPreferred: () => false,
      buildPromptCardResponse: () => null,
      isTableCardPreferred: () => true,
      buildTableCardResponse: (_text, question, context) => {
        capturedQuestion = String(question || "")
        capturedContext = context
        return JSON.stringify({
          type: "table",
          content: {
            columns: ["Aspecto", "culpa", "seguranca"],
            rows: [["Leitura central", "x", "y"]]
          }
        })
      },
      resolveDeterministicWeatherResponse: () => null,
      runtimeIsWeatherCardPreferred: () => false,
      runtimeBuildWeatherCardResponse: () => null,
      runtimeBuildWeatherIntentFallback: () => "",
      resolveDeterministicFixtureResponse: () => null,
      isInterpretiveBibleQuestion: () => true,
      refineBibleInterpretiveResponse: (_q, text) => text,
      buildGreetingLead: () => "Ola"
    }
  )

  assert.match(output, /"type":"table"/i)
  assert.match(capturedQuestion, /culpa e seguranca em Romanos 8/i)
  assert.equal(capturedContext?.preferredResponseCard, "table")
})
