import test from "node:test"
import assert from "node:assert/strict"

import {
  isFixtureCardPreferred,
  isFixtureQuestion,
  isSportsScheduleRelevant,
  shouldInjectGoogleLiveSearch
} from "../apps/api/src/liveResearchIntents.js"

test("sports and search intent helpers stay predictable", () => {
  assert.equal(isFixtureQuestion("quando joga o Flamengo?"), true)
  assert.equal(isFixtureQuestion("clima do Flamengo hoje"), false)
  assert.equal(isFixtureCardPreferred("qual o proximo jogo do Bahia?", { preferredResponseVariant: "fixture" }), true)
  assert.equal(isSportsScheduleRelevant("proximo jogo da selecao brasileira", {}), true)
  assert.equal(shouldInjectGoogleLiveSearch("ultimas noticias do agro hoje", {}, { googleSearchConfigured: true }), true)
  assert.equal(shouldInjectGoogleLiveSearch("clima em Sao Paulo hoje", { preferredResponseVariant: "weather" }, { googleSearchConfigured: true }), false)
  assert.equal(shouldInjectGoogleLiveSearch("quando joga o Flamengo hoje", { preferredResponseVariant: "fixture" }, { googleSearchConfigured: true }), false)
})
