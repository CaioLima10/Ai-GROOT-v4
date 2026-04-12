import test from "node:test"
import assert from "node:assert/strict"

import { extractUserFacingQuantumResponse } from "../groot-quantum.js"

test("extractUserFacingQuantumResponse never promotes reasoning to user output", () => {
  const response = extractUserFacingQuantumResponse({
    reasoning: "cadeia interna que nao deve aparecer",
    recommendation: "Resposta segura ao usuario"
  })

  assert.equal(response, "Resposta segura ao usuario")
})

test("extractUserFacingQuantumResponse returns empty when only internal reasoning exists", () => {
  const response = extractUserFacingQuantumResponse({
    reasoning: "cadeia interna",
    recommendation: "Validacao da solucao: aprovada. Score geral: 92%."
  })

  assert.equal(response, "")
})
