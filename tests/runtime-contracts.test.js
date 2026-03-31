import test from "node:test"
import assert from "node:assert/strict"

import {
  getAskContextDiagnostics,
  isGiomRenderableContent,
  normalizeGiomDataVariant,
  normalizeGiomMessageType,
  sanitizeAskContext
} from "../packages/shared-config/src/runtimeContracts.js"

test("normalizeGiomMessageType only accepts supported card types", () => {
  assert.equal(normalizeGiomMessageType("CODE"), "code")
  assert.equal(normalizeGiomMessageType(" weather "), null)
  assert.equal(normalizeGiomMessageType("unknown"), null)
})

test("normalizeGiomDataVariant only accepts supported data variants", () => {
  assert.equal(normalizeGiomDataVariant("FiXtUrE"), "fixture")
  assert.equal(normalizeGiomDataVariant("timeline"), null)
})

test("isGiomRenderableContent accepts strings, arrays and plain objects", () => {
  assert.equal(isGiomRenderableContent("texto"), true)
  assert.equal(isGiomRenderableContent(["a", "b"]), true)
  assert.equal(isGiomRenderableContent({ ok: true }), true)
  assert.equal(isGiomRenderableContent(42), false)
})

test("sanitizeAskContext keeps only allowed keys and sanitizes nested values", () => {
  const context = sanitizeAskContext({
    channel: "web-next",
    assistantProfile: "auto",
    weatherLocation: {
      latitude: -23.55,
      longitude: -46.63,
      label: "Sao Paulo"
    },
    instructions: "a".repeat(2205),
    activeModules: ["developer", "research", "bible"],
    rogue: "should be removed",
    nested: {
      hidden: true
    }
  })

  assert.deepEqual(Object.keys(context).sort(), [
    "activeModules",
    "assistantProfile",
    "channel",
    "instructions",
    "weatherLocation"
  ])
  assert.equal(context.instructions.length, 2000)
  assert.equal(context.weatherLocation.label, "Sao Paulo")
  assert.equal("rogue" in context, false)
})

test("getAskContextDiagnostics reports dropped keys after sanitization", () => {
  const diagnostics = getAskContextDiagnostics({
    channel: "web-next",
    locale: "pt-BR",
    rogue: "drop-me"
  })

  assert.deepEqual(diagnostics.contextKeys.sort(), ["channel", "locale"])
  assert.deepEqual(diagnostics.droppedKeys, ["rogue"])
  assert.ok(diagnostics.contextBytes > 0)
})
