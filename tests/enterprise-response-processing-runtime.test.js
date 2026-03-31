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
