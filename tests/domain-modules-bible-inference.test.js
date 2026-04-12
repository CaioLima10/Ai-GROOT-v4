import assert from "node:assert/strict"
import test from "node:test"

import {
  inferDomainModules,
  inferDomainSubmodules
} from "../packages/shared-config/src/domainModules.js"

test("domain inference pulls bible and history for escatology and church history", () => {
  const modules = inferDomainModules("Fale sobre escatologia e história da igreja.")

  assert.ok(modules.includes("bible"))
  assert.ok(modules.includes("history_archaeology"))
})

test("domain inference recognizes arquiologia do periodo de Moises as bible-linked history", () => {
  const modules = inferDomainModules("Crie um cronograma de arquiologia do periodo de Moises.")

  assert.ok(modules.includes("bible"))
  assert.ok(modules.includes("history_archaeology"))
})

test("domain inference keeps angeologia biblica in bible without false data-ai matches", () => {
  const modules = inferDomainModules("Fale sobre angeologia biblica.")

  assert.ok(modules.includes("bible"))
  assert.ok(!modules.includes("data_ai_ml"))
})

test("domain submodule inference normalizes historiography and epigraphy cues", () => {
  const selected = inferDomainSubmodules(
    "Analise a historiografia e a epigrafia do periodo do Exodo.",
    ["history_archaeology"]
  )

  assert.ok(Array.isArray(selected.history_archaeology))
  assert.ok(selected.history_archaeology.includes("historiography_method"))
  assert.ok(selected.history_archaeology.includes("epigraphy_textual_witness"))
})
