import assert from "node:assert/strict"
import test from "node:test"

import {
  isFixtureCardPreferred,
  isFixtureQuestion,
  isSportsScheduleRelevant,
  shouldInjectGoogleLiveSearch
} from "../apps/api/src/liveResearchIntents.js"

test("live research intents do not treat capability question as sports", () => {
  const question = "Hoje voce consegue pesquisar Google ao vivo ou nao? E quais formatos voce le de forma nativa?"

  assert.equal(isFixtureQuestion(question, {}), false)
  assert.equal(isFixtureCardPreferred(question, { preferredResponseVariant: "fixture" }), false)
  assert.equal(isSportsScheduleRelevant(question, { preferredResponseVariant: "fixture" }), false)
  assert.equal(shouldInjectGoogleLiveSearch(question, {}, { googleSearchConfigured: true }), false)
})

test("live research intents do not treat time question as sports", () => {
  const question = "Qual o horario de agora, dia, mes e ano?"

  assert.equal(isFixtureQuestion(question, {}), false)
  assert.equal(isSportsScheduleRelevant(question, {}), false)
})

test("live research intents still detect real sports question", () => {
  const question = "Quando joga o Santos no Brasileirao?"

  assert.equal(isFixtureQuestion(question, {}), true)
  assert.equal(isFixtureCardPreferred(question, {}), true)
  assert.equal(isSportsScheduleRelevant(question, {}), true)
})
