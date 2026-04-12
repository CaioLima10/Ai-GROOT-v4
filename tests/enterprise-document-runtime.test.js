import assert from "node:assert/strict"
import test from "node:test"

import {
  buildDocumentDraftPrompt,
  sanitizeGeneratedDocumentContent
} from "../apps/api/src/enterpriseDocumentRuntime.js"

test("document draft prompt forbids meta capability chatter", () => {
  const prompt = buildDocumentDraftPrompt("Monte um plano de onboarding", "docx", {
    locale: "pt-BR",
    style: "natural",
    activeModules: ["operations"],
    title: "Plano"
  })

  assert.match(prompt, /Nao fale sobre capacidades, limites, RAG, Office, navegador, web, memoria interna/i)
  assert.match(prompt, /entregue exatamente esse artefato em formato final/i)
})

test("document sanitizer replaces contaminated onboarding output with a structured fallback", () => {
  const content = sanitizeGeneratedDocumentContent(
    "Eu gero esses arquivos com conhecimento interno, mas nao confunda isso com suite office completa.",
    "gere um documento docx com um plano de onboarding em 4 etapas",
    "docx",
    { title: "Onboarding" }
  )

  assert.match(content, /1\.|2\.|3\.|4\./i)
  assert.match(content, /onboarding|marco de valor|follow-up|implantacao/i)
  assert.doesNotMatch(content, /suite office|conhecimento interno/i)
})

test("document sanitizer replaces low-signal preview leftovers with a useful onboarding fallback", () => {
  const content = sanitizeGeneratedDocumentContent(
    "Limite:",
    "gere um documento docx com um plano de onboarding de clientes em 5 pontos",
    "docx",
    { title: "Onboarding" }
  )

  assert.match(content, /1\.|2\.|3\.|4\.|5\./i)
  assert.match(content, /onboarding|marco de valor|follow-up|implantacao/i)
  assert.doesNotMatch(content, /^limite:?$/i)
})
