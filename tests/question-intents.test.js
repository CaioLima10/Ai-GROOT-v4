import test from "node:test"
import assert from "node:assert/strict"

import { isLikelyWeatherQuestion } from "../packages/shared-config/src/questionIntents.js"

test("shared weather intent stays focused on meteorology", () => {
  assert.equal(isLikelyWeatherQuestion("Vai chover em Goiania hoje?"), true)
  assert.equal(isLikelyWeatherQuestion("Como esta o tempo no Brasil hoje?"), true)
  assert.equal(isLikelyWeatherQuestion("Preciso levar casaco amanha?"), true)

  assert.equal(
    isLikelyWeatherQuestion("Boa pergunta, creio que jesus cristo voltara sobre as nuvens e ao fim deste tempo vira o Senhor com o juizo final."),
    false
  )
  assert.equal(isLikelyWeatherQuestion("Linha do tempo de Jesus no evangelho de Joao"), false)
  assert.equal(isLikelyWeatherQuestion("Qual o tempo de resposta dessa API?"), false)
})
