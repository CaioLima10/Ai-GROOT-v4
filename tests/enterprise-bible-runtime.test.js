import assert from "node:assert/strict"
import test from "node:test"

import {
  resolveDeterministicBibleGuidanceResponse,
  resolveDeterministicBiblePassageResponse
} from "../apps/api/src/enterpriseBibleRuntime.js"

test("bible deterministic routes do not hijack explicit short replies", () => {
  const question = "Vou te passar Romanos 8 na NAA. Por enquanto, responda apenas: ok."
  const context = {
    biblePassage: {
      reference: "Romanos 8",
      bibleCode: "NAA",
      content: "Agora, pois, ja nao existe condenacao..."
    }
  }

  assert.equal(resolveDeterministicBibleGuidanceResponse(question, context), null)
  assert.equal(resolveDeterministicBiblePassageResponse(question, context), null)
})

test("bible deterministic passage route does not hijack transformation requests", () => {
  const context = {
    biblePassage: {
      reference: "Romanos 8",
      bibleCode: "NAA",
      content: "Agora, pois, ja nao existe condenacao..."
    }
  }

  assert.equal(
    resolveDeterministicBiblePassageResponse("Monte uma tabela simples comparando culpa e seguranca em Romanos 8.", context),
    null
  )
  assert.equal(
    resolveDeterministicBiblePassageResponse("Faca um prompt curto para estudar Romanos 8 por 7 dias.", context),
    null
  )
  assert.equal(
    resolveDeterministicBiblePassageResponse("Fale com tom pastoral maduro para alguem ansioso a partir de Romanos 8.", context),
    null
  )
})

test("bible guidance answers escatology deterministically", () => {
  const response = resolveDeterministicBibleGuidanceResponse("Fale sobre escatologia.", {
    activeModules: ["bible"]
  })

  assert.match(String(response || ""), /ultimas coisas|retorno de Cristo|juizo final/i)
  assert.doesNotMatch(String(response || ""), /Nao consegui responder/i)
})

test("bible guidance answers angeologia deterministically", () => {
  const response = resolveDeterministicBibleGuidanceResponse("Fale sobre angeologia biblica.", {
    activeModules: ["bible"]
  })

  assert.match(String(response || ""), /anjos|angelologia|angeologia/i)
  assert.match(String(response || ""), /Escrituras|Biblia|cristo/i)
  assert.doesNotMatch(String(response || ""), /Nao consegui responder/i)
})

test("bible guidance answers angeologia biblica even before module enrichment", () => {
  const response = resolveDeterministicBibleGuidanceResponse("Fale sobre angeologia biblica.")

  assert.match(String(response || ""), /anjos|angelologia|angeologia/i)
  assert.match(String(response || ""), /Escrituras|Biblia|cristo/i)
  assert.doesNotMatch(String(response || ""), /Nao consegui responder/i)
})

test("bible guidance provides a Christ chronology instead of failing", () => {
  const response = resolveDeterministicBibleGuidanceResponse("Faca uma cronologia do nascimento e da resureicao de Cristo.", {
    activeModules: ["bible", "history_archaeology"]
  })

  assert.match(String(response || ""), /Nascimento|ministerio|crucificacao|Ressurreicao/i)
  assert.doesNotMatch(String(response || ""), /Nao consegui responder/i)
})

test("bible guidance provides an archaeology schedule for Moses", () => {
  const response = resolveDeterministicBibleGuidanceResponse("Crie um cronograma de arquiologia do periodo de Moises.", {
    activeModules: ["bible", "history_archaeology"]
  })

  assert.match(String(response || ""), /Semana 1|Egito|Bronze Tardio|Moises/i)
  assert.doesNotMatch(String(response || ""), /Nao consegui responder/i)
})

test("bible guidance handles current christian books question with honest fallback", () => {
  const response = resolveDeterministicBibleGuidanceResponse(
    "Me indique os melhores livros de pensadores cristaos do momento e faca um resumo.",
    {
      activeModules: ["bible"]
    }
  )

  assert.match(String(response || ""), /AINDA NAO TENHO ESSA INFORMACAO/i)
  assert.match(String(response || ""), /C\. S\. Lewis|John Stott|J\. I\. Packer|Timothy Keller/i)
})
